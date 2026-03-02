import './MetricsPanel.css'

function MetricsPanel({ qualityMetrics, interactionMetrics, metadata }) {
  return (
    <div className="metrics-panel">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Quality Metrics</h3>
          {qualityMetrics.diarization_confidence_avg && (
            <div className="metric-item">
              <span className="metric-label">Diarization Confidence</span>
              <div className="metric-value-bar">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${qualityMetrics.diarization_confidence_avg * 100}%`,
                    backgroundColor: qualityMetrics.diarization_confidence_avg > 0.7 ? '#4CAF50' : qualityMetrics.diarization_confidence_avg > 0.4 ? '#FF9800' : '#F44336',
                  }}
                />
                <span className="metric-value">
                  {(qualityMetrics.diarization_confidence_avg * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {interactionMetrics && (
          <div className="metric-card">
            <h3>Interaction Metrics</h3>
            <div className="metric-item">
              <span className="metric-label">Time Talking</span>
              <span className="metric-value-simple">
                {formatDuration(interactionMetrics.time_talking)}
              </span>
            </div>
            {interactionMetrics.laugh_count !== null && (
              <div className="metric-item">
                <span className="metric-label">Laughs</span>
                <span className="metric-value-simple">{interactionMetrics.laugh_count}</span>
              </div>
            )}
            {interactionMetrics.smile_count !== null && (
              <div className="metric-item">
                <span className="metric-label">Smiles</span>
                <span className="metric-value-simple">{interactionMetrics.smile_count}</span>
              </div>
            )}
            {interactionMetrics.questions_she_asks !== null && (
              <div className="metric-item">
                <span className="metric-label">Questions Asked</span>
                <span className="metric-value-simple">{interactionMetrics.questions_she_asks}</span>
              </div>
            )}
          </div>
        )}

        <div className="metric-card">
          <h3>Processing Info</h3>
          <div className="metric-item">
            <span className="metric-label">Processing Time</span>
            <span className="metric-value-simple">
              {metadata.processing_time_ms}ms ({(metadata.processing_time_ms / 1000).toFixed(2)}s)
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Audio Duration</span>
            <span className="metric-value-simple">
              {formatDuration(metadata.audio_duration)}
            </span>
          </div>
          {metadata.sample_rate && (
            <div className="metric-item">
              <span className="metric-label">Sample Rate</span>
              <span className="metric-value-simple">{metadata.sample_rate} Hz</span>
            </div>
          )}
          {metadata.audio_format && (
            <div className="metric-item">
              <span className="metric-label">Format</span>
              <span className="metric-value-simple">{metadata.audio_format}</span>
            </div>
          )}
        </div>
      </div>
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

export default MetricsPanel





