import { useMemo } from 'react'
import './TranscriptPanel.css'

const PHASE_COLORS = {
  'Open': '#FFFFFF',           // White
  'Premise': '#F44336',        // Red
  'Evaluation': '#FF9800',     // Orange
  'Narrative': '#FFC107',      // Yellow
  'Close': '#2196F3',          // Blue
  'Baseline': '#808080',       // Gray
}

function ConversationTimelineBar({ statements, onSegmentClick }) {
  // Normalize timestamps helper
  const normalizeTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'number') return timestamp
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

  // Get phase color helper
  const getPhaseColor = (phase) => {
    let normalizedPhase = (phase || 'Unknown').trim()
    if (normalizedPhase === 'TopicsOfDiscussion' || normalizedPhase === 'Value' || 
        normalizedPhase === 'Voice' || normalizedPhase === 'Escalation') {
      normalizedPhase = 'Baseline'
    }
    return { phase: normalizedPhase, color: PHASE_COLORS[normalizedPhase] || '#e0e0e0' }
  }

  // Calculate scrollbar segments
  const scrollbarSegments = useMemo(() => {
    if (!statements || statements.length === 0) {
      return []
    }
    
    // Normalize and sort statements
    const sortedStatements = statements
      .map(stmt => ({
        ...stmt,
        start_time: normalizeTimestamp(stmt.start_time),
        end_time: normalizeTimestamp(stmt.end_time)
      }))
      .sort((a, b) => a.start_time - b.start_time)
    
    const totalDuration = sortedStatements[sortedStatements.length - 1]?.end_time || 0
    if (totalDuration === 0) return []
    
    return sortedStatements.map(stmt => {
      const { phase, color } = getPhaseColor(stmt.phase)
      const startPercent = (stmt.start_time / totalDuration) * 100
      const endPercent = (stmt.end_time / totalDuration) * 100
      const widthPercent = endPercent - startPercent
      
      return {
        phase,
        color,
        startPercent,
        widthPercent,
        startTime: stmt.start_time,
        endTime: stmt.end_time,
        statementId: stmt.id
      }
    })
  }, [statements])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (scrollbarSegments.length === 0) {
    return null
  }

  return (
    <div className="transcript-scrollbar-container">
      <div className="scrollbar-label">Conversation Timeline</div>
      <div className="transcript-scrollbar">
        {scrollbarSegments.map((segment, idx) => (
          <div
            key={`${segment.statementId}-${idx}`}
            className="scrollbar-segment"
            style={{
              left: `${segment.startPercent}%`,
              width: `${Math.max(segment.widthPercent, 0.5)}%`,
              backgroundColor: segment.color,
              cursor: onSegmentClick ? 'pointer' : 'default'
            }}
            title={`${segment.phase}: ${formatTime(segment.startTime)} - ${formatTime(segment.endTime)}`}
            onClick={() => onSegmentClick && onSegmentClick(segment.statementId)}
          />
        ))}
      </div>
    </div>
  )
}

export default ConversationTimelineBar
