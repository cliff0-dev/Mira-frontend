import { useState } from 'react'
import StatementsList from './StatementsList'
import SpeakerBreakdown from './SpeakerBreakdown'
import MetricsPanel from './MetricsPanel'
import './AnalysisPanel.css'

function AnalysisPanel({
  statements,
  allStatements,
  speakers,
  qualityMetrics,
  interactionMetrics,
  metadata,
  selectedPhase,
  selectedSpeaker,
  onPhaseChange,
  onSpeakerChange,
  onStatementClick,
  phases,
  speakersList
}) {
  const [activeTab, setActiveTab] = useState('statements')

  return (
    <div className="analysis-panel">
      <div className="analysis-panel-header">
        <h3>AI Analysis Results</h3>
        <p>Segmented statements, identified phases, and extracted insights.</p>
      </div>

      <div className="analysis-filters">
        <div className="filter-group">
          <label>Filter by Phase:</label>
          <div className="phase-filters">
            {phases.filter(p => p !== 'all').map(phase => (
              <label key={phase} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedPhase === 'all' || selectedPhase === phase}
                  onChange={(e) => {
                    if (e.target.checked && selectedPhase !== phase) {
                      onPhaseChange(phase)
                    } else if (!e.target.checked && selectedPhase === phase) {
                      onPhaseChange('all')
                    }
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
            value={selectedSpeaker}
            onChange={(e) => onSpeakerChange(e.target.value)}
            className="filter-select"
          >
            {speakersList.map(speaker => (
              <option key={speaker} value={speaker}>
                {speaker === 'all' ? 'All Speakers' : speaker}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="analysis-tabs">
        <button
          className={activeTab === 'statements' ? 'active' : ''}
          onClick={() => setActiveTab('statements')}
        >
          Statements
        </button>
        <button
          className={activeTab === 'speakers' ? 'active' : ''}
          onClick={() => setActiveTab('speakers')}
        >
          Speakers
        </button>
        <button
          className={activeTab === 'metrics' ? 'active' : ''}
          onClick={() => setActiveTab('metrics')}
        >
          Metrics
        </button>
      </div>

      <div className="analysis-content">
        {activeTab === 'statements' && (
          <div className="tab-content">
            <div className="results-count">
              Showing {statements.length} of {allStatements.length} statements
            </div>
            <StatementsList
              statements={statements}
              onStatementClick={onStatementClick}
            />
          </div>
        )}

        {activeTab === 'speakers' && (
          <div className="tab-content">
            <SpeakerBreakdown speakers={speakers} />
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="tab-content">
            <MetricsPanel
              qualityMetrics={qualityMetrics}
              interactionMetrics={interactionMetrics}
              metadata={metadata}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalysisPanel




