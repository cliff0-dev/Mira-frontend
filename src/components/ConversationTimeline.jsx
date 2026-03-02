import './ConversationTimeline.css'

const PHASE_COLORS = {
  'Open': '#FFFFFF',           // White
  'Premise': '#F44336',        // Red
  'Evaluation': '#FF9800',     // Orange
  'Narrative': '#FFC107',      // Yellow
  'Close': '#2196F3',          // Blue
  'Baseline': '#808080',       // Gray
}

function ConversationTimeline({ statements, duration }) {
  // Create overlapping phase segments - each statement creates its own segment
  const sortedStatements = [...statements].sort((a, b) => a.start_time - b.start_time)
  const totalDuration = duration || (sortedStatements.length > 0 ? sortedStatements[sortedStatements.length - 1].end_time : 0)

  // Group statements by phase to create segments
  // Multiple phases can overlap in time
  const phaseSegments = []
  const phaseActiveRanges = {}

  sortedStatements.forEach((stmt) => {
    const phase = stmt.phase || 'Baseline'
    const start = stmt.start_time
    const end = stmt.end_time

    if (!phaseActiveRanges[phase]) {
      phaseActiveRanges[phase] = []
    }

    // Check if this statement overlaps with existing ranges for this phase
    let merged = false
    for (let i = 0; i < phaseActiveRanges[phase].length; i++) {
      const range = phaseActiveRanges[phase][i]
      // If overlapping or adjacent (within 0.5s), merge
      if ((start <= range.end + 0.5 && end >= range.start - 0.5)) {
        range.start = Math.min(range.start, start)
        range.end = Math.max(range.end, end)
        merged = true
        break
      }
    }

    if (!merged) {
      phaseActiveRanges[phase].push({ start, end })
    }
  })

  // Convert ranges to segments
  Object.entries(phaseActiveRanges).forEach(([phase, ranges]) => {
    ranges.forEach(range => {
      phaseSegments.push({
        phase,
        start: range.start,
        end: range.end,
        color: PHASE_COLORS[phase] || '#999'
      })
    })
  })

  // Sort segments by start time
  phaseSegments.sort((a, b) => a.start - b.start)

  return (
    <div className="conversation-timeline">
      <div className="timeline-header">
        <h3>Conversation Path</h3>
        <p>Direction the conversation took over time through the audio</p>
      </div>
      <div className="timeline-container">
        <div className="timeline-track">
          {phaseSegments.map((segment, idx) => {
            const widthPercent = ((segment.end - segment.start) / totalDuration) * 100
            const leftPercent = (segment.start / totalDuration) * 100
            
            // Calculate opacity based on how many phases overlap at this time
            // For now, use semi-transparent to show overlaps
            const opacity = segment.phase === 'Baseline' ? 0.3 : 0.7
            
            return (
              <div
                key={`${segment.phase}-${idx}`}
                className="timeline-segment"
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  backgroundColor: segment.color,
                  opacity: opacity,
                  zIndex: segment.phase === 'Baseline' ? 1 : 2,
                }}
                title={`${segment.phase}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`}
              >
                {widthPercent > 5 && (
                  <span className="segment-label">{segment.phase}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="timeline-legend">
          <div className="time-markers">
            {[0, 0.25, 0.5, 0.75, 1.0].map(ratio => (
              <div key={ratio} className="time-marker" style={{ left: `${ratio * 100}%` }}>
                <span>{formatTime(ratio * totalDuration)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="timeline-legend-phases">
        {Object.entries(PHASE_COLORS).map(([phase, color]) => (
          <div key={phase} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: color }}></span>
            <span>{phase}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTime(timestamp) {
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
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default ConversationTimeline



