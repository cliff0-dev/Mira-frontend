import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const API_KEY = import.meta.env.VITE_API_KEY || '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'

// Global audio cache per conversation
const audioCache = new Map()

/**
 * Hook to manage audio playback with caching
 * Loads full audio file once per conversation and uses currentTime for segment playback
 */
export function useAudioManager(conversationId) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)
  const timeUpdateHandlerRef = useRef(null)
  const currentSegmentRef = useRef(null) // { start, end }

  // Load full audio file if not cached
  const loadAudio = useCallback(async () => {
    if (!conversationId) {
      setError('Conversation ID not available')
      return null
    }

    // Check cache first
    if (audioCache.has(conversationId)) {
      const cached = audioCache.get(conversationId)
      // Check if audio element is still valid
      if (cached.audio && !cached.audio.error) {
        return cached.audio
      } else {
        // Remove invalid cache entry
        audioCache.delete(conversationId)
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch full audio file
      const response = await axios.get(
        `${API_BASE_URL}/conversations/${conversationId}/audio`,
        {
          responseType: 'blob',
          headers: {
            'x-api-key': API_KEY
          }
        }
      )

      // Create audio element from blob
      const audioUrl = URL.createObjectURL(response.data)
      const audio = new Audio(audioUrl)
      
      // Preload audio for instant playback
      audio.preload = 'auto'
      
      // Cache the audio element and URL
      audioCache.set(conversationId, {
        audio,
        url: audioUrl,
        loaded: false
      })

      // Wait for audio to be ready
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          audioCache.get(conversationId).loaded = true
          resolve()
        }
        
        const onError = (e) => {
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          reject(new Error('Failed to load audio'))
        }
        
        audio.addEventListener('canplay', onCanPlay)
        audio.addEventListener('error', onError)
        
        // If already loaded, resolve immediately
        if (audio.readyState >= 3) { // HAVE_FUTURE_DATA
          onCanPlay()
        }
      })

      setIsLoading(false)
      return audio

    } catch (err) {
      console.error('Error loading audio:', err)
      setError(err.response?.data?.detail || 'Failed to load audio')
      setIsLoading(false)
      return null
    }
  }, [conversationId])

  // Play segment by setting currentTime and using timeupdate to stop at end
  const playSegment = useCallback(async (startTime, endTime) => {
    if (!conversationId) {
      setError('Conversation ID not available')
      return false
    }

    // Load audio if not already loaded
    let audio = audioCache.get(conversationId)?.audio
    if (!audio || audio.error) {
      audio = await loadAudio()
      if (!audio) {
        return false
      }
    }

    // Stop any currently playing audio
    if (audioRef.current && audioRef.current !== audio) {
      audioRef.current.pause()
      if (audioRef.current.onended) {
        audioRef.current.onended = null
      }
    }

    // Clear previous timeupdate handler
    if (timeUpdateHandlerRef.current) {
      audio.removeEventListener('timeupdate', timeUpdateHandlerRef.current)
      timeUpdateHandlerRef.current = null
    }

    // Set up new segment
    audioRef.current = audio
    currentSegmentRef.current = { start: startTime, end: endTime }

    // Set start time - this is instant since audio is already loaded!
    audio.currentTime = startTime

    // Create timeupdate handler to stop at end time
    const timeUpdateHandler = () => {
      if (audio.currentTime >= endTime) {
        audio.pause()
        audio.currentTime = endTime
        setIsPlaying(false)
        // Trigger ended event
        if (audio.onended) {
          audio.onended()
        }
      }
    }

    timeUpdateHandlerRef.current = timeUpdateHandler
    audio.addEventListener('timeupdate', timeUpdateHandler)

    // Set up ended handler
    audio.onended = () => {
      if (timeUpdateHandlerRef.current) {
        audio.removeEventListener('timeupdate', timeUpdateHandlerRef.current)
        timeUpdateHandlerRef.current = null
      }
      audio.onended = null
      currentSegmentRef.current = null
      setIsPlaying(false)
    }

    // Play audio
    try {
      await audio.play()
      setIsPlaying(true)
      return true
    } catch (err) {
      console.error('Error playing audio:', err)
      setError('Failed to play audio')
      setIsPlaying(false)
      return false
    }
  }, [conversationId, loadAudio])

  // Stop playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      if (timeUpdateHandlerRef.current) {
        audioRef.current.removeEventListener('timeupdate', timeUpdateHandlerRef.current)
        timeUpdateHandlerRef.current = null
      }
      if (audioRef.current.onended) {
        audioRef.current.onended = null
      }
      currentSegmentRef.current = null
      setIsPlaying(false)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  // Cleanup audio URLs when conversation changes
  useEffect(() => {
    return () => {
      // Don't revoke URLs here - keep them cached for reuse
      // Only cleanup if conversation is being removed
    }
  }, [conversationId])

  return {
    playSegment,
    stop,
    isPlaying, // Now returns state, not function
    isLoading,
    error,
    loadAudio // Expose for preloading
  }
}
