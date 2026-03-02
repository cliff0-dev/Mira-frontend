import './SpeakerBreakdown.css'

function SpeakerBreakdown({ speakers }) {
  return (
    <div className="speaker-breakdown">
      {Object.entries(speakers).map(([speakerId, speakerData]) => (
        <div key={speakerId} className="speaker-card">
          <div className="speaker-header">
            <h3>{speakerId}</h3>
            <div className="speaker-stats">
              <span>{speakerData.num_statements} statements</span>
              <span>{formatDuration(speakerData.total_time)} speaking</span>
            </div>
          </div>

          {Object.keys(speakerData.phase_breakdown).length > 0 && (
            <div className="phase-breakdown">
              <h4>Phase Breakdown</h4>
              <div className="phase-list">
                {Object.entries(speakerData.phase_breakdown).map(([phase, count]) => (
                  <div key={phase} className="phase-item">
                    <span className="phase-name">{phase}</span>
                    <span className="phase-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatDuration(timestamp) {
  // Normalize timestamp if it's in microseconds or milliseconds
  let seconds = timestamp
  if (timestamp > 10000) {
    const fromMicroseconds = timestamp / 1_000_000
    if (fromMicroseconds < 7200) {
      seconds = fromMicroseconds
    } else {
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

export default SpeakerBreakdown





