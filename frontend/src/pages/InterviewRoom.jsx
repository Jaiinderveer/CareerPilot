import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Award,
  Clock,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
  RotateCcw,
  Mic,
} from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import {
  fetchInterview,
  startInterview,
  submitInterviewAnswer,
  finishInterview,
  fetchInterviewReport,
  isMockInterviewId,
} from '../services/interviewService'
import { useVoiceInterview, VOICE_MODES } from '../hooks/useVoiceInterview'
import VoiceControls from '../components/VoiceControls'

export default function InterviewRoom() {
  const { interviewId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()

  const [interview, setInterview] = useState(null)
  const [currentTurn, setCurrentTurn] = useState(null)
  const [turnsHistory, setTurnsHistory] = useState([])
  const [answerText, setAnswerText] = useState('')

  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)

  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)

  const [lastEvaluation, setLastEvaluation] = useState(null)
  const [nextAction, setNextAction] = useState(null)
  const [report, setReport] = useState(null)

  const isMock = isMockInterviewId(interviewId)

  // Voice interview hook â€” DEMO mode uses Web Speech API, LIVE mode uses ElevenLabs
  const handleVoiceTranscript = useCallback((transcript) => {
    setAnswerText(transcript)
  }, [])

  const handleVoiceError = useCallback((err) => {
    console.warn('Voice error:', err)
    // Don't show error for common issues like no-speech timeout
  }, [])

  const voice = useVoiceInterview({
    mode: isMock ? VOICE_MODES.DEMO : VOICE_MODES.LIVE,
    interviewId: isMock ? null : interviewId,
    accessToken: session?.access_token,
    onTranscriptReady: handleVoiceTranscript,
    onError: handleVoiceError,
  })

  // 1. Load interview session
  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      if (isMock) {
        if (!isMounted) return
        setLoading(false)
        setInterview({
          __mock: true,
          id: interviewId,
          status: 'planned',
          role: 'Frontend Engineer (Demo)',
          round: 'Technical',
          duration_minutes: 30,
          job_description: 'Demo mock interview session.',
          created_at: new Date().toISOString(),
        })
        return
      }

      if (!session?.access_token) {
        if (!isMounted) return
        setLoading(false)
        setError('Authentication session required for live interviews.')
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await fetchInterview(session.access_token, interviewId)
        if (!isMounted) return
        setInterview(data)
        if (data.current_turn && data.status === 'active') {
          setCurrentTurn(data.current_turn)
        }
        if (data.status === 'completed') {
          setLoadingReport(true)
          try {
            const rep = await fetchInterviewReport(session.access_token, interviewId)
            if (isMounted) setReport(rep)
          } catch (repErr) {
            // Report might be fetched on demand
          } finally {
            if (isMounted) setLoadingReport(false)
          }
        }
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Unable to load interview session.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSession()
    return () => {
      isMounted = false
    }
  }, [interviewId, session?.access_token, isMock])

  // 2. Start Interview
  const handleStartInterview = async () => {
    if (starting) return

    if (isMock) {
      setStarting(true)
      await new Promise((resolve) => setTimeout(resolve, 600))
      const mockFirstTurn = {
        id: 'mock-turn-1',
        sequence_num: 1,
        question_text: 'Tell me about a challenging technical project you built recently and how you handled state management or performance scaling.',
        is_follow_up: false,
        asked_at: new Date().toISOString(),
      }
      setInterview((prev) => ({ ...prev, status: 'active' }))
      setCurrentTurn(mockFirstTurn)
      setStarting(false)
      return
    }

    try {
      setStarting(true)
      setError(null)
      const res = await startInterview(session.access_token, interviewId)
      setInterview((prev) => ({ ...prev, status: 'active', started_at: res.started_at }))
      setCurrentTurn(res.first_turn)
    } catch (err) {
      setError(err.message || 'Failed to start interview session.')
    } finally {
      setStarting(false)
    }
  }

  // 4 & 5. Submit Answer
  const handleSubmitAnswer = async (e) => {
    e.preventDefault()
    if (submitting || !answerText.trim() || !currentTurn) return

    if (isMock) {
      setSubmitting(true)
      setActionError(null)
      await new Promise((resolve) => setTimeout(resolve, 800))

      const mockEvaluation = {
        id: 'mock-eval-' + Date.now(),
        overall_score: 0.82,
        criterion_results: [
          {
            criterion_id: 'technical_depth',
            status: 'demonstrated',
            score: 3,
            evidence_quote: answerText.slice(0, 60) + '...',
            explanation: 'Candidate clearly articulated technical architecture and choices.',
          },
          {
            criterion_id: 'communication',
            status: 'demonstrated',
            score: 4,
            evidence_quote: 'Structured response with clear context.',
            explanation: 'Logical and well-paced delivery.',
          },
        ],
      }

      const isSecondTurn = currentTurn.sequence_num === 1
      const action = isSecondTurn ? 'select_question' : 'finish'

      setLastEvaluation(mockEvaluation)
      setNextAction(action)
      setTurnsHistory((prev) => [
        ...prev,
        {
          turn: currentTurn,
          answer: { transcript_text: answerText, submitted_at: new Date().toISOString() },
          evaluation: mockEvaluation,
        },
      ])

      setAnswerText('')
      if (action === 'select_question') {
        setCurrentTurn({
          id: 'mock-turn-2',
          sequence_num: 2,
          question_text: 'How do you approach designing error boundaries, loading states, and fallback UI in a modern React application?',
          is_follow_up: false,
          asked_at: new Date().toISOString(),
        })
      } else if (action === 'finish') {
        setCurrentTurn(null)
        await handleFinishInterview(null, true)
      }
      setSubmitting(false)
      return
    }

    try {
      setSubmitting(true)
      setActionError(null)

      const res = await submitInterviewAnswer(
        session.access_token,
        interviewId,
        currentTurn.id,
        { transcript_text: answerText.trim() }
      )

      setLastEvaluation(res.evaluation)
      setNextAction(res.next_action)
      setTurnsHistory((prev) => [
        ...prev,
        {
          turn: currentTurn,
          answer: { transcript_text: answerText.trim(), submitted_at: new Date().toISOString() },
          evaluation: res.evaluation,
        },
      ])
      setAnswerText('')

      // 8. Handle next action strictly per backend response
      if (res.next_action === 'finish') {
        setCurrentTurn(null)
        await handleFinishInterview()
      } else if (res.next_turn) {
        setCurrentTurn(res.next_turn)
      } else if (res.next_action === 'clarify') {
        // Keep current turn for clarification
      }
    } catch (err) {
      setActionError(err.message || 'Failed to submit answer.')
    } finally {
      setSubmitting(false)
    }
  }

  // 9 & 10. Finish Interview & Fetch Report
  const handleFinishInterview = async (e, skipMockDelay = false) => {
    if (e) e.preventDefault()
    if (finishing) return

    if (isMock) {
      setFinishing(true)
      if (!skipMockDelay) await new Promise((resolve) => setTimeout(resolve, 800))
      setInterview((prev) => ({ ...prev, status: 'completed', ended_at: new Date().toISOString() }))
      setReport({
        id: 'mock-report-1',
        interview_id: interviewId,
        overall_summary: 'Demonstrated strong software engineering fundamentals and clear technical communication throughout the interview session.',
        overall_score: 0.85,
        topic_results: {
          'System Design': { questions_asked: 2, average_score: 0.85, demonstrated_criteria: ['technical_depth', 'scalability'], missing_criteria: [] },
        },
        strengths: ['Clear architecture explanations', 'Structured problem solving'],
        weaknesses: ['Could elaborate more on edge case testing'],
        recommendations: ['Practice distributed systems tradeoffs'],
        generated_at: new Date().toISOString(),
      })
      setCurrentTurn(null)
      setFinishing(false)
      return
    }

    try {
      setFinishing(true)
      setError(null)
      const res = await finishInterview(session.access_token, interviewId)
      setInterview((prev) => ({ ...prev, status: 'completed', ended_at: res.ended_at }))
      setReport(res.report)
      setCurrentTurn(null)
    } catch (err) {
      setError(err.message || 'Failed to finish interview session.')
    } finally {
      setFinishing(false)
    }
  }

  // Criterion status badge helper
  const renderCriterionBadge = (status) => {
    switch (status) {
      case 'demonstrated':
        return <Badge tone="success">Demonstrated</Badge>
      case 'partially_demonstrated':
        return <Badge tone="warning">Partial</Badge>
      case 'not_demonstrated':
        return <Badge tone="danger">Not Demonstrated</Badge>
      case 'contradicted':
        return <Badge tone="danger">Contradicted</Badge>
      default:
        return <Badge tone="neutral">Uncertain</Badge>
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="primary">AI Interview Room</Badge>
            {isMock && <Badge tone="warning">Demo Mode</Badge>}
            {interview?.status && (
              <Badge
                tone={
                  interview.status === 'completed'
                    ? 'success'
                    : interview.status === 'active'
                    ? 'primary'
                    : 'neutral'
                }
              >
                {interview.status.toUpperCase()}
              </Badge>
            )}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white md:text-3xl">
            {interview?.role ? interview.role : 'Technical Interview Session'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {interview?.round ? `${interview.round} Round` : 'General Round'} Â· {interview?.duration_minutes || 30} mins
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#070B16] px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <Card className="p-12 text-center" hover={false}>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500 mb-3" />
          <p className="text-sm text-slate-400">Loading interview session...</p>
        </Card>
      ) : error ? (
        /* Error state */
        <Card className="p-8 text-center" hover={false}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-red-300 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/interview/setup')}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Back to Setup
          </button>
        </Card>
      ) : interview?.status === 'planned' ? (
        /* 2 & 3. Planned State / Start Interview */
        <Card className="p-8 md:p-10 space-y-6" hover={false}>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Ready to Begin Your Interview?</h2>
            <p className="text-sm text-slate-400">
              When you click Start Interview, our AI agent will initialize the session and present your opening question. Take your time to read and formulate your thoughts before submitting your response.
            </p>
            {interview.job_description && (
              <div className="rounded-xl border border-slate-800 bg-[#070B16] p-4 text-xs text-slate-300 space-y-1">
                <span className="font-semibold text-slate-200">Focus Topics / Job Description:</span>
                <p className="text-slate-400 whitespace-pre-wrap">{interview.job_description}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={starting}
              onClick={handleStartInterview}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50 shadow-lg shadow-violet-600/20"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing session...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Start Interview
                </>
              )}
            </button>
          </div>
        </Card>
      ) : interview?.status === 'active' && currentTurn ? (
        /* 4, 5, 6, 7, 8. Active Interview Session & Question / Answer Flow */
        <div className="space-y-6">
          {/* Action error */}
          {actionError && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <p>{actionError}</p>
            </div>
          )}

          {/* Current Question Card */}
          <Card className="p-6 md:p-8 space-y-4 border-violet-500/30 bg-gradient-to-b from-[#0e1629] to-[#070B16]" hover={false}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone={currentTurn.is_follow_up ? 'warning' : 'primary'}>
                  {currentTurn.is_follow_up ? 'Follow-up Question' : `Question #${currentTurn.sequence_num}`}
                </Badge>
                {currentTurn.target_criterion_id && (
                  <span className="text-xs text-slate-400">
                    Target: <code className="text-cyan-300">{currentTurn.target_criterion_id}</code>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">
                Asked at {new Date(currentTurn.asked_at || Date.now()).toLocaleTimeString()}
              </span>
            </div>

            <div className="text-base font-medium text-slate-100 leading-relaxed md:text-lg">
              {currentTurn.question_text}
            </div>
          </Card>

          {/* Voice Controls */}
          <Card className="p-6 md:p-8" hover={false}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Mic className="h-5 w-5 text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200">Voice Interview</h3>
                <Badge tone={isMock ? 'warning' : 'success'} className="ml-auto">
                  {isMock ? 'Demo Mode' : 'Live Mode'}
                </Badge>
              </div>
              <VoiceControls
                voice={voice}
                questionText={currentTurn?.question_text}
                turnId={currentTurn?.id}
                onTranscriptSubmit={(transcript) => setAnswerText(transcript)}
                allowAutoSpeak={isMock}
                disabled={submitting || finishing}
                showTranscript={true}
              />
            </div>
          </Card>

          {/* Answer Submission Form */}
          <Card className="p-6 md:p-8 space-y-4" hover={false}>
            <form onSubmit={handleSubmitAnswer} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">
                  Your Answer <span className="text-slate-500">(Voice transcript or text)</span>
                </label>
                <textarea
                  rows="6"
                  required
                  placeholder="Type your detailed answer here. Structure your response clearly with context, actions taken, and results..."
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-800 bg-[#070B16] p-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span>Take your time. Answers are evaluated against core competency rubrics.</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={finishing || submitting}
                    onClick={handleFinishInterview}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:text-white disabled:opacity-50"
                  >
                    {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Finish Interview Early
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !answerText.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50 shadow-lg shadow-violet-600/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Evaluating answer...
                      </>
                    ) : (
                      <>
                        Submit Answer
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </Card>

          {/* Last Evaluation Feedback (if submitted) */}
          {lastEvaluation && (
            <Card className="p-6 md:p-8 space-y-4 border-cyan-500/30 bg-[#070B16]/50" hover={false}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Latest Turn Evaluation</h3>
                </div>
                {lastEvaluation.overall_score !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Score:</span>
                    <span className="font-[family-name:var(--font-display)] text-sm font-bold text-cyan-300">
                      {Math.round((lastEvaluation.overall_score || 0) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {nextAction && (
                <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 font-medium">Next AI Action:</span>
                  <Badge tone="primary">{nextAction}</Badge>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rubric Criteria Breakdown</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {lastEvaluation.criterion_results?.map((crit, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200 font-mono">{crit.criterion_id}</span>
                        {renderCriterionBadge(crit.status)}
                      </div>
                      {crit.explanation && <p className="text-xs text-slate-300">{crit.explanation}</p>}
                      {crit.evidence_quote && (
                        <p className="text-xs italic text-slate-500 border-l-2 border-slate-700 pl-2">
                          &ldquo;{crit.evidence_quote}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* History of Turns */}
          {turnsHistory.length > 0 && (
            <div className="space-y-3 pt-4">
              <h3 className="text-sm font-semibold text-slate-300">Previous Turns ({turnsHistory.length})</h3>
              <div className="space-y-3">
                {turnsHistory.map((item, idx) => (
                  <Card key={idx} className="p-5 space-y-3 opacity-80" hover={false}>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Turn #{item.turn.sequence_num} {item.turn.is_follow_up ? '(Follow-up)' : ''}</span>
                      <span>Score: {Math.round((item.evaluation?.overall_score || 0) * 100)}%</span>
                    </div>
                    <p className="text-sm font-medium text-slate-200">{item.turn.question_text}</p>
                    <div className="rounded-xl bg-[#070B16] p-3 text-xs text-slate-300 border border-slate-800">
                      <span className="block font-semibold text-slate-400 mb-1">Your Answer:</span>
                      <p className="whitespace-pre-wrap">{item.answer.transcript_text}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : interview?.status === 'completed' || report ? (
        /* 10. Completed / Report View */
        <div className="space-y-6">
          <Card className="p-8 md:p-10 space-y-6 border-emerald-500/30 bg-gradient-to-b from-[#0e1629] to-[#070B16]" hover={false}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Interview Completed</h2>
                  <p className="text-xs text-slate-400">Comprehensive evaluation report generated by AI intelligence.</p>
                </div>
              </div>
              {report?.overall_score !== undefined && report?.overall_score !== null && (
                <div className="text-right">
                  <span className="block text-xs text-slate-400">Overall Score</span>
                  <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-emerald-300">
                    {Math.round((report.overall_score || 0) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {report?.overall_summary && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Executive Summary</h3>
                <p className="text-sm text-slate-200 leading-relaxed">{report.overall_summary}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 pt-2">
              {report?.strengths?.length > 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Key Strengths
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {report.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report?.weaknesses?.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                    <AlertCircle className="h-4 w-4" /> Growth Areas
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {report.weaknesses.map((weak, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <span>{weak}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {report?.recommendations?.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Actionable Recommendations</h3>
                <div className="space-y-2">
                  {report.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#070B16] p-4 text-xs text-slate-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 font-mono text-violet-300 font-bold">
                        {idx + 1}
                      </span>
                      <p className="mt-0.5">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 shadow-lg shadow-violet-600/20"
              >
                Return to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </Card>
        </div>
      ) : (
        /* Fallback empty/default state */
        <Card className="p-12 text-center" hover={false}>
          <p className="text-sm text-slate-400 mb-4">Interview session is not active or ready.</p>
          <button
            type="button"
            onClick={() => navigate('/interview/setup')}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Start New Interview
          </button>
        </Card>
      )}
    </div>
  )
}
