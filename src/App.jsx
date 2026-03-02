import { useState } from 'react'
import TopBar from './components/TopBar'
import AudioUpload from './components/AudioUpload'
import AnalysisResults from './components/AnalysisResults'
import BottomNav from './components/BottomNav'
import './App.css'

function App() {
  const [analysisData, setAnalysisData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAnalysisComplete = (data) => {
    setAnalysisData(data)
    setError(null)
  }

  const handleError = (err) => {
    setError(err)
    setAnalysisData(null)
  }

  const handleLoading = (isLoading) => {
    setLoading(isLoading)
  }

  return (
    <div className="app" id="top">
      <TopBar />
      <main className="app-main">
        <div className="app-container">
          <AudioUpload
            onAnalysisComplete={handleAnalysisComplete}
            onError={handleError}
            onLoading={handleLoading}
          />

          {loading && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Analyzing conversation...</p>
            </div>
          )}

          {error && (
            <div className="error-container">
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          )}

          {analysisData && <AnalysisResults data={analysisData} />}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

export default App



