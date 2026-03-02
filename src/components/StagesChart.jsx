import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './StagesChart.css'

const PHASE_COLORS = {
  'Open': '#FFFFFF',           // White (changed from black)
  'Premise': '#F44336',        // Red
  'Evaluation': '#FF9800',     // Orange
  'Narrative': '#FFC107',      // Yellow
  'Close': '#2196F3',          // Blue
  'Baseline': '#808080',       // Gray
}

// Phases for vertical bars (exclude Baseline - it's shown horizontally)
const PHASE_ORDER = ['Open', 'Premise', 'Evaluation', 'Narrative', 'Close']

function StagesChart({ statements }) {
  // Normalize phases - map invalid phases to Baseline
  const normalizePhase = (phase) => {
    if (!phase || phase === 'TopicsOfDiscussion' || phase === 'Value' || 
        phase === 'Voice' || phase === 'Escalation') {
      return 'Baseline'
    }
    return phase
  }

  // Normalize timestamps to seconds
  const normalizeTimestamp = (timestamp) => {
    if (!timestamp || typeof timestamp !== 'number') return timestamp
    if (timestamp > 10000) {
      const fromMicroseconds = timestamp / 1_000_000
      if (fromMicroseconds < 7200) return fromMicroseconds
      const fromMilliseconds = timestamp / 1_000
      if (fromMilliseconds < 7200) return fromMilliseconds
    }
    return timestamp
  }

  // Statements are already concatenated by the backend, so we just normalize and sort
  const sortedStatements = [...statements]
    .map(stmt => ({
      ...stmt,
      start_time: normalizeTimestamp(stmt.start_time),
      end_time: normalizeTimestamp(stmt.end_time),
      phase: normalizePhase(stmt.phase)
    }))
    .sort((a, b) => a.start_time - b.start_time)

  // Calculate phase composition and counts
  // Since statements are already concatenated, each statement has a single phase
  const phaseComposition = {}
  const phaseStatementCounts = {}
  const baselineDistribution = {}

  PHASE_ORDER.forEach(phase => {
    phaseComposition[phase] = {}
    phaseStatementCounts[phase] = 0
    baselineDistribution[phase] = 0
  })

  sortedStatements.forEach((stmt, idx) => {
    const phase = stmt.phase
    const prevStmt = idx > 0 ? sortedStatements[idx - 1] : null
    
    // Count statements per phase
    phaseStatementCounts[phase] = (phaseStatementCounts[phase] || 0) + 1
    
    // If this is Baseline, check if we should distribute it to nearby phases
    if (phase === 'Baseline') {
      // Find nearest non-baseline phase (look forward and backward)
      let nearestPhase = null
      let minDistance = Infinity

      // Look forward
      for (let i = idx + 1; i < sortedStatements.length && i < idx + 10; i++) {
        const nextPhase = sortedStatements[i].phase
        if (nextPhase !== 'Baseline') {
          const distance = sortedStatements[i].start_time - stmt.start_time
          if (distance < minDistance) {
            minDistance = distance
            nearestPhase = nextPhase
          }
          break
        }
      }

      // Look backward
      for (let i = idx - 1; i >= 0 && i >= idx - 10; i--) {
        const prevPhase = sortedStatements[i].phase
        if (prevPhase !== 'Baseline') {
          const distance = stmt.start_time - sortedStatements[i].start_time
            if (distance < minDistance) {
              minDistance = distance
            nearestPhase = prevPhase
          }
          break
        }
      }

      // Distribute baseline to nearest phase if found
      if (nearestPhase && nearestPhase !== 'Baseline') {
        baselineDistribution[nearestPhase] = (baselineDistribution[nearestPhase] || 0) + 1
      }
    } else {
      // Non-baseline phase - just count it
      phaseStatementCounts[phase] = (phaseStatementCounts[phase] || 0) + 1
    }
  })

  // Since statements are already concatenated, each statement has one phase
  // So phase composition is just the phase itself
  PHASE_ORDER.forEach(phase => {
    const count = phaseStatementCounts[phase] || 0
    if (count > 0) {
      phaseComposition[phase][phase] = count
    }
  })

  // Baseline is now stacked within each phase bar, not cumulative

  // Prepare chart data - exclude Baseline from vertical bars
  const chartData = PHASE_ORDER.map(phase => {
    const dataPoint = { phase }
    const composition = phaseComposition[phase] || {}
    const totalStatements = phaseStatementCounts[phase] || 0
    
    // Add phase composition (what phases appear within this phase)
    PHASE_ORDER.forEach(cls => {
      dataPoint[cls] = composition[cls] || 0
    })
    
    // If this phase has statements, ensure the bar has proper height
    if (totalStatements > 0) {
      const hasSubPhases = Object.values(composition).some(v => v > 0)
      if (!hasSubPhases) {
        // No sub-phases, so the entire bar is this phase
        dataPoint[phase] = totalStatements
      } else {
        // Has sub-phases - verify the sum matches totalStatements
        const sumOfSubPhases = Object.values(composition).reduce((sum, v) => sum + v, 0)
        if (sumOfSubPhases < totalStatements) {
          // Add the difference as the primary phase to ensure correct height
          dataPoint[phase] = totalStatements - sumOfSubPhases
        }
      }
    }
    
    // Add baseline count for horizontal bar
    dataPoint.baseline = baselineDistribution[phase] || 0
    
    return dataPoint
  }).filter(d => {
    // Only show phases that have statements
    const total = Object.values(d).reduce((sum, val) => {
      if (typeof val === 'number' && val !== d.phase && val !== d.baseline) {
        return sum + val
      }
      return sum
    }, 0)
    return total > 0 || phaseStatementCounts[d.phase] > 0
  })

  // Get classification types that appear in the data (exclude Baseline)
  // Include all phases that appear as either primary phases or sub-phases
  const classificationTypes = []
  PHASE_ORDER.forEach(cls => {
    const hasData = chartData.some(d => {
      // Check if this phase appears as a sub-phase in any primary phase
      return d[cls] > 0
    })
    if (hasData) {
      classificationTypes.push(cls)
    }
  })

  return (
    <div className="stages-chart">
      <div className="chart-header">
        <h3>Stages and Amounts</h3>
        <p>Frequency of each conversation phase with stacked classifications</p>
      </div>
      <div className="chart-container-stacked">
        <ResponsiveContainer width="100%" height={500}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
            <XAxis 
              dataKey="phase" 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              label={{ value: 'Number of Statements', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'baseline') {
                  return [value, 'Baseline (Normal Conversation)']
                }
                return [value, name]
              }}
              labelFormatter={(label) => `Phase: ${label}`}
            />
            <Legend />
            {/* Baseline stacked at bottom (gray) */}
            <Bar
              dataKey="baseline"
              stackId="a"
              fill={PHASE_COLORS['Baseline']}
              name="Baseline"
            />
            {/* Phase bars stacked on top (phase colors) */}
            {classificationTypes.map((cls) => (
              <Bar
                key={cls}
                dataKey={cls}
                stackId="a"
                fill={PHASE_COLORS[cls] || '#999'}
                name={cls}
                stroke={cls === 'Open' ? 'rgba(148, 163, 184, 0.6)' : 'none'} // Add border for white Open bars
                strokeWidth={cls === 'Open' ? 1 : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins > 0) {
    return `${mins}m ${secs}s`
  }
  return `${secs}s`
}

export default StagesChart



