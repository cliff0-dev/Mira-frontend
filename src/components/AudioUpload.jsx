import { useState } from 'react'
import axios from 'axios'
import './AudioUpload.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const ANALYZE_BASE_URL = import.meta.env.VITE_ANALYZE_URL || API_BASE_URL
const API_KEY = import.meta.env.VITE_API_KEY || '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'
const CHUNK_SECONDS = 20

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const writeString = (view, offset, value) => {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

const encodeWav = (audioBuffer, startSample, endSample) => {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const totalSamples = endSample - startSample
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = totalSamples * blockAlign

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < totalSamples; i += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const channelData = audioBuffer.getChannelData(channel)
      const sample = clamp(channelData[startSample + i] || 0, -1, 1)
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return buffer
}

const audioBufferToWavBlob = (audioBuffer, startSec, endSec) => {
  const sampleRate = audioBuffer.sampleRate
  const startSample = Math.floor(startSec * sampleRate)
  const endSample = Math.min(Math.floor(endSec * sampleRate), audioBuffer.length)
  const wavBuffer = encodeWav(audioBuffer, startSample, endSample)
  return new Blob([wavBuffer], { type: 'audio/wav' })
}

const mergeSpeakerBreakdown = (target, incoming) => {
  Object.entries(incoming || {}).forEach(([phase, count]) => {
    target[phase] = (target[phase] || 0) + count
  })
}

const mergeEmotionTimeline = (target, incoming, offsetSeconds) => {
  if (!incoming) return
  const lists = ['conversation', 'person_a', 'person_b']
  lists.forEach((key) => {
    const points = incoming[key] || []
    const shifted = points.map((point) => ({
      ...point,
      time: (point.time || 0) + offsetSeconds,
    }))
    target[key] = [...(target[key] || []), ...shifted]
  })
}

function AudioUpload({ onAnalysisComplete, onError, onLoading }) {
  const [file, setFile] = useState(null)
  const [enableClassification, setEnableClassification] = useState(true)
  const [maxSpeakers, setMaxSpeakers] = useState(4)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.wav')) {
        onError('Please select a WAV audio file')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!file) {
      onError('Please select an audio file')
      return
    }

    onLoading(true)
    onError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const totalDuration = audioBuffer.duration

      const chunkCount = Math.ceil(totalDuration / CHUNK_SECONDS)
      let aggregated = null
      let totalStatements = 0
      let weightedAsrSum = 0
      let weightedClassSum = 0
      let weightedDiarSum = 0

      for (let idx = 0; idx < chunkCount; idx += 1) {
        const chunkStart = idx * CHUNK_SECONDS
        const chunkEnd = Math.min(chunkStart + CHUNK_SECONDS, totalDuration)
        const chunkBlob = audioBufferToWavBlob(audioBuffer, chunkStart, chunkEnd)

        const presignResponse = await axios.post(
          `${API_BASE_URL}/uploads/presign`,
          {
            filename: `${file.name.replace(/\.wav$/i, '')}_chunk_${idx + 1}.wav`,
          },
          {
            headers: {
              'x-api-key': API_KEY,
              'Content-Type': 'application/json',
            },
          }
        )

        const { upload_url: uploadUrl, key: s3Key } = presignResponse.data

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: chunkBlob,
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          throw new Error(`S3 upload failed: ${uploadResponse.status} ${errorText}`)
        }

        const analyzeResponse = await axios.post(
          `${ANALYZE_BASE_URL}/analyze?enable_classification=${enableClassification}&max_speakers=${maxSpeakers}`,
          { s3_key: s3Key },
          {
            headers: {
              'x-api-key': API_KEY,
              'Content-Type': 'application/json',
            },
          }
        )

        const result = analyzeResponse.data
        const stmtCount = result?.statements?.length || 0
        totalStatements += stmtCount

        if (!aggregated) {
          aggregated = {
            ...result,
            metadata: {
              ...result.metadata,
              audio_duration: totalDuration,
              num_statements: stmtCount,
              processing_time_ms: result.metadata?.processing_time_ms || 0,
            },
            statements: [],
            speakers: {},
            raw_transcript: '',
            emotion_timeline: {
              conversation: [],
              person_a: [],
              person_b: [],
            },
          }
        } else {
          aggregated.metadata.num_statements += stmtCount
          aggregated.metadata.processing_time_ms += result.metadata?.processing_time_ms || 0
        }

        if (result.raw_transcript) {
          aggregated.raw_transcript = `${aggregated.raw_transcript}${aggregated.raw_transcript ? '\n' : ''}${result.raw_transcript}`
        }

        const statementOffset = aggregated.statements.length
        const shiftedStatements = (result.statements || []).map((statement, index) => ({
          ...statement,
          id: statementOffset + index,
          start_time: (statement.start_time || 0) + chunkStart,
          end_time: (statement.end_time || 0) + chunkStart,
        }))
        aggregated.statements.push(...shiftedStatements)

        Object.entries(result.speakers || {}).forEach(([speakerId, speakerData]) => {
          if (!aggregated.speakers[speakerId]) {
            aggregated.speakers[speakerId] = {
              total_time: 0,
              num_statements: 0,
              phase_breakdown: {},
            }
          }
          aggregated.speakers[speakerId].total_time += speakerData.total_time || 0
          aggregated.speakers[speakerId].num_statements += speakerData.num_statements || 0
          mergeSpeakerBreakdown(aggregated.speakers[speakerId].phase_breakdown, speakerData.phase_breakdown)
        })

        mergeEmotionTimeline(aggregated.emotion_timeline, result.emotion_timeline, chunkStart)

        if (result.quality_metrics?.asr_confidence_avg != null) {
          weightedAsrSum += result.quality_metrics.asr_confidence_avg * (stmtCount || 1)
        }
        if (result.quality_metrics?.classification_confidence_avg != null) {
          weightedClassSum += result.quality_metrics.classification_confidence_avg * (stmtCount || 1)
        }
        if (result.quality_metrics?.diarization_confidence_avg != null) {
          weightedDiarSum += result.quality_metrics.diarization_confidence_avg * (stmtCount || 1)
        }
      }

      if (!aggregated) {
        throw new Error('No analysis results returned')
      }

      const weight = totalStatements || 1
      aggregated.quality_metrics = {
        ...aggregated.quality_metrics,
        asr_confidence_avg: weightedAsrSum ? weightedAsrSum / weight : aggregated.quality_metrics?.asr_confidence_avg,
        classification_confidence_avg: weightedClassSum
          ? weightedClassSum / weight
          : aggregated.quality_metrics?.classification_confidence_avg,
        diarization_confidence_avg: weightedDiarSum
          ? weightedDiarSum / weight
          : aggregated.quality_metrics?.diarization_confidence_avg,
      }

      aggregated.metadata.num_speakers = Object.keys(aggregated.speakers || {}).length

      onAnalysisComplete(aggregated)
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to analyze audio'
      onError(errorMessage)
    } finally {
      onLoading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleRemoveFile = () => {
    setFile(null)
  }

  const scrollToOverview = () => {
    window.dispatchEvent(new CustomEvent('mira:navigate', { detail: 'overview' }))
    const el = document.getElementById('analysis-section') || document.getElementById('top')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="upload-section" id="upload-section">
      <div className="upload-section-header">
        <div>
          <p className="upload-breadcrumb">Mission Control / Input Conversation</p>
          <h2 className="upload-title">Strategic Foresight //</h2>
        </div>
        <button type="button" className="dashboard-button" onClick={scrollToOverview}>
          Go to Dashboard
        </button>
      </div>

      <div className="upload-card">
        <div className="upload-card-header">
          <div className="upload-card-title">
            <span className="upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
                <path d="M14 2v6h6"></path>
                <path d="M9 13h6"></path>
                <path d="M9 17h6"></path>
              </svg>
            </span>
            <div>
              <h3>Upload Audio</h3>
              <p className="upload-card-description">Analyze conversations with AI-powered transcription</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {!file ? (
            <div className="file-drop-zone">
              <label htmlFor="audio-file" className="file-drop-label">
                <span>Drop a .wav file here, or click to browse</span>
              </label>
              <input
                id="audio-file"
                type="file"
                accept=".wav"
                onChange={handleFileChange}
                className="file-input"
              />
            </div>
          ) : (
            <div className="file-chip">
              <span className="file-chip-name">{file.name}</span>
              <span className="file-chip-size">{formatFileSize(file.size)}</span>
              <button type="button" onClick={handleRemoveFile} className="file-chip-remove">x</button>
            </div>
          )}

          <div className="upload-settings">
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={enableClassification}
                onChange={(e) => setEnableClassification(e.target.checked)}
              />
              <span className="toggle-label">Classification</span>
            </label>

            <div className="setting-stepper">
              <label className="stepper-label">Max Speakers</label>
              <div className="stepper-controls">
                <button
                  type="button"
                  onClick={() => setMaxSpeakers(Math.max(2, maxSpeakers - 1))}
                  className="stepper-button"
                >
                  -
                </button>
                <span className="stepper-value">{maxSpeakers}</span>
                <button
                  type="button"
                  onClick={() => setMaxSpeakers(Math.min(10, maxSpeakers + 1))}
                  className="stepper-button"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="upload-actions">
            <button type="submit" className="btn-primary" disabled={!file}>
              Start Analysis
            </button>
            <button type="button" className="btn-secondary" onClick={() => setFile(null)} disabled={!file}>
              Reset
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

export default AudioUpload
