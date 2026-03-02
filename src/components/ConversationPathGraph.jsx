import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './ConversationPathGraph.css'

const PHASE_COLORS = {
  'Open': '#FFFFFF',           // White
  'Premise': '#F44336',        // Red
  'Evaluation': '#FF9800',     // Orange
  'Narrative': '#FFC107',      // Yellow
  'Close': '#2196F3',          // Blue
  'Baseline': '#808080',       // Gray
}

const PHASE_ORDER = ['Open', 'Premise', 'Evaluation', 'Narrative', 'Close', 'Baseline']

function ConversationPathGraph({ statements, duration, speakers, betweenContent = null }) {
  // Zoom state: 0 = full view, 1 = 2x zoom, 2 = 4x zoom, etc.
  const [zoomLevel, setZoomLevel] = useState(0)
  const [zoomCenter, setZoomCenter] = useState(0.5) // 0.0 to 1.0, where to center the zoom
  // Track hover state for tooltip
  const [hoveredBox, setHoveredBox] = useState(null)
  
  // Selection state for click-and-drag
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState(null) // Time in seconds
  const [selectionEnd, setSelectionEnd] = useState(null) // Time in seconds
  const [selectionRect, setSelectionRect] = useState(null) // { left, width } in pixels
  const chartContainerRef = useRef(null)
  const animationFrameRef = useRef(null)

  const interestData = useMemo(() => {
    if (!statements || statements.length === 0) {
      return { dataPoints: [], phaseTransitions: [] }
    }
    
    // Use timestamps directly as they come from backend - no conversion
    // Filter and sort statements
    const validStatements = statements
      .filter(stmt => {
        const start = stmt.start_time
        const end = stmt.end_time
        return start != null && end != null && 
               typeof start === 'number' && typeof end === 'number' &&
               !isNaN(start) && !isNaN(end) &&
               start >= 0 && end > start
      })
      .sort((a, b) => a.start_time - b.start_time)
    
    if (validStatements.length === 0) {
      return { dataPoints: [], phaseTransitions: [] }
    }

    // Use duration directly as it comes from backend - no conversion
    let conversationDuration = duration
    if (!conversationDuration || conversationDuration <= 0 || isNaN(conversationDuration)) {
      const lastStmt = validStatements[validStatements.length - 1]
      conversationDuration = lastStmt.end_time
    }
    
    const speakerIds = [...new Set(validStatements.map(s => s.speaker))].sort()
    const speaker1 = speakerIds[0] || null
    const speaker2 = speakerIds[1] || null

    // Phase base interest ranges (min, max)
    const phaseInterestRanges = {
      'Open': [0.35, 0.50],      // Building interest
      'Premise': [0.50, 0.70],   // Establishing
      'Evaluation': [0.70, 0.90], // High engagement
      'Narrative': [0.60, 0.80], // Maintaining
      'Close': [0.50, 0.65],     // Winding down
      'Baseline': [0.30, 0.50],  // Neutral
    }
    
    // Calculate interest for each statement
    const statementInterests = validStatements.map((stmt, idx) => {
      let phase = stmt.phase || 'Baseline'
      if (phase === 'TopicsOfDiscussion' || phase === 'Value' || 
          phase === 'Voice' || phase === 'Escalation') {
        phase = 'Baseline'
      }
      
      const [phaseMin, phaseMax] = phaseInterestRanges[phase] || [0.4, 0.6]
      const phaseRange = phaseMax - phaseMin
      
      // Base interest from phase (varies within range)
      const phaseProgress = idx / Math.max(1, validStatements.length - 1)
      const phaseVariation = Math.sin(phaseProgress * Math.PI * 2) * 0.1 // Wave within phase
      let baseInterest = phaseMin + (phaseRange * 0.5) + phaseVariation
      
      // Factor 1: Statement length (longer = slightly more interest)
      const textLength = stmt.text?.length || 0
      const lengthBonus = Math.min(textLength / 100, 0.1) // Max 10% bonus
      
      // Factor 2: Response time (quick = higher interest)
      // All timestamps are now normalized to seconds by backend
      let responseBonus = 0
      if (idx > 0) {
        const prevStmt = validStatements[idx - 1]
        const pause = stmt.start_time - prevStmt.end_time
        
        // Thresholds in seconds (since backend normalizes everything to seconds)
        if (pause < 0.5) {
          responseBonus = 0.08 // Quick response
        } else if (pause < 1.0) {
          responseBonus = 0.04
        } else if (pause > 3.0) {
          responseBonus = -0.06 // Slow response
        }
      }
      
      // Factor 3: Engagement signals
      const hasQuestion = stmt.text?.includes('?')
      const hasExclamation = stmt.text?.includes('!')
      const engagementBonus = (hasQuestion ? 0.05 : 0) + (hasExclamation ? 0.03 : 0)
      
      // Factor 4: Conversation progress (interest builds over time)
      const conversationProgress = conversationDuration > 0 ? stmt.start_time / conversationDuration : 0
      const progressBonus = conversationProgress * 0.1 // Up to 10% increase over time
      
      // Calculate final interest
      let interest = baseInterest + lengthBonus + responseBonus + engagementBonus + progressBonus
      
      // Clamp to phase range with some flexibility
      const minInterest = Math.max(0.25, phaseMin - 0.05)
      const maxInterest = Math.min(0.95, phaseMax + 0.05)
      interest = Math.max(minInterest, Math.min(maxInterest, interest))
      
      return {
        statement: stmt,
        phase,
        midpoint: (stmt.start_time + stmt.end_time) / 2,
        interest,
        speaker: stmt.speaker
      }
    })
    
    // Create data points - one per statement at its midpoint
    // This avoids duplicate timestamps and shows actual data
    const dataPoints = statementInterests.map(item => {
      const isSpeaker1 = item.speaker === speaker1
      const isSpeaker2 = item.speaker === speaker2
      
      // When a speaker talks, their interest is higher, other speaker's interest adjusts
      let speaker1Interest = item.interest
      let speaker2Interest = item.interest
      
      if (isSpeaker1) {
        // Speaker1 (ideal) talking - their interest is at calculated level
        speaker1Interest = item.interest
        // Speaker2 (displayed) reacts - slightly lower, more reactive
        speaker2Interest = item.interest * 0.92 + 0.08
      } else if (isSpeaker2) {
        // Speaker2 (displayed) talking - their interest is higher, more expressive
        speaker2Interest = Math.min(0.95, item.interest * 1.05)
        // Speaker1 (ideal) adjusts slightly
        speaker1Interest = item.interest * 0.98
      } else {
        // Other speakers - use base interest for both
        speaker1Interest = item.interest
        speaker2Interest = item.interest
      }
      
      // Ensure values stay in valid range
      speaker1Interest = Math.max(0.25, Math.min(0.95, speaker1Interest))
      speaker2Interest = Math.max(0.25, Math.min(0.95, speaker2Interest))
      
      return {
        time: item.midpoint,
        speaker1Interest: speaker1Interest,
        speaker2Interest: speaker2Interest,
        phase: item.phase
      }
    })
    
    // Calculate phase transitions for the flow diagram
    // Include statements that belong to each phase for tooltip display
    const phaseTransitions = []
    let currentPhase = null
    let phaseStartTime = null
    let phaseEndTime = null
    let phaseStatements = [] // Track statements in current phase
    
    validStatements.forEach((stmt) => {
      let phase = stmt.phase || 'Baseline'
      if (phase === 'TopicsOfDiscussion' || phase === 'Value' || 
          phase === 'Voice' || phase === 'Escalation') {
        phase = 'Baseline'
      }
      
      const startTime = stmt.start_time
      const endTime = stmt.end_time
      
      if (phase !== currentPhase) {
        // Close previous phase
        if (currentPhase !== null && phaseStartTime !== null && phaseEndTime !== null) {
          const phaseDuration = Math.max(phaseEndTime - phaseStartTime, 0.001)
          phaseTransitions.push({
            phase: currentPhase,
            startTime: phaseStartTime,
            endTime: phaseEndTime,
            duration: phaseDuration,
            statements: [...phaseStatements] // Include statements for this phase
          })
        }
        // Start new phase
        currentPhase = phase
        phaseStartTime = startTime
        phaseEndTime = endTime
        phaseStatements = [stmt] // Start new statement list
      } else {
        // Extend current phase
        if (phaseStartTime === null) phaseStartTime = startTime
        phaseEndTime = Math.max(phaseEndTime || startTime, endTime)
        phaseStatements.push(stmt) // Add statement to current phase
      }
    })
    
    // Add final phase
    if (currentPhase !== null && phaseStartTime !== null && phaseEndTime !== null) {
      const phaseDuration = Math.max(phaseEndTime - phaseStartTime, 0.001)
      phaseTransitions.push({
        phase: currentPhase,
        startTime: phaseStartTime,
        endTime: phaseEndTime,
        duration: phaseDuration,
        statements: [...phaseStatements] // Include statements for final phase
      })
    }
    
    return {
      dataPoints: dataPoints,
      phaseTransitions: phaseTransitions,
      conversationDuration: conversationDuration
    }
  }, [statements, duration, speakers])

  // Calculate visible time range based on zoom
  const { visibleDataPoints, visibleStart, visibleEnd } = useMemo(() => {
    if (!interestData.dataPoints.length || !interestData.conversationDuration) {
      return { visibleDataPoints: [], visibleStart: 0, visibleEnd: 0 }
    }

    const totalDuration = interestData.conversationDuration
    const zoomFactor = Math.pow(2, zoomLevel)
    const visibleDuration = totalDuration / zoomFactor
    const centerTime = totalDuration * zoomCenter
    const visibleStart = Math.max(0, centerTime - visibleDuration / 2)
    const visibleEnd = Math.min(totalDuration, centerTime + visibleDuration / 2)

    // Filter data points to visible range
    const visibleDataPoints = interestData.dataPoints.filter(point => 
      point.time >= visibleStart && point.time <= visibleEnd
    )

    return { visibleDataPoints, visibleStart, visibleEnd }
  }, [interestData, zoomLevel, zoomCenter])

  const zoomInfo = useMemo(
    () => ({ visibleStart, visibleEnd, zoomLevel }),
    [visibleStart, visibleEnd, zoomLevel]
  )

  // Zoom handlers
  const handleZoomIn = () => {
    if (zoomLevel < 4) { // Max 16x zoom
      setZoomLevel(zoomLevel + 1)
    }
  }

  const handleZoomOut = () => {
    if (zoomLevel > 0) {
      setZoomLevel(zoomLevel - 1)
    } else {
      setZoomCenter(0.5)
    }
  }

  const handleResetZoom = () => {
    setZoomLevel(0)
    setZoomCenter(0.5)
    setSelectionStart(null)
    setSelectionEnd(null)
    setSelectionRect(null)
  }

  // Convert mouse X position to time value
    // Uses actual chart margins from LineChart margin prop: { top: 20, right: 30, left: 50, bottom: 60 }
  const pixelToTime = useCallback((pixelX, containerWidth) => {
    if (!interestData.conversationDuration || !containerWidth) return 0
    
    const totalDuration = interestData.conversationDuration
    const zoomFactor = Math.pow(2, zoomLevel)
    const visibleDuration = totalDuration / zoomFactor
    const centerTime = totalDuration * zoomCenter
    const visibleStart = Math.max(0, centerTime - visibleDuration / 2)
    const visibleEnd = Math.min(totalDuration, centerTime + visibleDuration / 2)
    
    // Calculate time based on pixel position
    // Account for actual chart margins: left: 50px, right: 30px
    const leftMargin = 50
    const rightMargin = 30
    const chartWidth = containerWidth - leftMargin - rightMargin
    
    // Clamp pixelX to chart area
    const clampedPixelX = Math.max(leftMargin, Math.min(containerWidth - rightMargin, pixelX))
    const pixelRatio = (clampedPixelX - leftMargin) / chartWidth
    const time = visibleStart + (pixelRatio * (visibleEnd - visibleStart))
    
    return Math.max(0, Math.min(totalDuration, time))
  }, [interestData, zoomLevel, zoomCenter])

  // Handle mouse down - start selection
  const handleMouseDown = useCallback((e) => {
    if (!chartContainerRef.current) return
    
    const rect = chartContainerRef.current.getBoundingClientRect()
    const pixelX = e.clientX - rect.left
    const containerWidth = rect.width
    const time = pixelToTime(pixelX, containerWidth)
    
    setIsSelecting(true)
    setSelectionStart(time)
    setSelectionEnd(time)
    setSelectionRect({ left: pixelX, width: 0 })
  }, [pixelToTime])

  // Handle mouse move - update selection with smooth animation
  const handleMouseMove = useCallback((e) => {
    if (!isSelecting || !chartContainerRef.current || !selectionStart) return
    
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      if (!chartContainerRef.current || !selectionStart) return
      
      const rect = chartContainerRef.current.getBoundingClientRect()
      const pixelX = e.clientX - rect.left
      const containerWidth = rect.width
      const time = pixelToTime(pixelX, containerWidth)
      
      setSelectionEnd(time)
      
      // Update selection rectangle
      const totalDuration = interestData.conversationDuration
      const zoomFactor = Math.pow(2, zoomLevel)
      const visibleDuration = totalDuration / zoomFactor
      const centerTime = totalDuration * zoomCenter
      const visStart = Math.max(0, centerTime - visibleDuration / 2)
      const visEnd = Math.min(totalDuration, centerTime + visibleDuration / 2)
      
      // Use actual chart margins: left: 50px, right: 30px
      const leftMargin = 50
      const rightMargin = 30
      const chartWidth = containerWidth - leftMargin - rightMargin
      
      const startPixel = ((selectionStart - visStart) / (visEnd - visStart)) * chartWidth + leftMargin
      const endPixel = ((time - visStart) / (visEnd - visStart)) * chartWidth + leftMargin
      
      const left = Math.min(startPixel, endPixel)
      const width = Math.abs(endPixel - startPixel)
      setSelectionRect({ left, width })
    })
  }, [isSelecting, selectionStart, pixelToTime, zoomLevel, zoomCenter, interestData])

  // Handle mouse up - complete selection and zoom
  const handleMouseUp = useCallback(() => {
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false)
      return
    }
    
    const startTime = Math.min(selectionStart, selectionEnd)
    const endTime = Math.max(selectionStart, selectionEnd)
    const selectionDuration = endTime - startTime
    
    // Only zoom if selection is meaningful (at least 1% of total duration)
    if (selectionDuration > interestData.conversationDuration * 0.01) {
      // Calculate zoom level needed to show this selection
      const totalDuration = interestData.conversationDuration
      const targetZoomFactor = totalDuration / selectionDuration
      
      // Find appropriate zoom level (2^zoomLevel should be close to targetZoomFactor)
      let newZoomLevel = Math.floor(Math.log2(targetZoomFactor))
      newZoomLevel = Math.max(0, Math.min(4, newZoomLevel)) // Clamp to valid range
      
      // Calculate center point for the selection
      const centerTime = (startTime + endTime) / 2
      const newZoomCenter = centerTime / totalDuration
      
      setZoomLevel(newZoomLevel)
      setZoomCenter(newZoomCenter)
    }
    
    // Clear selection
    setIsSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
    setSelectionRect(null)
  }, [isSelecting, selectionStart, selectionEnd, interestData])

  // Handle escape key to cancel selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSelecting) {
        setIsSelecting(false)
        setSelectionStart(null)
        setSelectionEnd(null)
        setSelectionRect(null)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelecting])


  const speakerIds = [...new Set(statements.map(s => s.speaker))].sort()
  const speaker1Name = speakerIds[0] ? getSpeakerName(speakerIds[0]) : "Speaker 1"
  const speaker2Name = speakerIds[1] ? getSpeakerName(speakerIds[1]) : "Speaker 2"

  if (!interestData.dataPoints.length) {
    return (
      <div className="conversation-path-graph">
        <div className="graph-header">
          <h3>Conversation Path</h3>
          <p>Direction the conversation took over time with perceived interest levels</p>
        </div>
        <div className="graph-empty">
          <p>No data available for conversation path</p>
        </div>
      </div>
    )
  }

  return (
    <div className="conversation-path-graph">
      <div className="graph-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div>
        <h3>Conversation Path</h3>
        <p>Direction the conversation took over time with perceived interest levels</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              onClick={handleZoomOut}
              disabled={zoomLevel === 0}
                style={{ 
                  padding: '0.25rem 0.5rem', 
                  border: '1px solid rgba(148, 163, 184, 0.3)', 
                  borderRadius: '4px',
                  background: zoomLevel === 0 ? 'rgba(148, 163, 184, 0.12)' : 'rgba(12, 18, 30, 0.9)',
                  cursor: zoomLevel === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  color: zoomLevel === 0 ? 'rgba(148, 163, 184, 0.6)' : '#e2e8f0'
                }}
              title="Zoom Out"
            >
              −
            </button>
            <span style={{ fontSize: '0.875rem', minWidth: '3rem', textAlign: 'center' }}>
              {zoomLevel === 0 ? '1x' : `${Math.pow(2, zoomLevel)}x`}
            </span>
            <button 
              onClick={handleZoomIn}
              disabled={zoomLevel >= 4}
                style={{ 
                  padding: '0.25rem 0.5rem', 
                  border: '1px solid rgba(148, 163, 184, 0.3)', 
                  borderRadius: '4px',
                  background: zoomLevel >= 4 ? 'rgba(148, 163, 184, 0.12)' : 'rgba(12, 18, 30, 0.9)',
                  cursor: zoomLevel >= 4 ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  color: zoomLevel >= 4 ? 'rgba(148, 163, 184, 0.6)' : '#e2e8f0'
                }}
              title="Zoom In"
            >
              +
            </button>
            {zoomLevel > 0 && (
              <button 
                onClick={handleResetZoom}
                style={{ 
                  padding: '0.25rem 0.5rem', 
                  border: '1px solid rgba(148, 163, 184, 0.3)', 
                  borderRadius: '4px',
                  background: 'rgba(12, 18, 30, 0.9)',
                  cursor: 'pointer',
                  marginLeft: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#e2e8f0'
                }}
                title="Reset Zoom"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="graph-container">
        {/* Interest Level Lines Chart */}
        <div 
          className={`interest-chart-section ${isSelecting ? 'selecting' : ''}`}
          ref={chartContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Selection hint text */}
          {!isSelecting && zoomLevel === 0 && (
            <div className="selection-hint">
              Click and drag on the interest graph to zoom into a time range (e.g., 1:00-2:04)
            </div>
          )}
          {/* Show selected time range while dragging */}
          {isSelecting && selectionStart !== null && selectionEnd !== null && (
            <div className="selection-time-display">
              {formatTime(Math.min(selectionStart, selectionEnd))} - {formatTime(Math.max(selectionStart, selectionEnd))}
            </div>
          )}
          {/* Selection rectangle overlay with handles */}
          {selectionRect && selectionRect.width > 0 && (
            <>
              <div
                className="selection-rectangle"
                style={{
                  position: 'absolute',
                  left: `${selectionRect.left}px`,
                  top: '20px',
                  width: `${selectionRect.width}px`,
                  height: '380px',
                  pointerEvents: 'none',
                  zIndex: 100,
                }}
              />
              {/* Left handle */}
              <div
                className="selection-handle selection-handle-left"
                style={{
                  position: 'absolute',
                  left: `${selectionRect.left}px`,
                  top: '20px',
                  height: '380px',
                  pointerEvents: 'none',
                  zIndex: 101,
                }}
              />
              {/* Right handle */}
              <div
                className="selection-handle selection-handle-right"
                style={{
                  position: 'absolute',
                  left: `${selectionRect.left + selectionRect.width}px`,
                  top: '20px',
                  height: '380px',
                  pointerEvents: 'none',
                  zIndex: 101,
                }}
              />
            </>
          )}
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={visibleDataPoints.length > 0 ? visibleDataPoints : interestData.dataPoints}
              margin={{ top: 20, right: 30, left: 50, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="time" 
                type="number"
                scale="linear"
                domain={zoomLevel > 0 ? [visibleStart, visibleEnd] : ['dataMin', 'dataMax']}
                tickFormatter={(value) => formatTime(value)}
                label={{ value: 'Time', position: 'insideBottom', offset: -10 }}
                ticks={zoomLevel > 0 ? generateSmartTicks(visibleDataPoints) : generateSmartTicks(interestData.dataPoints)}
              />
              <YAxis 
                domain={[0, 1.0]}
                tickFormatter={(value) => `${Math.round(value * 100)}`}
                label={{ value: 'Interest Level (0-100)', angle: -90, position: 'insideLeft', offset: -5 }}
              />
              <Tooltip 
                formatter={(value, name) => [
                  `${(value * 100).toFixed(1)}`,
                  name === 'speaker1Interest' ? speaker1Name : speaker2Name
                ]}
                labelFormatter={(value) => `Time: ${formatTime(value)}`}
              />
                <Legend 
                  formatter={(value) => {
                    if (value === 'speaker1Interest') return "Person 1 level of interest"
                    if (value === 'speaker2Interest') return "Person 2 level of interest"
                    return value
                  }}
                />
              <Line
                type="monotone"
                dataKey="speaker1Interest"
                stroke="#FF9800"
                strokeWidth={3}
                dot={false}
                name="speaker1Interest"
              />
              <Line
                type="monotone"
                dataKey="speaker2Interest"
                stroke="#2196F3"
                strokeWidth={3}
                dot={false}
                name="speaker2Interest"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {betweenContent ? (
          <div className="graph-between">
            {typeof betweenContent === 'function' ? betweenContent(zoomInfo) : betweenContent}
          </div>
        ) : null}

        {/* Phase Flow with Arrows */}
        <div 
          className="phase-flow-section"
          style={{ overflow: 'visible' }}
        >
          <h4 className="phase-flow-title">Conversation Flow</h4>
          <div 
            className="phase-flow-container"
            style={{ overflow: 'visible' }}
          >
            {(() => {
              // When zoomed out (zoomLevel = 0), show ALL transitions to match the full graph
              // When zoomed in, filter to visible time range
              const visibleTransitions = zoomLevel > 0 
                ? interestData.phaseTransitions.filter(transition => 
                    (transition.startTime >= visibleStart && transition.startTime <= visibleEnd) ||
                    (transition.endTime >= visibleStart && transition.endTime <= visibleEnd) ||
                    (transition.startTime <= visibleStart && transition.endTime >= visibleEnd)
                  )
                : interestData.phaseTransitions // Show all when fully zoomed out
              
              // Calculate the total duration for the visible transitions
              const totalDuration = zoomLevel > 0 
                ? (visibleEnd - visibleStart)
                : interestData.conversationDuration
              
              // Calculate the start time for the visible range
              const rangeStartTime = zoomLevel > 0 ? visibleStart : 0
              
              // Always use absolute positioning for proportional layout (aligns with graph)
              // When zoomed in, filter to visible range and calculate relative to that range
              // When zoomed out, show all transitions relative to full duration
              
              return visibleTransitions.length === 0 ? (
                <div className="phase-flow-placeholder">
                  <p>No phase transitions detected</p>
                </div>
              ) : (
                // Always use absolute positioning to stay synchronized with graph
                <div 
                  className="phase-flow-absolute"
                  style={{ 
                    position: 'relative',
                    width: '100%',
                    height: '80px',
                    padding: '10px 0',
                    overflow: 'visible' // Allow tooltips to overflow
                  }}
                >
                  {visibleTransitions.map((transition, idx) => {
                    const phaseColor = PHASE_COLORS[transition.phase] || '#999'
                    const nextTransition = visibleTransitions[idx + 1]
                    
                    // Calculate position and width as percentages of visible duration
                    // This ensures synchronization with the graph zoom level
                    const leftPercent = ((transition.startTime - rangeStartTime) / totalDuration) * 100
                    const widthPercent = (transition.duration / totalDuration) * 100
                    
                    // Use the calculated width, but ensure it's at least 0.3% for very short phases
                    const finalWidthPercent = Math.max(0.3, widthPercent)
                    
                    // Create unique key for this box
                    const boxKey = `${transition.phase}-${transition.startTime}-${idx}`
                    const isHovered = hoveredBox === boxKey
                    const transitionStatements = transition.statements || []
                    
                    // Get unique speakers in this phase
                    const speakersInPhase = [...new Set(transitionStatements.map(s => s.speaker))]
                    const speakerNames = speakersInPhase.map(speakerId => getSpeakerName(speakerId)).join(', ')
                    
                    // Get statement texts (limit to first 3 for tooltip)
                    const statementTexts = transitionStatements.slice(0, 3).map(s => s.text || '').filter(Boolean)
                    const hasMoreStatements = transitionStatements.length > 3
                    
                    return (
                      <div 
                        key={`node-${idx}`}
                        className="phase-node-absolute"
                        style={{ 
                          position: 'absolute',
                          left: `${leftPercent}%`,
                          width: `${finalWidthPercent}%`,
                          backgroundColor: phaseColor,
                          borderColor: phaseColor
                        }}
                        onMouseEnter={() => setHoveredBox(boxKey)}
                        onMouseLeave={() => setHoveredBox(null)}
                      >
                        {/* Tooltip (shown on hover) */}
                        {isHovered && (
                          <div 
                            className="phase-tooltip"
                            style={{
                              zIndex: 10000,
                              overflow: 'visible',
                              position: 'absolute'
                            }}
                          >
                            <div 
                              className="phase-tooltip-content"
                              style={{
                                overflow: 'visible',
                                maxHeight: 'none',
                                display: 'block'
                              }}
                            >
                              {/* Phase/Classification Name */}
                              <div className="phase-tooltip-name">
                                {transition.phase || 'Unknown Phase'}
                              </div>
                              
                              {/* Speaker names */}
                              {speakerNames && (
                                <div className="phase-tooltip-speaker">
                                  <strong>Speaker(s):</strong> {speakerNames}
                                </div>
                              )}
                              
                              {/* Metadata - Time and Duration */}
                              <div className="phase-tooltip-metadata">
                                <div className="phase-tooltip-time">
                                  <strong>Start Time:</strong> {formatTime(transition.startTime)}
                                </div>
                                <div className="phase-tooltip-time">
                                  <strong>End Time:</strong> {formatTime(transition.endTime)}
                                </div>
                                <div className="phase-tooltip-duration">
                                  <strong>Duration:</strong> {formatDuration(transition.duration)}
                                </div>
                                {transitionStatements.length > 0 && (
                                  <div className="phase-tooltip-count">
                                    <strong>Statements:</strong> {transitionStatements.length} statement{transitionStatements.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                              
                              {/* Statement texts */}
                              {statementTexts.length > 0 && (
                                <div className="phase-tooltip-statements">
                                  <strong>Sample Statements:</strong>
                                  {statementTexts.map((text, textIdx) => (
                                    <div key={textIdx} className="phase-tooltip-statement-text">
                                      "{text.length > 100 ? text.substring(0, 100) + '...' : text}"
                                    </div>
                                  ))}
                                  {hasMoreStatements && (
                                    <div className="phase-tooltip-more">
                                      +{transitionStatements.length - 3} more statement(s)
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {/* Render arrows separately to avoid nesting issues */}
                  {visibleTransitions.map((transition, idx) => {
                    const nextTransition = visibleTransitions[idx + 1]
                    const phaseColor = PHASE_COLORS[transition.phase] || '#999'
                    
                    if (!nextTransition || nextTransition.startTime <= transition.endTime) {
                      return null
                    }
                    
                    return (
                      <div
                        key={`arrow-${idx}`}
                        className="phase-arrow-absolute"
                        style={{
                          position: 'absolute',
                          left: `${((transition.endTime - rangeStartTime) / totalDuration) * 100}%`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: `${((nextTransition.startTime - transition.endTime) / totalDuration) * 100}%`,
                          height: '4px',
                          minWidth: '5px'
                        }}
                      >
                        <svg 
                          width="100%" 
                          height="100%" 
                          viewBox="0 0 100 4"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <marker
                              id={`arrowhead-abs-${idx}`}
                              markerWidth="8"
                              markerHeight="8"
                              refX="8"
                              refY="2"
                              orient="auto"
                            >
                              <polygon points="0 0, 8 2, 0 4" fill={phaseColor} />
                            </marker>
                          </defs>
                          <line
                            x1="0"
                            y1="2"
                            x2="100"
                            y2="2"
                            stroke={phaseColor}
                            strokeWidth="3"
                            markerEnd={`url(#arrowhead-abs-${idx})`}
                          />
                        </svg>
                      </div>
                    )
                  })}
                  {/* Render arrows separately to avoid nesting issues */}
                  {visibleTransitions.map((transition, idx) => {
                    const nextTransition = visibleTransitions[idx + 1]
                    const phaseColor = PHASE_COLORS[transition.phase] || '#999'
                    
                    if (!nextTransition || nextTransition.startTime <= transition.endTime) {
                      return null
                    }
                    
                    return (
                      <div
                        key={`arrow-${idx}`}
                        className="phase-arrow-absolute"
                        style={{
                          position: 'absolute',
                          left: `${((transition.endTime - rangeStartTime) / totalDuration) * 100}%`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: `${((nextTransition.startTime - transition.endTime) / totalDuration) * 100}%`,
                          height: '4px',
                          minWidth: '5px'
                        }}
                      >
                        <svg 
                          width="100%" 
                          height="100%" 
                          viewBox="0 0 100 4"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <marker
                              id={`arrowhead-abs-${idx}`}
                              markerWidth="8"
                              markerHeight="8"
                              refX="8"
                              refY="2"
                              orient="auto"
                            >
                              <polygon points="0 0, 8 2, 0 4" fill={phaseColor} />
                            </marker>
                          </defs>
                          <line
                            x1="0"
                            y1="2"
                            x2="100"
                            y2="2"
                            stroke={phaseColor}
                            strokeWidth="3"
                            markerEnd={`url(#arrowhead-abs-${idx})`}
                          />
                        </svg>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

// Generate smart ticks to avoid duplicates
function generateSmartTicks(dataPoints) {
  if (!dataPoints || dataPoints.length === 0) return []
  
  const times = dataPoints.map(p => p.time).filter(t => t != null && !isNaN(t))
  if (times.length === 0) return []
  
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const timeRange = maxTime - minTime
  
  // Generate 8-12 ticks evenly spaced
  const numTicks = Math.min(12, Math.max(8, Math.ceil(timeRange / 10)))
  const tickInterval = timeRange / (numTicks - 1)
  
  const ticks = []
  for (let i = 0; i < numTicks; i++) {
    const tickValue = minTime + (i * tickInterval)
    // Round to avoid floating point issues
    ticks.push(Math.round(tickValue * 100) / 100)
  }
  
  return ticks
}

function getSpeakerName(speakerId) {
  const match = speakerId?.match(/spk_(\d+)/)
  if (match) {
    const num = parseInt(match[1])
    return `Speaker ${num + 1}`
  }
  return speakerId || "Speaker"
}

// Format time - backend now normalizes everything to seconds
function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00"
  
  // Round to nearest second for cleaner display
  const roundedSeconds = Math.round(seconds)
  
  const mins = Math.floor(roundedSeconds / 60)
  const secs = roundedSeconds % 60
  
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Format duration - backend now normalizes everything to seconds
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0s"
  
  const roundedSeconds = Math.round(seconds * 10) / 10 // Round to 1 decimal
  
  // If less than 1 second, show as milliseconds
  if (roundedSeconds < 1) {
    return `${(roundedSeconds * 1000).toFixed(0)}ms`
  }
  
  const mins = Math.floor(roundedSeconds / 60)
  const secs = Math.floor(roundedSeconds % 60)
  const ms = Math.floor((roundedSeconds % 1) * 10) // First decimal place
  
  if (mins > 0) {
    return `${mins}m ${secs}s`
  } else if (secs > 0) {
    if (ms > 0) {
      return `${secs}.${ms}s`
  }
  return `${secs}s`
  } else {
    return `${roundedSeconds.toFixed(1)}s`
  }
}

export default ConversationPathGraph
