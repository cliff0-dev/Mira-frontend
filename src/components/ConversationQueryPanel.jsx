import { useMemo, useState } from 'react'
import axios from 'axios'
import './ConversationQueryPanel.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const API_KEY = import.meta.env.VITE_API_KEY || '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'

const QUICK_QUESTIONS = [
  'Summarize the conversation in 5 bullet points.',
  'What are the top missed opportunities in this conversation?',
  'Which statements are strongest and why?'
]

function ConversationQueryPanel({ conversationId, statements = [] }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const statementMap = useMemo(() => {
    const map = new Map()
    for (const stmt of statements) {
      map.set(Number(stmt.id), stmt)
    }
    return map
  }, [statements])

  const submitQuery = async (event) => {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || !conversationId || loading) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await axios.post(
        `${API_BASE_URL}/conversations/${conversationId}/query`,
        {
          question: trimmed,
          max_statements: 120
        },
        {
          headers: {
            'x-api-key': API_KEY,
            'Content-Type': 'application/json'
          }
        }
      )

      setResult(response.data)
    } catch (err) {
      const errorMessage =
        err.response?.data?.detail || err.message || 'Failed to run query'
      setError(errorMessage)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="query-panel">
      <div className="query-panel-header">
        <h3>Conversation Query</h3>
        <p>Ask LLM about conversation transcript</p>
      </div>

      <form onSubmit={submitQuery} className="query-form">
        <label htmlFor="conversation-query-input">Question</label>
        <textarea
          id="conversation-query-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Example: Which lines show the strongest interest from Speaker 2?"
          rows={4}
          maxLength={1000}
        />

        <div className="quick-questions">
          {QUICK_QUESTIONS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setQuestion(preset)}
              className="quick-question-btn"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="query-actions">
          <button type="submit" disabled={!question.trim() || loading || !conversationId}>
            {loading ? 'Running...' : 'Run Query'}
          </button>
          <span className="query-char-count">{question.length}/1000</span>
        </div>
      </form>

      {error && (
        <div className="query-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="query-result">
          <div className="query-result-header">
            <h4>Answer</h4>
            <div className={`query-confidence confidence-${result.confidence || 'medium'}`}>
              {(result.confidence || 'medium').toUpperCase()} confidence
            </div>
          </div>
          <p className="query-answer">{result.answer}</p>

          <p className="query-model">Model: {result.model}</p>

          {Array.isArray(result.evidence_statement_ids) && result.evidence_statement_ids.length > 0 && (
            <div className="query-evidence">
              <h5>Evidence Statements</h5>
              <div className="evidence-list">
                {result.evidence_statement_ids.map((id) => {
                  const statement = statementMap.get(Number(id))
                  return (
                    <div key={`${id}-${statement?.id ?? 'missing'}`} className="evidence-item">
                      <div className="evidence-meta">
                        <span>#{id}</span>
                        {statement?.speaker && <span>{statement.speaker}</span>}
                        {statement?.phase && <span>{statement.phase}</span>}
                      </div>
                      <p>{statement?.text || 'Statement not available in current list.'}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ConversationQueryPanel
