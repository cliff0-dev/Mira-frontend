import './TopBar.css'

function TopBar() {
  return (
    <header className="top-bar">
      <div className="top-bar-content">
        <div className="top-bar-left">
          <span className="status-dot" aria-hidden="true"></span>
          <div className="brand">
            <span className="app-title">PROJECT MIRA</span>
            <span className="app-subtitle">Explore conversation intelligence</span>
          </div>
        </div>
        <div className="top-bar-right">
          <button className="icon-button" aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="16.65" y1="16.65" x2="21" y2="21"></line>
            </svg>
          </button>
          <button className="icon-button" aria-label="Notifications">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </button>
          <button className="icon-button" aria-label="Profile">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 20c2.5-4 13.5-4 16 0"></path>
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopBar
