import { useMemo, useState } from 'react'
import StatementsList from './StatementsList'
import './TranscriptPanel.css'

const PHASE_COLORS = {
  'Open': '#FFFFFF',           // White
  'Premise': '#F44336',        // Red
  'Evaluation': '#FF9800',     // Orange
  'Narrative': '#FFC107',      // Yellow (changed from Purple)
  'Close': '#2196F3',          // Blue
  'Baseline': '#808080',       // Gray
}

// Speaker color palette for avatars/borders
const SPEAKER_COLORS = [
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#10B981', // Green
  '#F59E0B', // Amber
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#14B8A6', // Teal
]

function TranscriptPanel({ 
  statements, 
  transcript, 
  transcriptRefs, 
  selectedStatementId, 
  speakers,
  selectedPhases, // Changed from selectedPhase to selectedPhases (Set)
  selectedSpeaker,
  onPhaseChange, // Now receives Set operations
  onSpeakerChange,
  phases,
  speakersList,
  onStatementClick,
  conversationId
}) {
  // Get speaker display name
  const getSpeakerName = (speakerId) => {
    // Extract number from "spk_0" -> "0"
    const match = speakerId.match(/spk_(\d+)/)
    if (match) {
      const num = parseInt(match[1])
      return `Speaker ${num + 1}`
    }
    return speakerId
  }

  // Get speaker color for avatar/border
  const getSpeakerColor = (speakerId) => {
    const match = speakerId.match(/spk_(\d+)/)
    if (match) {
      const num = parseInt(match[1])
      return SPEAKER_COLORS[num % SPEAKER_COLORS.length]
    }
    return SPEAKER_COLORS[0]
  }

  // Filter statements based on selected filters
  const filteredStatements = useMemo(() => {
    if (!statements || statements.length === 0) {
      return []
    }
    return statements.filter(statement => {
      // Map non-valid phases to Baseline for filtering
      let phase = statement.phase
      if (phase === 'TopicsOfDiscussion' || phase === 'Value' || phase === 'Voice' || phase === 'Escalation') {
        phase = 'Baseline'
      }
      
      // Check if 'all' is selected or if the phase is in the selected set
      const phaseMatch = selectedPhases.has('all') || selectedPhases.has(phase)
      const speakerMatch = selectedSpeaker === 'all' || statement.speaker === selectedSpeaker
      return phaseMatch && speakerMatch
    })
  }, [statements, selectedPhases, selectedSpeaker])

  // Get phase color helper function
  const getPhaseColorHelper = (stmt) => {
    let phase = (stmt.phase || 'Unknown').trim()
    
    // Map TopicsOfDiscussion to Baseline
    if (phase === 'TopicsOfDiscussion') {
      phase = 'Baseline'
    }
    
    // Filter out Value - treat as Baseline
    if (phase === 'Value' || phase === 'Voice' || phase === 'Escalation') {
      phase = 'Baseline'
    }
    
    // Always use our frontend color scheme, ignore backend ui_color
    const color = PHASE_COLORS[phase] || '#e0e0e0' // Default gray if unknown
    
    return { phase, color }
  }

  // Normalize timestamps - convert microseconds/milliseconds to seconds
  const normalizeTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'number') return timestamp
    
    // If timestamp is suspiciously large (> 10000), it might be in microseconds or milliseconds
    // Check audio duration context to determine
    if (timestamp > 10000) {
      // Try microseconds first (divide by 1,000,000)
      const secondsFromMicroseconds = timestamp / 1_000_000
      // If that gives a reasonable value (< 2 hours), use it
      if (secondsFromMicroseconds < 7200) {
        return secondsFromMicroseconds
      }
      
      // Try milliseconds (divide by 1,000)
      const secondsFromMilliseconds = timestamp / 1_000
      if (secondsFromMilliseconds < 7200) {
        return secondsFromMilliseconds
      }
    }
    
    return timestamp
  }

  // Statements are already concatenated by the backend, so we just need to normalize and sort
  const chronologicalStatements = useMemo(() => {
    if (!filteredStatements || filteredStatements.length === 0) {
      return []
    }
    
    // Normalize timestamps and sort by start time
    return filteredStatements
      .map(stmt => ({
      ...stmt,
      start_time: normalizeTimestamp(stmt.start_time),
      end_time: normalizeTimestamp(stmt.end_time)
    }))
      .sort((a, b) => a.start_time - b.start_time)
  }, [filteredStatements])

  // Get phase color for a statement - always use our agreed colors, ignore backend ui_color
  const getPhaseColor = (stmt) => {
    return getPhaseColorHelper(stmt)
  }

  // Helper to get confidence color
  const getConfidenceColor = (confidence) => {
    if (!confidence) return '#999'
    if (confidence > 0.7) return '#4CAF50' // Green
    if (confidence > 0.4) return '#FF9800' // Orange
    return '#F44336' // Red
  }


  if (filteredStatements.length === 0) {
    return (
      <div className="transcript-panel">
        <div className="transcript-panel-header">
          <h3>Statements</h3>
          <p>No statements match the selected filters</p>
        </div>
        <div className="statements-list-section">
          <p className="empty-message">No statements available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="transcript-panel">
      <div className="transcript-panel-header">
        <div className="header-top">
          <div>
            <h3>Statements</h3>
            <p>Conversation statements with phase classifications.</p>
          </div>
        </div>
        
        <div className="transcript-filters">
          <div className="filter-group">
            <label>Filter by Phase:</label>
            <div className="phase-filters">
              {phases && phases.filter(p => p !== 'all').map(phase => (
                <label key={phase} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedPhases.has('all') || selectedPhases.has(phase)}
                    onChange={(e) => {
                      if (!onPhaseChange) return
                      
                      const newSelectedPhases = new Set(selectedPhases)
                      
                      if (e.target.checked) {
                        // If checking, remove 'all' if present and add the phase
                        newSelectedPhases.delete('all')
                        newSelectedPhases.add(phase)
                      } else {
                        // If unchecking
                        if (selectedPhases.has('all')) {
                          // If 'all' was selected, remove 'all' and add all OTHER phases
                          newSelectedPhases.delete('all')
                          // Add all phases except the one being unchecked
                          phases.filter(p => p !== 'all' && p !== phase).forEach(p => {
                            newSelectedPhases.add(p)
                          })
                        } else {
                          // If 'all' wasn't selected, just remove this phase
                          newSelectedPhases.delete(phase)
                          
                          // If no phases selected, select 'all'
                          if (newSelectedPhases.size === 0) {
                            newSelectedPhases.add('all')
                          }
                        }
                      }
                      
                      // Create a new Set instance to ensure React detects the change
                      onPhaseChange(new Set(newSelectedPhases))
                    }}
                  />
                  <span>{phase}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label>Filter by Speaker:</label>
            <select
              value={selectedSpeaker || 'all'}
              onChange={(e) => onSpeakerChange && onSpeakerChange(e.target.value)}
              className="filter-select"
            >
              {speakersList && speakersList.map(speaker => (
                <option key={speaker} value={speaker}>
                  {speaker === 'all' ? 'All Speakers' : speaker}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

        <div className="statements-list-section">
          <div className="statements-list-header">
            <h4>Statements ({filteredStatements.length})</h4>
          </div>
          <div className="statements-list-content">
            <StatementsList
              statements={filteredStatements}
              onStatementClick={onStatementClick}
              conversationId={conversationId}
            />
          </div>
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

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatTime(seconds) {
  // Normalize timestamp if it's in microseconds or milliseconds
  let normalizedSeconds = seconds
  if (seconds > 10000) {
    // Try microseconds first
    const fromMicroseconds = seconds / 1_000_000
    if (fromMicroseconds < 7200) {
      normalizedSeconds = fromMicroseconds
    } else {
      // Try milliseconds
      const fromMilliseconds = seconds / 1_000
      if (fromMilliseconds < 7200) {
        normalizedSeconds = fromMilliseconds
      }
    }
  }
  
  const mins = Math.floor(normalizedSeconds / 60)
  const secs = Math.floor(normalizedSeconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}

export default TranscriptPanel



