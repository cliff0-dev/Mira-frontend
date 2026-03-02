import { useMemo } from 'react'
import './InterestPath.css'

// Speaker color palette
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

function InterestPath({ statements, duration, speakers }) {
  // Calculate interest scores for each speaker over time
  const interestData = useMemo(() => {
    if (!statements || statements.length === 0 || !duration || duration <= 0) {
      return { dataPoints: [], speakers: [] }
    }

    const sortedStatements = [...statements].sort((a, b) => a.start_time - b.start_time)
    const speakerIds = [...new Set(statements.map(s => s.speaker))].sort()
    
    // Phase interest weights (higher = more interest)
    const phaseWeights = {
      'Open': 0.3,
      'Premise': 0.6,
      'Evaluation': 0.9,
      'Narrative': 0.8,
      'Close': 0.4,
      'Baseline': 0.2,
      'Voice': 0.7,
      'Value': 0.7,
    }

    // Create time buckets (every 10 seconds or at each statement)
    const timeBuckets = []
    const bucketSize = Math.max(10, duration / 50) // Adaptive bucket size
    
    for (let time = 0; time <= duration; time += bucketSize) {
      timeBuckets.push({
        time: time,
        speakers: {}
      })
    }

    // Calculate interest for each statement and assign to buckets
    sortedStatements.forEach((stmt, idx) => {
      const speakerId = stmt.speaker
      const stmtDuration = stmt.end_time - stmt.start_time
      const midpoint = (stmt.start_time + stmt.end_time) / 2
      
      // Calculate interest score for this statement
      let interest = 0.5 // Base interest
      
      // Factor 1: Statement length (normalized)
      const lengthScore = Math.min(stmt.num_tokens / 20, 1.0) // Normalize to 20 tokens
      interest += lengthScore * 0.2
      
      // Factor 2: Phase type
      const phase = stmt.phase || 'Baseline'
      const phaseWeight = phaseWeights[phase] || 0.5
      interest += phaseWeight * 0.3
      
      // Factor 3: Duration (longer statements might indicate engagement)
      const durationScore = Math.min(stmtDuration / 5.0, 1.0) // Normalize to 5 seconds
      interest += durationScore * 0.15
      
      // Factor 4: Questions (indicate interest/engagement)
      const hasQuestion = stmt.text.includes('?')
      if (hasQuestion) interest += 0.15
      
      // Factor 5: Response time (shorter pause = more engagement)
      if (idx > 0) {
        const prevStmt = sortedStatements[idx - 1]
        const pause = stmt.start_time - prevStmt.end_time
        if (pause < 1.0) { // Less than 1 second pause
          interest += 0.1
        } else if (pause > 3.0) { // More than 3 seconds
          interest -= 0.1
        }
      }
      
      // Factor 6: Confidence (higher confidence = more reliable = potentially more interest)
      if (stmt.confidence) {
        interest += stmt.confidence * 0.1
      }
      
      // Normalize to 0-1 range
      interest = Math.max(0, Math.min(1, interest))
      
      // Find the bucket for this statement
      const bucketIndex = Math.floor(midpoint / bucketSize)
      if (bucketIndex < timeBuckets.length) {
        if (!timeBuckets[bucketIndex].speakers[speakerId]) {
          timeBuckets[bucketIndex].speakers[speakerId] = {
            values: [],
            count: 0
          }
        }
        timeBuckets[bucketIndex].speakers[speakerId].values.push(interest)
        timeBuckets[bucketIndex].speakers[speakerId].count++
      }
    })

    // Average interest scores per bucket per speaker
    const dataPoints = timeBuckets.map(bucket => {
      const point = { time: bucket.time }
      speakerIds.forEach(speakerId => {
        const speakerData = bucket.speakers[speakerId]
        if (speakerData && speakerData.values.length > 0) {
          const avgInterest = speakerData.values.reduce((a, b) => a + b, 0) / speakerData.values.length
          point[speakerId] = avgInterest
        } else {
          // Use previous value or 0.5 (neutral)
          point[speakerId] = null
        }
      })
      return point
    })

    // Smooth the data (simple moving average)
    const smoothedData = dataPoints.map((point, idx) => {
      const smoothed = { time: point.time }
      speakerIds.forEach(speakerId => {
        const window = 3
        const start = Math.max(0, idx - Math.floor(window / 2))
        const end = Math.min(dataPoints.length, idx + Math.ceil(window / 2))
        const values = []
        for (let i = start; i < end; i++) {
          if (dataPoints[i][speakerId] !== null) {
            values.push(dataPoints[i][speakerId])
          }
        }
        smoothed[speakerId] = values.length > 0 
          ? values.reduce((a, b) => a + b, 0) / values.length 
          : point[speakerId] || 0.5
      })
      return smoothed
    })

    return {
      dataPoints: smoothedData,
      speakers: speakerIds.map(id => ({
        id,
        name: getSpeakerName(id),
        color: getSpeakerColor(id)
      }))
    }
  }, [statements, duration])

  const chartHeight = 200

  if (!interestData.dataPoints.length || !interestData.speakers.length) {
    return (
      <div className="interest-path">
        <div className="interest-path-header">
          <h3>Interest Path</h3>
          <p>Perceived engagement and interest levels for each speaker over time</p>
        </div>
        <div className="interest-path-empty">
          <p>No data available for interest path calculation</p>
        </div>
      </div>
    )
  }

  return (
    <div className="interest-path">
      <div className="interest-path-header">
        <h3>Interest Path</h3>
        <p>Perceived engagement and interest levels for each speaker over time</p>
      </div>
      <div className="interest-path-chart">
        <div className="chart-container">
          <svg 
            viewBox={`0 0 100 ${chartHeight}`} 
            className="interest-svg"
            preserveAspectRatio="none"
          >
            {/* Y-axis labels */}
            <text x="2" y="15" className="axis-label">High</text>
            <text x="2" y={chartHeight / 2} className="axis-label">Med</text>
            <text x="2" y={chartHeight - 15} className="axis-label">Low</text>
            
            {/* Grid lines */}
            <line x1="8" y1="0" x2="8" y2={chartHeight} stroke="#e0e0e0" strokeWidth="0.5" />
            <line x1="8" y1={chartHeight / 2} x2="100" y2={chartHeight / 2} stroke="#e0e0e0" strokeWidth="0.5" strokeDasharray="2,2" />
            
            {/* Draw lines for each speaker */}
            {interestData.speakers.map((speaker) => {
              const points = interestData.dataPoints
                .map((point) => {
                  const x = 8 + ((point.time / duration) * 92) // 92 = 100 - 8 (padding)
                  const interest = point[speaker.id] || 0.5
                  const y = chartHeight - (interest * (chartHeight - 20)) - 10 // Account for padding
                  return { x, y, time: point.time, interest }
                })
                .filter(p => p.x >= 8 && p.x <= 100 && !isNaN(p.y))

              if (points.length < 2) return null

              // Create smooth path
              const pathData = points.map((p, idx) => {
                if (idx === 0) return `M ${p.x} ${p.y}`
                // Use smooth curves
                const prev = points[idx - 1]
                const cp1x = prev.x + (p.x - prev.x) / 2
                const cp1y = prev.y
                const cp2x = prev.x + (p.x - prev.x) / 2
                const cp2y = p.y
                return `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`
              }).join(' ')

              return (
                <g key={speaker.id}>
                  {/* Area fill */}
                  <path
                    d={`${pathData} L ${points[points.length - 1].x} ${chartHeight - 10} L ${points[0].x} ${chartHeight - 10} Z`}
                    fill={speaker.color}
                    opacity="0.15"
                  />
                  {/* Line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={speaker.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.9"
                  />
                </g>
              )
            })}
          </svg>
          
          {/* Time markers */}
          <div className="time-markers">
            {[0, 0.25, 0.5, 0.75, 1.0].map(ratio => {
              const leftPercent = 8 + (ratio * 92)
              return (
                <div key={ratio} className="time-marker" style={{ left: `${leftPercent}%` }}>
                  <span>{formatTime(ratio * duration)}</span>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="interest-legend">
          {interestData.speakers.map(speaker => (
            <div key={speaker.id} className="legend-item">
              <span 
                className="legend-line" 
                style={{ backgroundColor: speaker.color }}
              ></span>
              <span>{speaker.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getSpeakerName(speakerId) {
  const match = speakerId.match(/spk_(\d+)/)
  if (match) {
    const num = parseInt(match[1])
    return `Speaker ${num + 1}`
  }
  return speakerId
}

function getSpeakerColor(speakerId) {
  const match = speakerId.match(/spk_(\d+)/)
  if (match) {
    const num = parseInt(match[1])
    return SPEAKER_COLORS[num % SPEAKER_COLORS.length]
  }
  return SPEAKER_COLORS[0]
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

export default InterestPath
