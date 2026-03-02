import './TranscriptView.css'

function TranscriptView({ transcript }) {
  return (
    <div className="transcript-view">
      <div className="transcript-header">
        <h3>Raw Transcript</h3>
        <button
          onClick={() => {
            navigator.clipboard.writeText(transcript)
            alert('Transcript copied to clipboard!')
          }}
          className="copy-button"
        >
          Copy
        </button>
      </div>
      <div className="transcript-content">
        {transcript || <p className="empty-transcript">No transcript available</p>}
      </div>
    </div>
  )
}

export default TranscriptView





