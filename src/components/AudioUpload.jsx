import { useState } from 'react'
import axios from 'axios'
import './AudioUpload.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const API_KEY = import.meta.env.VITE_API_KEY || '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'

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
      const contentType = file.type || 'audio/wav'
      const presignResponse = await axios.post(
        `${API_BASE_URL}/uploads/presign`,
        {
          filename: file.name,
          content_type: contentType,
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
        body: file,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`S3 upload failed: ${uploadResponse.status} ${errorText}`)
      }

      const response = await axios.post(
        `${API_BASE_URL}/analyze?enable_classification=${enableClassification}&max_speakers=${maxSpeakers}`,
        { s3_key: s3Key },
        {
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
          },
        }
      )

      onAnalysisComplete(response.data)
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
