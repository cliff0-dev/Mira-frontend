import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import './ConversationPathGraph.css'

const COLOR_POOL = [
  '#f97316',
  '#a855f7',
  '#38bdf8',
  '#34d399',
  '#facc15',
  '#f472b6',
  '#60a5fa',
  '#c084fc',
]

const formatEmotionLabel = (value) => {
  if (!value) return ''
  return value
    .toString()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const normalizeEmotionKey = (value) => {
  if (!value) return ''
  return value.toString().trim().toLowerCase()
}

const normalizeEmotionMap = (emotions) => {
  if (!emotions || typeof emotions !== 'object') return null
  const normalized = {}
  Object.entries(emotions).forEach(([name, score]) => {
    const key = normalizeEmotionKey(name)
    if (!key) return
    normalized[key] = typeof score === 'number' ? score : 0
  })
  return normalized
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00'
  const roundedSeconds = Math.round(seconds)
  const mins = Math.floor(roundedSeconds / 60)
  const secs = roundedSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function generateSmartTicks(dataPoints) {
  if (!dataPoints || dataPoints.length === 0) return []
  const times = dataPoints.map((p) => p.time).filter((t) => t != null && !isNaN(t))
  if (times.length === 0) return []
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const timeRange = maxTime - minTime
  const numTicks = Math.min(10, Math.max(6, Math.ceil(timeRange / 15)))
  const tickInterval = timeRange / (numTicks - 1 || 1)
  const ticks = []
  for (let i = 0; i < numTicks; i += 1) {
    ticks.push(Math.round((minTime + i * tickInterval) * 100) / 100)
  }
  return ticks
}

const smoothSeries = (values, windowSize = 7) => {
  if (values.length < 3) return values
  const half = Math.floor(windowSize / 2)
  return values.map((_, idx) => {
    let sum = 0
    let count = 0
    for (let i = idx - half; i <= idx + half; i += 1) {
      if (i >= 0 && i < values.length) {
        sum += values[i]
        count += 1
      }
    }
    return count ? sum / count : values[idx]
  })
}

const softClip = (value, gain = 1.2) => {
  const v = Math.max(0, value)
  const denom = Math.tanh(gain)
  if (denom === 0) return 0
  return Math.tanh(v * gain) / denom
}

const getTopEmotions = (points, limit = 4) => {
  const stats = new Map()
  points.forEach((point) => {
    if (point.emotions && typeof point.emotions === 'object') {
      Object.entries(point.emotions).forEach(([name, score]) => {
        const key = normalizeEmotionKey(name)
        if (!key) return
        const value = typeof score === 'number' ? score : 0
        const current = stats.get(key) || {
          key,
          label: formatEmotionLabel(name),
          sum: 0,
          count: 0,
          max: 0,
        }
        current.sum += value
        current.count += 1
        current.max = Math.max(current.max, value)
        stats.set(key, current)
      })
      return
    }

    const name = (point.top_emotion || '').toString().trim()
    if (!name) return
    const key = normalizeEmotionKey(name)
    const value = typeof point.value === 'number' ? point.value : 0
    const current = stats.get(key) || {
      key,
      label: formatEmotionLabel(name),
      sum: 0,
      count: 0,
      max: 0,
    }
    current.sum += value
    current.count += 1
    current.max = Math.max(current.max, value)
    stats.set(key, current)
  })

  return Array.from(stats.values())
    .sort((a, b) => {
      if (b.sum !== a.sum) return b.sum - a.sum
      if (b.max !== a.max) return b.max - a.max
      return b.count - a.count
    })
    .slice(0, limit)
}

function buildEmotionSeries(emotionTimeline, durationSeconds) {
  const conversation = emotionTimeline?.conversation || []
  if (!conversation.length) {
    return { duration: durationSeconds || 0, tracks: [] }
  }

  const sorted = [...conversation].sort((a, b) => a.time - b.time)
  const duration = durationSeconds && durationSeconds > 0
    ? durationSeconds
    : sorted[sorted.length - 1]?.time || 0

  const topEmotions = getTopEmotions(sorted, 4)
  if (!topEmotions.length) {
    return { duration, tracks: [] }
  }

  const baseline = 0.02
  const decay = 0.92
  const shimmer = 0.1

  const normalizedPoints = sorted.map((point) => ({
    ...point,
    normalizedEmotions: normalizeEmotionMap(point.emotions),
  }))

  const tracks = topEmotions.map((emotion, index) => {
    let current = baseline
    const baseValues = normalizedPoints.map((point, idx) => {
      let rawValue = 0
      if (point.normalizedEmotions) {
        rawValue = point.normalizedEmotions[emotion.key] ?? 0
      } else {
        const emotionKey = normalizeEmotionKey(point.top_emotion)
        if (emotionKey === emotion.key) {
          rawValue = typeof point.value === 'number' ? point.value : 0
        }
      }

      const target = baseline + rawValue
      current = current * decay + target * (1 - decay)
      const mod = 1 + shimmer * Math.sin(idx / 6 + index)
      return Math.min(1, current * mod)
    })

    const mainValues = smoothSeries(baseValues, 7).map((v) => softClip(v * 5.5))
    const midValues = smoothSeries(baseValues, 11).map((v, idx) =>
      softClip(v * 3.2 * (1 + 0.1 * Math.cos(idx / 7 + index)))
    )
    const bgValues = smoothSeries(baseValues, 17).map((v, idx) =>
      softClip(v * 2.2 * (1 + 0.08 * Math.sin(idx / 9 + index)))
    )

    const lift = (value) => 0.48 + value * 0.58
    const data = normalizedPoints.map((point, idx) => ({
      time: point.time,
      main: lift(mainValues[idx]),
      mid: lift(midValues[idx]),
      bg: lift(bgValues[idx]),
      topEmotion: point.top_emotion || null,
    }))

    return {
      key: emotion.label || formatEmotionLabel(emotion.key),
      match: emotion.key,
      color: COLOR_POOL[index % COLOR_POOL.length],
      phase: index,
      data,
    }
  })

  return { duration, tracks }
}

function EmotionPathGraph({ emotionTimeline, duration, embedded = false }) {
  const wrapperClass = embedded
    ? 'emotion-path-graph embedded'
    : 'conversation-path-graph emotion-path-graph'

  const emotionSeries = useMemo(
    () => buildEmotionSeries(emotionTimeline, duration),
    [emotionTimeline, duration]
  )

  const hasData = emotionSeries.tracks.length > 0
  const cursorTime = emotionSeries.duration ? emotionSeries.duration * 0.45 : 0

  if (!hasData) {
    return (
      <div className={wrapperClass}>
        <div className="graph-header emotion-header">
          <div className="emotion-title">
            <span className="emotion-marker" aria-hidden="true"></span>
            <div>
              <h3>Emotional Analysis</h3>
              <p>Hume prosody emotion intensity over time</p>
            </div>
          </div>
          <div className="emotion-controls">
            <button type="button" className="emotion-toggle active">Stacked</button>
            <button type="button" className="emotion-toggle">Layered</button>
            <span className="emotion-live">
              <span className="live-dot" aria-hidden="true"></span>
              Live Feed
            </span>
          </div>
        </div>
        <div className="graph-empty">
          <p>No emotion data. Set HUME_API_KEY in .env and restart the API, then upload and analyze a conversation again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <div className="graph-header emotion-header">
        <div className="emotion-title">
          <span className="emotion-marker" aria-hidden="true"></span>
          <div>
            <h3>Emotional Analysis</h3>
            <p>Hume prosody emotion intensity over time</p>
          </div>
        </div>
        <div className="emotion-controls">
          <button type="button" className="emotion-toggle active">Stacked</button>
          <button type="button" className="emotion-toggle">Layered</button>
          <span className="emotion-live">
            <span className="live-dot" aria-hidden="true"></span>
            Live Feed
          </span>
        </div>
      </div>
      <div className="graph-container">
        <div className="emotion-chart-shell">
          <div className="emotion-rows">
            {emotionSeries.tracks.map((track, idx) => {
              const isLast = idx === emotionSeries.tracks.length - 1
              const ticks = generateSmartTicks(track.data)
              return (
                <div key={track.key} className="emotion-row">
                  <div className="emotion-row-label">
                    <div className="emotion-label-top">
                      <span className="emotion-dot" style={{ background: track.color }}></span>
                      <span className="emotion-name">{track.key}</span>
                    </div>
                    <div className="emotion-row-controls">
                      <span className="emotion-chip">S</span>
                      <span className="emotion-chip">M</span>
                      <span className="emotion-chip active">Norm.</span>
                      <span className="emotion-chip">Threshold</span>
                    </div>
                  </div>
                  <div className="emotion-row-chart">
                    <ResponsiveContainer width="100%" height={190}>
                      <AreaChart data={track.data} margin={{ top: 26, right: 24, left: 10, bottom: 20 }}>
                        <defs>
                          <linearGradient id={`grad-${track.key}-bg`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor={track.color} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={track.color} stopOpacity={0.08} />
                          </linearGradient>
                          <linearGradient id={`grad-${track.key}-mid`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor={track.color} stopOpacity={0.55} />
                            <stop offset="100%" stopColor={track.color} stopOpacity={0.12} />
                          </linearGradient>
                          <linearGradient id={`grad-${track.key}-main`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={track.color} stopOpacity={0.95} />
                            <stop offset="70%" stopColor={track.color} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={track.color} stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="1 7" stroke="rgba(148, 163, 184, 0.26)" />
                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          hide={!isLast}
                          ticks={ticks}
                          tickFormatter={(value) => formatTime(value)}
                        />
                        <YAxis domain={[0, 1.35]} hide />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const values = Object.fromEntries(payload.map((entry) => [entry.dataKey, entry.value]))
                            const normalize = (val) => {
                              if (typeof val !== 'number') return 0
                              return Math.max(0, Math.min(100, ((val - 0.48) / 0.58) * 100))
                            }
                            const bg = normalize(values.bg)
                            const mid = normalize(values.mid)
                            const main = normalize(values.main)
                            return (
                              <div className="emotion-tooltip">
                                <div className="emotion-tooltip-time">{formatTime(label)}</div>
                                <div className="emotion-tooltip-row"><span>Bg</span><span>{Math.round(bg)}</span></div>
                                <div className="emotion-tooltip-row"><span>Mid</span><span>{Math.round(mid)}</span></div>
                                <div className="emotion-tooltip-row"><span>Main</span><span>{Math.round(main)}</span></div>
                              </div>
                            )
                          }}
                        />
                        <ReferenceLine y={0.5} stroke="rgba(56, 189, 248, 0.35)" strokeDasharray="4 6" />
                        {cursorTime > 0 && (
                          <ReferenceLine x={cursorTime} stroke="rgba(56, 189, 248, 0.7)" strokeWidth={1} />
                        )}
                        <Area
                          type="basis"
                          dataKey="bg"
                          stroke={track.color}
                          strokeWidth={2}
                          fill={`url(#grad-${track.key}-bg)`}
                          fillOpacity={0.45}
                          baseValue={0.5}
                          dot={false}
                          isAnimationActive={false}
                          style={{ filter: `drop-shadow(0 0 10px ${track.color}55)` }}
                        />
                        <Area
                          type="basis"
                          dataKey="mid"
                          stroke={track.color}
                          strokeWidth={2.8}
                          fill={`url(#grad-${track.key}-mid)`}
                          fillOpacity={0.6}
                          baseValue={0.5}
                          dot={false}
                          isAnimationActive={false}
                          style={{ filter: `drop-shadow(0 0 12px ${track.color}77)` }}
                        />
                        <Area
                          type="basis"
                          dataKey="main"
                          stroke={track.color}
                          strokeWidth={3.8}
                          fill={`url(#grad-${track.key}-main)`}
                          fillOpacity={0.75}
                          baseValue={0.5}
                          dot={false}
                          isAnimationActive={false}
                          style={{ filter: `drop-shadow(0 0 16px ${track.color}aa)` }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmotionPathGraph
