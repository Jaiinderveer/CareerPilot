/**
 * Voice interview hook for CareerPilot.
 *
 * DEMO mode: Uses Web Speech API (browser-native, no API keys required)
 * LIVE mode: Uses ElevenLabs via backend token (when backend is configured)
 *
 * This hook does NOT fake AI evaluation — it only handles audio I/O.
 * The interview orchestration and evaluation remain in InterviewRoom.jsx.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchSttToken } from '../services/interviewService'

// Check browser support for Web Speech API
const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const isSpeechRecognitionSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

/**
 * Voice interview states
 */
export const VOICE_STATES = Object.freeze({
  IDLE: 'idle',
  SPEAKING: 'speaking', // AI is speaking the question
  LISTENING: 'listening', // Recording candidate's answer
  PROCESSING: 'processing', // Transcribing / evaluating
  ERROR: 'error',
})

/**
 * Voice mode configuration
 */
export const VOICE_MODES = Object.freeze({
  DEMO: 'demo', // Browser Web Speech API
  LIVE: 'live', // ElevenLabs via backend
})

/**
 * Get the best available voice for speech synthesis
 */
function getBestVoice() {
  if (!isSpeechSynthesisSupported) return null

  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  // Prefer English voices, then any available
  const englishVoices = voices.filter(
    (v) => v.lang.startsWith('en-') && !v.name.toLowerCase().includes('novelty')
  )

  // Prefer female voices for interviewer persona (common UX pattern)
  const femaleVoice = englishVoices.find(
    (v) =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria') ||
      v.name.toLowerCase().includes('karen') ||
      v.name.toLowerCase().includes('moira')
  )

  return femaleVoice || englishVoices[0] || voices[0]
}

/**
 * Create a SpeechRecognition instance
 */
function createSpeechRecognition() {
  if (!isSpeechRecognitionSupported) return null

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()

  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'
  recognition.maxAlternatives = 1

  return recognition
}

export function buildRealtimeSttUrl(websocketUrl, token) {
  const wsUrl = new URL(
    websocketUrl || 'wss://api.elevenlabs.io/v1/speech-to-text/realtime'
  )
  wsUrl.searchParams.set('token', token)
  wsUrl.searchParams.set('model_id', 'scribe_v3_live')
  wsUrl.searchParams.set('language_code', 'en')
  wsUrl.searchParams.set('audio_format', 'pcm_16000')
  wsUrl.searchParams.set('commit_strategy', 'manual')
  return wsUrl.toString()
}

export function buildRealtimeAudioMessage(audioBase64, commit = false) {
  return {
    message_type: 'input_audio_chunk',
    audio_base_64: audioBase64,
    commit,
    sample_rate: 16000,
  }
}

export function isAutoplayBlockedError(error) {
  return error?.name === 'NotAllowedError'
}

/**
 * Voice interview hook
 *
 * @param {Object} options
 * @param {string} options.mode - VOICE_MODES.DEMO or VOICE_MODES.LIVE
 * @param {string} options.interviewId - Interview ID for LIVE mode TTS endpoint
 * @param {string} options.accessToken - Auth token for LIVE mode API calls
 * @param {Function} options.onTranscriptReady - Called with final transcript when recording stops
 * @param {Function} options.onError - Called on voice errors
 */
export function useVoiceInterview({
  mode = VOICE_MODES.DEMO,
  interviewId,
  accessToken,
  onTranscriptReady,
  onError,
} = {}) {
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  // Refs for DEMO mode
  const recognitionRef = useRef(null)
  const utteranceRef = useRef(null)
  const voiceRef = useRef(null)

  // Refs for LIVE mode
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const livePlaybackRef = useRef(null)
  const livePlaybackCancelRef = useRef(null)
  const liveTtsAbortRef = useRef(null)
  const wsRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const processorRef = useRef(null)
  const currentTurnIdRef = useRef(null)
  const sttFinalizeRef = useRef(null)
  const sttTimeoutRef = useRef(null)
  const isMountedRef = useRef(true)

  // Initialize voice support check
  useEffect(() => {
    isMountedRef.current = true

    if (mode === VOICE_MODES.DEMO) {
      const supported = isSpeechSynthesisSupported && isSpeechRecognitionSupported
      setIsSupported(supported)

      // Load voices (they load asynchronously in some browsers)
      if (isSpeechSynthesisSupported) {
        const loadVoices = () => {
          voiceRef.current = getBestVoice()
        }

        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
      }
    } else {
      // LIVE mode support depends on backend availability and microphone access
      // Mark as supported; actual availability checked during API calls
      setIsSupported(true)
    }

    return () => {
      isMountedRef.current = false
      // Cleanup
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
      if (isSpeechSynthesisSupported) {
        window.speechSynthesis.cancel()
      }
      // LIVE mode cleanup
      cleanupLiveAudio()
      cleanupLiveSTT()
    }
  }, [mode])

  /**
   * Cleanup LIVE mode audio resources
   */
  const cleanupLiveAudio = useCallback(() => {
    if (liveTtsAbortRef.current) {
      liveTtsAbortRef.current.abort()
      liveTtsAbortRef.current = null
    }
    livePlaybackRef.current = null
    if (livePlaybackCancelRef.current) {
      livePlaybackCancelRef.current()
      livePlaybackCancelRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.onplaying = null
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  /**
   * Cleanup LIVE mode STT resources
   */
  const cleanupLiveSTT = useCallback(() => {
    sttFinalizeRef.current = null
    if (sttTimeoutRef.current) {
      clearTimeout(sttTimeoutRef.current)
      sttTimeoutRef.current = null
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'User ended session')
      }
      wsRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
  }, [])

  /**
   * Speak text using TTS
   * DEMO mode: Web Speech API
   * LIVE mode: ElevenLabs via backend TTS endpoint
   */
  const speak = useCallback(
    async (text, turnId) => {
      if (!text?.trim()) return

      if (
        mode === VOICE_MODES.LIVE &&
        livePlaybackRef.current?.turnId === turnId
      ) {
        return livePlaybackRef.current.promise || undefined
      }

      setVoiceState(VOICE_STATES.SPEAKING)
      setErrorMessage(null)

      if (mode === VOICE_MODES.DEMO) {
        if (!isSpeechSynthesisSupported) {
          setErrorMessage('Speech synthesis not supported in this browser')
          setVoiceState(VOICE_STATES.ERROR)
          onError?.('Speech synthesis not supported')
          return
        }

        return new Promise((resolve, reject) => {
          // Cancel any ongoing speech
          window.speechSynthesis.cancel()

          const utterance = new SpeechSynthesisUtterance(text)
          utteranceRef.current = utterance

          // Configure voice
          if (voiceRef.current) {
            utterance.voice = voiceRef.current
          }
          utterance.rate = 0.95 // Slightly slower for interview clarity
          utterance.pitch = 1.0
          utterance.volume = 1.0

          utterance.onend = () => {
            if (isMountedRef.current) {
              setVoiceState(VOICE_STATES.IDLE)
            }
            resolve()
          }

          utterance.onerror = (event) => {
            // 'canceled' is not a real error — it means we intentionally stopped
            if (event.error === 'canceled') {
              if (isMountedRef.current) {
                setVoiceState(VOICE_STATES.IDLE)
              }
              resolve()
              return
            }

            if (isMountedRef.current) {
              setErrorMessage(`Speech error: ${event.error}`)
              setVoiceState(VOICE_STATES.ERROR)
            }
            onError?.(event.error)
            reject(new Error(event.error))
          }

          window.speechSynthesis.speak(utterance)
        })
      } else {
        // LIVE mode: Fetch audio from backend TTS endpoint
        if (!interviewId || !turnId || !accessToken) {
          setErrorMessage('Missing interview context for live TTS')
          setVoiceState(VOICE_STATES.ERROR)
          onError?.('Missing interview context')
          return
        }

        // Replace any older turn's request/audio and track this attempt.
        cleanupLiveAudio()
        currentTurnIdRef.current = turnId
        const abortController = new AbortController()
        liveTtsAbortRef.current = abortController

        const playbackAttempt = {
          turnId,
          promise: null,
        }
        livePlaybackRef.current = playbackAttempt

        const playbackPromise = (async () => {
          try {
            const apiBaseUrl =
              String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '') ||
              (import.meta.env.DEV ? 'http://localhost:8000' : '')

            const response = await fetch(
              `${apiBaseUrl}/api/interviews/${interviewId}/turns/${turnId}/audio`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: 'audio/mpeg',
                },
                signal: abortController.signal,
              }
            )

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.detail || `TTS request failed: ${response.status}`)
            }

            if (currentTurnIdRef.current !== turnId || !isMountedRef.current) {
              return
            }

            const audioBlob = await response.blob()
            const audioUrl = URL.createObjectURL(audioBlob)
            if (currentTurnIdRef.current !== turnId || !isMountedRef.current) {
              URL.revokeObjectURL(audioUrl)
              return
            }
            audioUrlRef.current = audioUrl

            const audio = new Audio(audioUrl)
            audioRef.current = audio

            await new Promise((resolve, reject) => {
              const settle = (callback, value) => {
                if (livePlaybackCancelRef.current === cancelPlayback) {
                  livePlaybackCancelRef.current = null
                }
                callback(value)
              }
              const cancelPlayback = () => resolve()
              livePlaybackCancelRef.current = cancelPlayback

              audio.onplaying = () => {
                if (isMountedRef.current && currentTurnIdRef.current === turnId) {
                  setErrorMessage(null)
                  setVoiceState(VOICE_STATES.SPEAKING)
                }
              }
              audio.onended = () => settle(resolve)
              audio.onerror = () => settle(reject, new Error('Failed to play audio'))

              audio.play().catch((error) => settle(reject, error))
            })

            const isCurrentTurn = currentTurnIdRef.current === turnId
            cleanupLiveAudio()
            if (isMountedRef.current && isCurrentTurn) {
              setVoiceState(VOICE_STATES.IDLE)
            }
          } catch (err) {
            if (err?.name === 'AbortError') return

            if (isAutoplayBlockedError(err)) {
              // Expected browser policy outcome. Keep the manual button available
              // without showing a persistent false failure.
              const isCurrentTurn = currentTurnIdRef.current === turnId
              cleanupLiveAudio()
              if (isMountedRef.current && isCurrentTurn) {
                setErrorMessage(null)
                setVoiceState(VOICE_STATES.IDLE)
              }
              return
            }

            const isCurrentTurn = currentTurnIdRef.current === turnId
            cleanupLiveAudio()
            if (isMountedRef.current && isCurrentTurn) {
              setErrorMessage(err.message || 'Failed to play audio')
              setVoiceState(VOICE_STATES.ERROR)
            }
            onError?.(err.message || 'Audio playback failed')
          } finally {
            if (liveTtsAbortRef.current === abortController) {
              liveTtsAbortRef.current = null
            }
            if (livePlaybackRef.current === playbackAttempt) {
              livePlaybackRef.current = null
            }
          }
        })()

        playbackAttempt.promise = playbackPromise
        return playbackPromise
      }
    },
    [mode, interviewId, accessToken, onError, cleanupLiveAudio]
  )

  /**
   * Stop speaking
   */
  const stopSpeaking = useCallback(() => {
    if (mode === VOICE_MODES.DEMO && isSpeechSynthesisSupported) {
      window.speechSynthesis.cancel()
    } else if (mode === VOICE_MODES.LIVE) {
      cleanupLiveAudio()
    }
    setVoiceState(VOICE_STATES.IDLE)
  }, [mode, cleanupLiveAudio])

  /**
   * Start listening / recording
   * DEMO mode: Web Speech API
   * LIVE mode: ElevenLabs real-time STT via WebSocket
   */
  const startListening = useCallback(async () => {
    setErrorMessage(null)
    setTranscript('')
    setInterimTranscript('')

    if (mode === VOICE_MODES.DEMO) {
      if (!isSpeechRecognitionSupported) {
        setErrorMessage('Speech recognition not supported in this browser')
        setVoiceState(VOICE_STATES.ERROR)
        onError?.('Speech recognition not supported')
        return
      }

      const recognition = createSpeechRecognition()
      if (!recognition) {
        setErrorMessage('Failed to create speech recognition')
        setVoiceState(VOICE_STATES.ERROR)
        onError?.('Failed to create speech recognition')
        return
      }

      recognitionRef.current = recognition

      let finalTranscript = ''

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' '
            setTranscript(finalTranscript.trim())
          } else {
            interim += result[0].transcript
          }
        }
        setInterimTranscript(interim)
      }

      recognition.onerror = (event) => {
        // 'no-speech' and 'aborted' are not critical errors
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return
        }

        setErrorMessage(`Recognition error: ${event.error}`)
        setVoiceState(VOICE_STATES.ERROR)
        onError?.(event.error)
      }

      recognition.onend = () => {
        // If we're still in LISTENING state, the recognition ended unexpectedly
        // This can happen due to silence timeout — restart if needed
        if (voiceState === VOICE_STATES.LISTENING && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch (e) {
            // Recognition might have been explicitly stopped
          }
        }
      }

      try {
        recognition.start()
        setVoiceState(VOICE_STATES.LISTENING)
      } catch (e) {
        setErrorMessage('Failed to start speech recognition')
        setVoiceState(VOICE_STATES.ERROR)
        onError?.('Failed to start speech recognition')
      }
    } else {
      // LIVE mode: ElevenLabs real-time STT via WebSocket
      if (!accessToken) {
        setErrorMessage('Authentication required for live STT')
        setVoiceState(VOICE_STATES.ERROR)
        onError?.('Authentication required')
        return
      }

      try {
        // 1. Request microphone permission with echo cancellation
        let stream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 16000,
            },
          })
        } catch (micErr) {
          setErrorMessage('Microphone access denied')
          setVoiceState(VOICE_STATES.ERROR)
          onError?.('Microphone permission denied')
          return
        }
        mediaStreamRef.current = stream

        // 2. Fetch single-use STT token from backend
        let tokenData
        try {
          tokenData = await fetchSttToken(accessToken)
        } catch (tokenErr) {
          cleanupLiveSTT()
          setErrorMessage('Failed to get STT token')
          setVoiceState(VOICE_STATES.ERROR)
          onError?.('STT token fetch failed')
          return
        }

        if (!tokenData?.token) {
          cleanupLiveSTT()
          setErrorMessage('Invalid STT token received')
          setVoiceState(VOICE_STATES.ERROR)
          onError?.('Invalid STT token')
          return
        }

        // 3. Connect to ElevenLabs WebSocket with single-use token
        const ws = new WebSocket(
          buildRealtimeSttUrl(tokenData.websocket_url, tokenData.token)
        )
        wsRef.current = ws

        let committedTranscript = ''

        ws.onopen = () => {
          if (!isMountedRef.current) {
            ws.close()
            return
          }
          setVoiceState(VOICE_STATES.LISTENING)

          // 4. Set up audio processing
          const audioContext = new AudioContext({ sampleRate: 16000 })
          audioContextRef.current = audioContext

          const source = audioContext.createMediaStreamSource(stream)
          const processor = audioContext.createScriptProcessor(4096, 1, 1)
          processorRef.current = processor

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return

            const inputData = e.inputBuffer.getChannelData(0)
            // Convert Float32 to 16-bit PCM
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]))
              pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
            }

            // Send audio chunk as base64
            const base64Audio = btoa(
              String.fromCharCode(...new Uint8Array(pcmData.buffer))
            )
            ws.send(
              JSON.stringify(buildRealtimeAudioMessage(base64Audio))
            )
          }

          source.connect(processor)
          processor.connect(audioContext.destination)
        }

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return

          try {
            const msg = JSON.parse(event.data)

            if (msg.message_type === 'partial_transcript') {
              // Interim/partial result
              setInterimTranscript(msg.text || '')
            } else if (
              msg.message_type === 'committed_transcript' ||
              msg.message_type === 'committed_transcript_with_timestamps'
            ) {
              // Final committed segment
              committedTranscript += (msg.text || '') + ' '
              const finalTranscript = committedTranscript.trim()
              setTranscript(finalTranscript)
              setInterimTranscript('')

              if (sttFinalizeRef.current) {
                const finalize = sttFinalizeRef.current
                sttFinalizeRef.current = null
                finalize(finalTranscript)
              }
            } else if (typeof msg.error === 'string') {
              console.error('ElevenLabs STT error:', msg)
              cleanupLiveSTT()
              setErrorMessage(msg.error)
              setVoiceState(VOICE_STATES.ERROR)
              onError?.(msg.error)
            }
          } catch (parseErr) {
            console.error('Failed to parse STT message:', parseErr)
          }
        }

        ws.onerror = (err) => {
          console.error('WebSocket error:', err)
          cleanupLiveSTT()
          if (isMountedRef.current) {
            setErrorMessage('STT connection error')
            setVoiceState(VOICE_STATES.ERROR)
          }
          onError?.('WebSocket error')
        }

        ws.onclose = (event) => {
          if (wsRef.current === ws) {
            wsRef.current = null
          }
          if (sttFinalizeRef.current) {
            const finalize = sttFinalizeRef.current
            sttFinalizeRef.current = null
            finalize(committedTranscript.trim())
          }
          if (isMountedRef.current && event.code !== 1000) {
            setErrorMessage('STT connection closed unexpectedly')
            setVoiceState(VOICE_STATES.ERROR)
          }
        }
      } catch (err) {
        cleanupLiveSTT()
        setErrorMessage(err.message || 'Failed to start live STT')
        setVoiceState(VOICE_STATES.ERROR)
        onError?.(err.message)
      }
    }
  }, [mode, accessToken, onError, voiceState, cleanupLiveSTT])

  /**
   * Stop listening and finalize transcript
   */
  const stopListening = useCallback(() => {
    setVoiceState(VOICE_STATES.PROCESSING)
    setInterimTranscript('')

    if (mode === VOICE_MODES.DEMO) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors during stop
        }
        recognitionRef.current = null
      }

      // Browser recognition delivers its final result asynchronously on stop.
      setTimeout(() => {
        if (!isMountedRef.current) return
        setVoiceState(VOICE_STATES.IDLE)
        setTranscript((currentTranscript) => {
          if (currentTranscript.trim()) {
            onTranscriptReady?.(currentTranscript.trim())
          }
          return currentTranscript
        })
      }, 300)
      return
    }

    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      cleanupLiveSTT()
      setVoiceState(VOICE_STATES.IDLE)
      return
    }

    // Stop producing new audio while leaving the socket open for the final result.
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    const finish = (finalTranscript) => {
      cleanupLiveSTT()
      if (!isMountedRef.current) return
      setVoiceState(VOICE_STATES.IDLE)
      if (finalTranscript) {
        onTranscriptReady?.(finalTranscript)
      }
    }

    sttFinalizeRef.current = finish
    ws.send(JSON.stringify(buildRealtimeAudioMessage('', true)))

    // A provider/network failure must not leave the microphone open forever.
    sttTimeoutRef.current = setTimeout(() => {
      sttTimeoutRef.current = null
      if (sttFinalizeRef.current === finish) {
        sttFinalizeRef.current = null
        setTranscript((currentTranscript) => {
          finish(currentTranscript.trim())
          return currentTranscript
        })
      }
    }, 5000)
  }, [mode, onTranscriptReady, cleanupLiveSTT])

  /**
   * Cancel listening without finalizing
   */
  const cancelListening = useCallback(() => {
    if (mode === VOICE_MODES.DEMO && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Ignore errors during stop
      }
      recognitionRef.current = null
    } else if (mode === VOICE_MODES.LIVE) {
      cleanupLiveSTT()
    }

    setVoiceState(VOICE_STATES.IDLE)
    setTranscript('')
    setInterimTranscript('')
  }, [mode, cleanupLiveSTT])

  /**
   * Reset the voice state
   */
  const reset = useCallback(() => {
    stopSpeaking()
    cancelListening()
    setErrorMessage(null)
    setVoiceState(VOICE_STATES.IDLE)
  }, [stopSpeaking, cancelListening])

  return {
    // State
    voiceState,
    transcript,
    interimTranscript,
    isSupported,
    errorMessage,

    // State checks
    isIdle: voiceState === VOICE_STATES.IDLE,
    isSpeaking: voiceState === VOICE_STATES.SPEAKING,
    isListening: voiceState === VOICE_STATES.LISTENING,
    isProcessing: voiceState === VOICE_STATES.PROCESSING,
    hasError: voiceState === VOICE_STATES.ERROR,

    // Actions
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    cancelListening,
    reset,
  }
}

export default useVoiceInterview
