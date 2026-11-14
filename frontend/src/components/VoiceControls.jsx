/**
 * Voice interview controls component.
 *
 * Provides TTS playback and STT recording controls for the interview room.
 * In DEMO mode, uses browser Web Speech API (no API keys required).
 * In LIVE mode, would use ElevenLabs via backend tokens (when configured).
 */

import { useEffect, useState } from 'react'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Play,
  Loader2,
  AlertCircle,
  Waves,
} from 'lucide-react'
import { VOICE_STATES } from '../hooks/useVoiceInterview'

/**
 * Voice controls for interview room
 *
 * @param {Object} props
 * @param {Object} props.voice - Voice hook return value from useVoiceInterview
 * @param {string} props.questionText - Current question text to speak
 * @param {string} props.turnId - Current turn ID required by LIVE TTS
 * @param {Function} props.onTranscriptSubmit - Called when user wants to submit the transcript
 * @param {boolean} props.allowAutoSpeak - Whether questions may be spoken automatically
 * @param {boolean} props.disabled - Whether controls should be disabled
 * @param {boolean} props.showTranscript - Whether to show the live transcript
 */
export default function VoiceControls({
  voice,
  questionText,
  turnId,
  onTranscriptSubmit,
  allowAutoSpeak = false,
  disabled = false,
  showTranscript = true,
}) {
  const [autoSpeak, setAutoSpeak] = useState(true)

  const {
    voiceState,
    transcript,
    interimTranscript,
    isSupported,
    errorMessage,
    isSpeaking,
    isListening,
    isProcessing,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    cancelListening,
  } = voice

  // Auto-speak once when a new question arrives. Depending on voiceState here
  // would replay the same question every time playback returns to idle.
  useEffect(() => {
    if (allowAutoSpeak && autoSpeak && questionText && isSupported) {
      speak(questionText, turnId)
    }
  }, [questionText, turnId, allowAutoSpeak, autoSpeak, isSupported, speak])

  // Handle submit with transcript
  const handleSubmitTranscript = () => {
    if (transcript.trim()) {
      onTranscriptSubmit?.(transcript.trim())
    }
  }

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-center gap-3 text-sm text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium">Voice features not available</p>
            <p className="text-xs text-amber-300/80 mt-1">
              Your browser doesn't support the Web Speech API. You can still type your answers
              in the text box below.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Voice status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Speaking indicator */}
          {isSpeaking && (
            <div className="flex items-center gap-2 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs text-violet-300">
              <Volume2 className="h-4 w-4 animate-pulse" />
              <span>AI Speaking...</span>
            </div>
          )}

          {/* Listening indicator */}
          {isListening && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300">
              <Waves className="h-4 w-4 animate-pulse" />
              <span>Listening...</span>
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          )}

          {/* Idle state */}
          {voiceState === VOICE_STATES.IDLE && !isSpeaking && !isListening && !isProcessing && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Mic className="h-4 w-4" />
              <span>Voice ready</span>
            </div>
          )}
        </div>

        {/* Browser speech synthesis can retain demo auto-speak. LIVE TTS stays manual. */}
        {allowAutoSpeak && (
          <button
            type="button"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              autoSpeak
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-300'
            }`}
            title={autoSpeak ? 'Auto-speak is on' : 'Auto-speak is off'}
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>Auto-speak</span>
          </button>
        )}
      </div>

      {/* Main controls */}
      <div className="flex items-center gap-3">
        {/* Speak/Stop speaking button */}
        {isSpeaking ? (
          <button
            type="button"
            onClick={stopSpeaking}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/50 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
          >
            <Square className="h-4 w-4 fill-current" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => speak(questionText, turnId)}
            disabled={disabled || !questionText || isListening}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-current" />
            Hear Question
          </button>
        )}

        {/* Record/Stop recording button */}
        {isListening ? (
          <button
            type="button"
            onClick={stopListening}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
          >
            <Square className="h-4 w-4 fill-current" />
            Stop Recording
          </button>
        ) : (
          <button
            type="button"
            onClick={startListening}
            disabled={disabled || isSpeaking || isProcessing}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50 shadow-lg shadow-violet-600/20"
          >
            <Mic className="h-4 w-4" />
            Start Recording
          </button>
        )}

        {/* Cancel recording */}
        {isListening && (
          <button
            type="button"
            onClick={cancelListening}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
          >
            <MicOff className="h-4 w-4" />
            Cancel
          </button>
        )}
      </div>

      {/* Live transcript display */}
      {showTranscript && (isListening || transcript || interimTranscript) && (
        <div className="rounded-xl border border-slate-800 bg-[#070B16] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Voice Transcript
            </span>
            {isListening && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Recording
              </span>
            )}
          </div>

          <div className="min-h-[60px] text-sm text-slate-200">
            {transcript && <span>{transcript}</span>}
            {interimTranscript && (
              <span className="text-slate-500 italic"> {interimTranscript}</span>
            )}
            {!transcript && !interimTranscript && isListening && (
              <span className="text-slate-500 italic">Speak now...</span>
            )}
          </div>

          {/* Submit transcript button */}
          {transcript && !isListening && (
            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSubmitTranscript}
                disabled={disabled || !transcript.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                Use This Transcript
              </button>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <p className="text-xs text-slate-500">
        {isListening
          ? 'Speak your answer clearly. Click "Stop Recording" when finished.'
          : isSpeaking
          ? 'Listen to the question. You can stop and replay anytime.'
          : 'Click "Start Recording" to speak your answer, or type in the text box below.'}
      </p>
    </div>
  )
}
