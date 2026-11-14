import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../services/api'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

/**
 * Minimal Interview Room placeholder (P1).
 *
 * This component reads the interview ID from the route parameters and
 * fetches the interview state via GET /api/interviews/{id}.
 *
 * P1 owns ONLY the UI state machine and data fetching here. It does NOT
 * implement interview orchestration, question selection, evaluation,
 * or voice functionality. Those are P3/P4 responsibilities.
 */
export default function InterviewRoom() {
  const { interviewId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()

  const [interview, setInterview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const isMock = interviewId?.startsWith('mock-')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (isMock) {
        setLoading(false)
        setInterview({
          __mock: true,
          id: interviewId,
          status: 'planned',
          message: 'Demo session — actual interview engine is not yet integrated.'
        })
        return
      }

      try {
        setLoading(true)
        setError(null)
        const data = await apiRequest(`/api/interviews/${interviewId}`, {
          accessToken: session?.access_token,
        })
        if (active) setInterview(data)
      } catch (err) {
        if (active) setError(err.message || 'Unable to load interview session.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [interviewId, session?.access_token, isMock])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Badge tone="primary" className="mb-3">Interview Room</Badge>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white md:text-3xl">
          Interview Session
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Interview ID: <span className="font-mono text-slate-300">{interviewId}</span>
        </p>
      </div>

      {loading ? (
        <Card className="p-8 text-center" hover={false}>
          <p className="text-sm text-slate-400">Loading interview session…</p>
        </Card>
      ) : error ? (
        <Card className="p-8 text-center" hover={false}>
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/interview/setup')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Back to Setup
          </button>
        </Card>
      ) : (
        <Card className="p-8" hover={false}>
          <pre className="overflow-x-auto rounded-xl bg-[#070B16] p-4 text-xs text-slate-300">
            {JSON.stringify(interview, null, 2)}
          </pre>
          <p className="mt-4 text-xs text-slate-500">
            P1 placeholder only. Voice, avatar, evaluation, and orchestration are P3/P4 responsibilities.
          </p>
        </Card>
      )}
    </div>
  )
}