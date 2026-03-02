import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import './PhaseDistributionChart.css'

const PHASE_COLORS = {
  'Open': '#FFFFFF',           // White
  'Premise': '#F44336',        // Red
  'Evaluation': '#FF9800',     // Orange
  'Narrative': '#FFC107',      // Yellow (changed from Purple)
  'Close': '#2196F3',          // Blue
  'Baseline': '#808080',       // Gray
}

const PHASE_ORDER = ['Open', 'Premise', 'Evaluation', 'Narrative', 'Close', 'Baseline']

function PhaseDistributionChart({ statements }) {
  const phaseCounts = {}
  statements.forEach(stmt => {
    // Map TopicsOfDiscussion and Value to Baseline
    let phase = stmt.phase || 'Unknown'
    if (phase === 'TopicsOfDiscussion' || phase === 'Value' || 
        phase === 'Voice' || phase === 'Escalation') {
      phase = 'Baseline'
    }
    phaseCounts[phase] = (phaseCounts[phase] || 0) + 1
  })

  const total = statements.length
  const data = PHASE_ORDER.map(phase => {
    const count = phaseCounts[phase] || 0
    return {
      name: phase,
      value: count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : 0
    }
  }).filter(item => {
    // Show all phases that have data, including Baseline
    return item.value > 0
  })

  const COLORS = data.map(item => PHASE_COLORS[item.name] || '#999')

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, index }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null

    // Get phase name from data if not provided directly
    const phaseName = name || (data[index]?.name)
    
    // Use black text for white (Open) segments, white for others
    const textColor = phaseName === 'Open' ? '#000000' : '#FFFFFF'

    return (
      <text
        x={x}
        y={y}
        fill={textColor}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="phase-distribution-chart">
      <div className="chart-header">
        <h3>Phase Distribution</h3>
        <p>Proportion of statements by conversation phase</p>
      </div>
      <div className="chart-content">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={100}
              innerRadius={50}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index]}
                  stroke={entry.name === 'Open' ? '#CCCCCC' : 'none'}
                  strokeWidth={entry.name === 'Open' ? 1 : 0}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${value} (${data.find(d => d.name === name)?.percentage}%)`,
                name
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-legend">
          {data.map((item, index) => (
            <div key={item.name} className="legend-item">
              <span
                className="legend-color"
                style={{ backgroundColor: COLORS[index] }}
              ></span>
              <span className="legend-name">{item.name}</span>
              <span className="legend-value">
                {item.value} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PhaseDistributionChart



