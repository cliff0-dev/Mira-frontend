import { useState, useRef, useEffect } from 'react'
import TranscriptPanel from './TranscriptPanel'
import ConversationPathGraph from './ConversationPathGraph'
import EmotionPathGraph from './EmotionPathGraph'
import StagesChart from './StagesChart'
import PhaseDistributionChart from './PhaseDistributionChart'
import KPICards from './KPICards'
import ConversationTimelineBar from './ConversationTimelineBar'
import ConversationQueryPanel from './ConversationQueryPanel'
import './AnalysisResults.css'

function AnalysisResults({ data }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPhases, setSelectedPhases] = useState(new Set(['all'])) 
  const [selectedSpeaker, setSelectedSpeaker] = useState('all')
  const [selectedStatementId, setSelectedStatementId] = useState(null)
  const transcriptRefs = useRef({})

  useEffect(() => {
    const handleNavigate = (event) => {
      if (event?.detail === 'overview') {
        setActiveTab('overview')
      }
    }
    window.addEventListener('mira:navigate', handleNavigate)
    return () => window.removeEventListener('mira:navigate', handleNavigate)
  }, [])

  useEffect(() => {
    if (data?.statements?.length > 0) {
      const firstStatement = data.statements[0]
      const hasSubcategory = firstStatement.subcategory !== null && firstStatement.subcategory !== undefined
      const confidence = firstStatement.classification_confidence
      
      console.log('🔍 Classification Model Check:')
      console.log('  First statement:', firstStatement)
      console.log('  Has subcategory:', hasSubcategory)
      console.log('  Confidence:', confidence)
      console.log('  Model type:', hasSubcategory ? '🟡 Azure OpenAI (has subcategories)' : '🔵 Fine-tuned Model (no subcategories)')
      
      // Check a few more statements to be sure
      const statementsWithSubcategories = data.statements.filter(s => s.subcategory !== null && s.subcategory !== undefined).length
      const totalStatements = data.statements.length
      console.log(`  Statements with subcategories: ${statementsWithSubcategories}/${totalStatements}`)
    }
  }, [data])

  // Only include valid phases: Open, Premise, Evaluation, Narrative, Close, Baseline
  // Map TopicsOfDiscussion, Value, Voice, Escalation to Baseline
  const validPhases = ['Open', 'Premise', 'Evaluation', 'Narrative', 'Close', 'Baseline']
  const mappedPhases = data.statements.map(s => {
    const phase = s.phase
    if (phase === 'TopicsOfDiscussion' || phase === 'Value' || phase === 'Voice' || phase === 'Escalation') {
      return 'Baseline'
    }
    return phase
  }).filter(Boolean)
  const allPhases = new Set(mappedPhases)
  const phases = ['all', ...validPhases.filter(p => allPhases.has(p))]
  const speakers = ['all', ...new Set(data.statements.map(s => s.speaker))]

  const filteredStatements = data.statements.filter(statement => {
    // Map non-valid phases to Baseline
    let phase = statement.phase
    if (phase === 'TopicsOfDiscussion' || phase === 'Value' || phase === 'Voice' || phase === 'Escalation') {
      phase = 'Baseline'
    }
    
    // Check if 'all' is selected or if the phase is in the selected set
    const phaseMatch = selectedPhases.has('all') || selectedPhases.has(phase)
    const speakerMatch = selectedSpeaker === 'all' || statement.speaker === selectedSpeaker
    return phaseMatch && speakerMatch
  })

  const handleStatementClick = (statementId) => {
    setSelectedStatementId(statementId)
    // If on transcript tab, scroll to the statement in the statements list
    if (activeTab === 'transcript') {
      const statementElement = document.querySelector(`[data-statement-id="${statementId}"]`)
      if (statementElement) {
        statementElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight briefly
        statementElement.classList.add('highlighted')
        setTimeout(() => statementElement.classList.remove('highlighted'), 2000)
      }
    }
    // If clicking from Overview timeline, could switch to transcript tab to show the statement
    // For now, just set the selected ID
  }

  return (
    <div className="results-container" id="analysis-section">
      <div className="results-header">
        <div className="results-meta">
          <p className="results-breadcrumb">Mission Control / Analysis Archive</p>
          <div className="results-title-row">
            <h2>Strategic Foresight //</h2>
            <div className="results-status">
              <span className="status-pill">Sync Status: Live</span>
            </div>
          </div>
          <p className="conversation-id">Session: {data.conversation_id}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards 
        metadata={data.metadata}
        statements={data.statements}
        speakers={data.speakers}
      />

      {/* Tabs */}
      <div className="results-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'flow' ? 'active' : ''}`}
          onClick={() => setActiveTab('flow')}
        >
          Flow
        </button>
        <button
          className={`tab-button ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
        <button
          className={`tab-button ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          Query
        </button>
        <button
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Raw Data
        </button>
      </div>

      {/* Tab Content */}
      <div key={activeTab} className="tab-content tab-content-animate">
        {activeTab === 'overview' && (
          <div className="overview-tab tab-panel">
            <ConversationTimelineBar 
              statements={data.statements}
              onSegmentClick={handleStatementClick}
            />
            <div className="visualizations-grid">
              <StagesChart statements={data.statements} />
              <PhaseDistributionChart statements={data.statements} />
            </div>
          </div>
        )}

        {activeTab === 'flow' && (
          <div className="flow-tab tab-panel">
            <ConversationPathGraph 
              statements={data.statements} 
              duration={data.metadata.audio_duration}
              speakers={data.speakers}
                betweenContent={({ visibleStart, visibleEnd, zoomLevel }) => (
                  <EmotionPathGraph
                    emotionTimeline={data.emotion_timeline}
                    duration={data.metadata.audio_duration}
                    speakers={data.speakers}
                    embedded
                    zoomStart={visibleStart}
                    zoomEnd={visibleEnd}
                    zoomLevel={zoomLevel}
                  />
                )}
            />
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="transcript-tab tab-panel">
            <TranscriptPanel
              statements={data.statements}
              transcript={data.raw_transcript}
              transcriptRefs={transcriptRefs}
              selectedStatementId={selectedStatementId}
              speakers={data.speakers}
              selectedPhases={selectedPhases}
              selectedSpeaker={selectedSpeaker}
              onPhaseChange={setSelectedPhases}
              onSpeakerChange={setSelectedSpeaker}
              phases={phases}
              speakersList={speakers}
              onStatementClick={handleStatementClick}
              conversationId={data.conversation_id}
            />
          </div>
        )}

        {activeTab === 'query' && (
          <div className="query-tab tab-panel">
            <ConversationQueryPanel
              conversationId={data.conversation_id}
              statements={data.statements}
            />
          </div>
        )}

        {activeTab === 'details' && (
          <div className="details-tab tab-panel">
            <div className="details-card">
              <h3>Raw Data</h3>
              <pre className="json-preview">{JSON.stringify(data, null, 2)}</pre>
            </div>
          </div>
        )}
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

export default AnalysisResults
