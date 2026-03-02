import { useState, useEffect } from 'react'
import { useAudioManager } from '../hooks/useAudioManager'
import './StatementCard.css'

const PHASE_COLORS = {
  'Open': '#FFFFFF',           // White
  'Premise': '#F44336',        // Red
  'Evaluation': '#FF9800',     // Orange
  'Narrative': '#FFC107',       // Yellow
  'Close': '#2196F3',          // Blue
  'Baseline': '#808080',       // Gray
}

function StatementCard({ statement, onClick, conversationId }) {
  const { playSegment, stop, isPlaying, isLoading, error: audioError } = useAudioManager(conversationId)
  const formatTime = (timestamp) => {
    // Normalize timestamp if it's in microseconds or milliseconds
    let seconds = timestamp
    if (timestamp > 10000) {
      // Try microseconds first
      const fromMicroseconds = timestamp / 1_000_000
      if (fromMicroseconds < 7200) {
        seconds = fromMicroseconds
      } else {
        // Try milliseconds
        const fromMilliseconds = timestamp / 1_000
        if (fromMilliseconds < 7200) {
          seconds = fromMilliseconds
        }
      }
    }
    
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  // Map TopicsOfDiscussion and Value to Baseline
  let phase = statement.phase || 'Baseline'
  if (phase === 'TopicsOfDiscussion' || phase === 'Value' || 
      phase === 'Voice' || phase === 'Escalation') {
    phase = 'Baseline'
  }
  
  // Always use our agreed colors, ignore backend ui_color
  const backgroundColor = PHASE_COLORS[phase] || '#e0e0e0'
  const textColor = getContrastColor(backgroundColor)

  // Normalize timestamp to seconds
  const normalizeTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'number') return 0
    if (timestamp > 10000) {
      const fromMicroseconds = timestamp / 1_000_000
      if (fromMicroseconds < 7200) {
        return fromMicroseconds
      }
      const fromMilliseconds = timestamp / 1_000
      if (fromMilliseconds < 7200) {
        return fromMilliseconds
      }
    }
    return timestamp
  }

  const handlePlayClick = async (e) => {
    e.stopPropagation() // Prevent card click
    
    if (!conversationId) {
      return
    }

    // If already playing, stop it
    if (isPlaying) {
      stop()
      return
    }

    const startTime = normalizeTimestamp(statement.start_time || 0)
    const endTime = normalizeTimestamp(statement.end_time || 0)

    // Play segment using cached audio - this is now instant!
    // No need to fetch segments, just jump to timestamp
    await playSegment(startTime, endTime)
  }

  return (
    <div
      className="statement-card"
      data-statement-id={statement.id}
      style={{
        borderLeftColor: backgroundColor,
        borderLeftWidth: '4px',
      }}
      onClick={onClick}
    >
      <div className="statement-header">
        <div className="statement-meta">
          <span className="statement-id">#{statement.id}</span>
          {conversationId && (
            <button
              className="audio-play-button"
              onClick={handlePlayClick}
              disabled={isLoading}
              title={isPlaying ? 'Stop playback' : 'Play audio'}
            >
              {isLoading ? (
                <span className="audio-spinner">⏳</span>
              ) : isPlaying ? (
                <span>⏸</span>
              ) : (
                <span>▶</span>
              )}
            </button>
          )}
          <span className="speaker-badge">{statement.speaker}</span>
          {statement.phase && (
            <span
              className="phase-badge"
              style={{
                backgroundColor: backgroundColor,
                color: textColor,
              }}
            >
              {statement.phase}
            </span>
          )}
          {statement.subcategory && (
            <span className="subcategory-badge">{statement.subcategory}</span>
          )}
        </div>
        <div className="statement-time">
          {formatTime(statement.start_time)} → {formatTime(statement.end_time)}
        </div>
      </div>

      <div className="statement-text">{statement.text}</div>

      <div className="statement-footer">
        <div className="statement-stats">
          <span>{statement.num_tokens} tokens</span>
        </div>
        {audioError && (
          <div className="audio-error" title={audioError}>
            ⚠️ Audio unavailable
          </div>
        )}
      </div>
    </div>
  )
}

function getContrastColor(hexColor) {
  if (!hexColor) return '#000'
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? '#000' : '#fff'
}

export default StatementCard

