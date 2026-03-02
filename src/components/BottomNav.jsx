import { useEffect, useState } from 'react'
import './BottomNav.css'

const getSectionTop = (id) => {
  const el = document.getElementById(id)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return rect.top
}

function BottomNav() {
  const [active, setActive] = useState('home')

  const scrollToId = (id, fallback = null) => {
    const el = document.getElementById(id) || (fallback ? document.getElementById(fallback) : null)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goToOverview = () => {
    window.dispatchEvent(new CustomEvent('mira:navigate', { detail: 'overview' }))
    scrollToId('analysis-section', 'top')
  }

  useEffect(() => {
    const onScroll = () => {
      const analysisTop = getSectionTop('analysis-section')
      const uploadTop = getSectionTop('upload-section')
      const offset = window.innerHeight * 0.35

      if (analysisTop !== null && analysisTop <= offset) {
        setActive('dashboard')
        return
      }

      if (uploadTop !== null && uploadTop <= offset) {
        setActive('insights')
        return
      }

      setActive('home')
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button
        className={`nav-icon ${active === 'home' ? 'active' : ''}`}
        aria-label="Home"
        aria-current={active === 'home' ? 'page' : undefined}
        onClick={goToOverview}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 11.5L12 4l9 7.5"></path>
          <path d="M6 10.5V20h12v-9.5"></path>
        </svg>
      </button>
      <button
        className={`nav-icon ${active === 'insights' ? 'active' : ''}`}
        aria-label="Analyze"
        aria-current={active === 'insights' ? 'page' : undefined}
        onClick={goToOverview}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18h6"></path>
          <path d="M10 14h4"></path>
          <path d="M8.5 9.5a3.5 3.5 0 1 1 7 0c0 2.6-3.5 3.2-3.5 5.5"></path>
        </svg>
      </button>
      <button
        className={`nav-icon ${active === 'dashboard' ? 'active' : ''}`}
        aria-label="Dashboard"
        aria-current={active === 'dashboard' ? 'page' : undefined}
        onClick={goToOverview}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1"></rect>
          <rect x="14" y="4" width="6" height="6" rx="1"></rect>
          <rect x="4" y="14" width="6" height="6" rx="1"></rect>
          <rect x="14" y="14" width="6" height="6" rx="1"></rect>
        </svg>
      </button>
    </nav>
  )
}

export default BottomNav
