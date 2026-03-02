import './KPICards.css'

function KPICards({ metadata, statements, speakers }) {
  // Normalize timestamp helper
  const normalizeTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'number') return timestamp
    if (timestamp > 10000) {
      // Try microseconds first
      const fromMicroseconds = timestamp / 1_000_000
      if (fromMicroseconds < 7200) {
        return fromMicroseconds
      }
      // Try milliseconds
      const fromMilliseconds = timestamp / 1_000
      if (fromMilliseconds < 7200) {
        return fromMilliseconds
      }
    }
    return timestamp
  }

  // Calculate words per minute (WPM) based on actual speaking time
  // WPM = (total words / total speaking time in seconds) * 60
  const calculateWPMWithTimeWindows = () => {
    if (!statements || statements.length === 0) {
      return []
    }

    // Track total words and total speaking time per speaker
    const speakerStats = {}
    
    statements.forEach(stmt => {
      const speaker = stmt.speaker || 'unknown'
      const text = stmt.text || ''
      const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length
      const startTime = normalizeTimestamp(stmt.start_time || 0)
      const endTime = normalizeTimestamp(stmt.end_time || 0)
      const statementDuration = Math.max(0, endTime - startTime)
      
      // Initialize speaker stats if needed
      if (!speakerStats[speaker]) {
        speakerStats[speaker] = { totalWords: 0, totalSpeakingTimeSeconds: 0 }
      }
      
      // Accumulate words and speaking time
      speakerStats[speaker].totalWords += wordCount
      speakerStats[speaker].totalSpeakingTimeSeconds += statementDuration
    })

    // Calculate WPM for each speaker
    // WPM = (words / seconds) * 60
    const speakerWPMList = Object.entries(speakerStats)
      .map(([speaker, stats]) => {
        // Calculate WPM: (total words / total speaking time in seconds) * 60 seconds per minute
        let wpm = 0
        if (stats.totalSpeakingTimeSeconds > 0) {
          wpm = (stats.totalWords / stats.totalSpeakingTimeSeconds) * 60
          wpm = Math.round(wpm) // Round to nearest integer
        }
        
        // Extract speaker number from "spk_0" -> "Speaker 1"
        const match = speaker.match(/spk_(\d+)/)
        const speakerNum = match ? parseInt(match[1]) + 1 : speaker
        
        return { speakerNum, wpm }
      })
      .filter(speaker => speaker.wpm > 0) // Only include speakers who spoke
      .sort((a, b) => a.speakerNum - b.speakerNum)

    return speakerWPMList
  }

  const speakerWPMList = calculateWPMWithTimeWindows()

  return (
    <div className="kpi-cards">
      <KPICard
        label="Duration"
        value={formatDuration(metadata.audio_duration)}
        icon="⏱️"
      />
      <KPICard
        label="Statements"
        value={metadata.num_statements || statements.length}
        icon="💬"
      />
      <div className={`kpi-card talk-time-balance-card`}>
        <div className="kpi-card-icon">⚖️</div>
        <div className="kpi-card-content">
          <div className="kpi-card-label">Talk Time Balance</div>
          <div className="kpi-card-value talk-time-balance-value">
            {speakerWPMList.length > 0 ? (
              speakerWPMList.map(({ speakerNum, wpm }, index) => (
                <div key={index} className="speaker-wpm-row">
                  Speaker {speakerNum}: {wpm} WPM
                </div>
              ))
            ) : (
              <div className="speaker-wpm-row">0 WPM</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, highlight, suffix = '', className = '' }) {
  return (
    <div className={`kpi-card ${highlight ? 'kpi-card-highlight' : ''} ${className}`}>
      <div className="kpi-card-icon">{icon}</div>
      <div className="kpi-card-content">
        <div className="kpi-card-label">{label}</div>
        <div className="kpi-card-value">
          {value}{suffix}
        </div>
      </div>
    </div>
  )
}

function formatDuration(timestamp) {
  if (!timestamp) return '0:00'
  
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

export default KPICards
