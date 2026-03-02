import StatementCard from './StatementCard'
import './StatementsList.css'

function StatementsList({ statements, onStatementClick, conversationId }) {
  if (statements.length === 0) {
    return (
      <div className="empty-state">
        <p>No statements match the selected filters.</p>
      </div>
    )
  }

  return (
    <div className="statements-list">
      {statements.map((statement) => (
        <StatementCard
          key={statement.id}
          statement={statement}
          onClick={() => onStatementClick && onStatementClick(statement.id)}
          conversationId={conversationId}
        />
      ))}
    </div>
  )
}

export default StatementsList


