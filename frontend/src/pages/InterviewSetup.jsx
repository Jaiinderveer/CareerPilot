import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Upload, AlertCircle, Loader2 } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import {
  fetchRecruiters,
  createInterview,
  isInterviewCreationMocked,
} from '../services/interviewService'

const ROUNDS = ['Technical', 'HR', 'Design', 'System Design', 'Other']
const PRESET_DURATIONS = [15, 30, 45, 60]

export default function InterviewSetup() {
  const navigate = useNavigate()
  const { session, loading: authLoading, isConfigured, isDemoMode } = useAuth()

  const [recruiters, setRecruiters] = useState([])
  const [loadingRecruiters, setLoadingRecruiters] = useState(true)
  const [recruiterError, setRecruiterError] = useState(null)

  const [formData, setFormData] = useState({
    company_id: '',
    role: '',
    round: 'Technical',
    duration_minutes: 30,
    job_description: '',
    resume_url: null,
  })

  const [resumeFileName, setResumeFileName] = useState('')
  const [resumeError, setResumeError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadRecruiters = async () => {
      // P1 convention: skip live API call in demo mode or when Supabase not configured
      // Matches Recruiters.jsx lines 326-341 behavior
      if (authLoading || !isConfigured || isDemoMode || !session?.access_token) {
        setLoadingRecruiters(false)
        return
      }

      try {
        setLoadingRecruiters(true)
        setRecruiterError(null) // clear previous error before retry
        const data = await fetchRecruiters(session.access_token)
        if (isMounted) {
          setRecruiters(Array.isArray(data) ? data : data?.recruiters || [])
        }
      } catch (err) {
        if (isMounted) {
          setRecruiterError(err.message || 'Failed to load recruiters')
          setLoadingRecruiters(false)
        }
      }
      if (isMounted) {
        setLoadingRecruiters(false)
      }
    }

    loadRecruiters()
    return () => {
      isMounted = false
    }
  }, [session?.access_token, isConfigured, isDemoMode, authLoading])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setResumeError('Only PDF files are supported.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setResumeError('File size must be under 5MB.')
      return
    }

    setResumeError(null)
    setResumeFileName(file.name)
    // NOTE: resume storage is unresolved (Contract Ambiguity #4).
    // We track the filename but do NOT claim the file has been uploaded
    // or set resume_url. The UI shows "Pending" until P2/P3 confirms.
    setFormData((prev) => ({ ...prev, resume_url: null }))
  }

  const validate = () => {
    const errors = {}

    // Contract fields validation (api-contract.md InterviewCreate, lines 866-872)
    // Role and Round are optional per contract.

    if (
      formData.duration_minutes === null ||
      formData.duration_minutes === undefined ||
      formData.duration_minutes < 10 ||
      formData.duration_minutes > 60
    ) {
      errors.duration_minutes = 'Duration must be between 10 and 60 minutes.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!validate()) return

    try {
      setSubmitting(true)
      setSubmitError(null)

      const payload = {
        company_id: formData.company_id || null,
        role: formData.role.trim() || null,
        round: formData.round,
        duration_minutes: Number(formData.duration_minutes),
        job_description: formData.job_description.trim() || null,
        resume_url: formData.resume_url || null,
      }

      const result = await createInterview(payload, session?.access_token)

      // Mock results are explicitly tagged so they are never mistaken for real sessions
      if (result.__mock) {
        setSubmitError(null)
        // Still navigate to the room so P1 UI flow works; InterviewRoom handles mock/id gracefully
        navigate(`/interview/${result.id}`)
        return
      }

      // Real backend response: navigate to interview room
      navigate(`/interview/${result.id}`)
    } catch (err) {
      setSubmitError(err.message || 'Failed to initialize interview session.')
    } finally {
      setSubmitting(false)
    }
  }

  const showMockBanner = isInterviewCreationMocked()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Badge tone="primary" className="mb-3">AI Mock Interview</Badge>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white md:text-3xl">
          Setup Your Interview Session
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure target role, interview parameters, and optional context. Our AI orchestration agent will tailor the questions to match your goals.
        </p>
      </div>

      {showMockBanner && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
          <p>
            Mock mode active — session will not be persisted until POST /api/interviews is available (P3).
          </p>
        </div>
      )}

      {submitError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p>{submitError}</p>
        </div>
      )}

      <Card className="p-6 md:p-8" hover={false}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Target Company <span className="text-slate-500">(Optional)</span>
            </label>
            {loadingRecruiters ? (
              <div className="h-11 w-full animate-pulse rounded-xl bg-slate-800/80" />
            ) : recruiterError ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                <span className="text-xs text-amber-400">{recruiterError}</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoadingRecruiters(true)
                    setRecruiterError(null)
                    const load = async () => {
                      try {
                        const data = await fetchRecruiters(session?.access_token)
                        setRecruiters(Array.isArray(data) ? data : data?.recruiters || [])
                      } catch (err) {
                        setRecruiterError(err.message || 'Failed to load recruiters')
                      } finally {
                        setLoadingRecruiters(false)
                      }
                    }
                    load()
                  }}
                  className="text-xs text-cyan-300 hover:text-cyan-200"
                >
                  Retry
                </button>
              </div>
            ) : (
              <select
                value={formData.company_id}
                onChange={(e) => handleInputChange('company_id', e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-[#070B16] px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Select target company or organization...</option>
                {recruiters.map((rec) => (
                  <option key={rec.id} value={rec.id}>
                    {rec.name} {rec.verification_status ? `· ${rec.verification_status}` : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-500">
              Choose from indexed recruiters or leave blank for a general technical session.
            </p>
          </div>

          {/* Role Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Target Role / Title <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Frontend Engineering Intern, Graduate Software Developer"
              value={formData.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              className={`w-full rounded-xl border border-slate-800 bg-[#070B16] px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${
                fieldErrors.role ? 'border-red-500/50 ring-1 ring-red-500/50' : ''
              }`}
            />
            {fieldErrors.role && <p className="text-xs text-red-400 mt-1">{fieldErrors.role}</p>}
          </div>

          {/* Round Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Interview Round Type
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROUNDS.map((round) => {
                const isSelected = formData.round === round
                return (
                  <button
                    key={round}
                    type="button"
                    onClick={() => handleInputChange('round', round)}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                      isSelected
                        ? 'border-violet-500 bg-violet-500/15 text-violet-300 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
                        : 'border-slate-800 bg-[#070B16] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {round}
                  </button>
                )
              })}
            </div>
            {fieldErrors.round && <p className="text-xs text-red-400 mt-1">{fieldErrors.round}</p>}
          </div>

          {/* Duration Slider & Presets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-200">
                Session Duration
              </label>
              <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-cyan-300">
                {formData.duration_minutes} minutes
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={formData.duration_minutes}
              onChange={(e) => handleInputChange('duration_minutes', Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              {PRESET_DURATIONS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => handleInputChange('duration_minutes', dur)}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                    formData.duration_minutes === dur
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                      : 'border-slate-800 bg-[#070B16] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {dur}m
                </button>
              ))}
            </div>
            {fieldErrors.duration_minutes && (
              <p className="text-xs text-red-400">{fieldErrors.duration_minutes}</p>
            )}
          </div>

          {/* Job Description Textarea */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Job Description / Focus Topics <span className="text-slate-500">(Optional)</span>
            </label>
            <textarea
              rows="4"
              placeholder="Paste specific job requirements, core tech stack, or topics you want targeted during this interview..."
              value={formData.job_description}
              onChange={(e) => handleInputChange('job_description', e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#070B16] p-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Resume Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Upload Resume <span className="text-slate-500">(Optional PDF, max 5MB)</span>
            </label>
            <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-800 bg-[#070B16] p-6 text-center transition hover:border-slate-700">
              <label className="cursor-pointer space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-sm text-slate-300">
                  {resumeFileName ? (
                    <span className="flex items-center gap-1.5 font-medium text-cyan-300">
                      <span className="h-4 w-4 flex items-center justify-center rounded-full border border-cyan-500/50 text-cyan-400">?</span>
                      {resumeFileName} (pending)
                    </span>
                  ) : (
                    <span>Click to browse PDF resume</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Storage integration pending P2/P3 decision — file will not be uploaded yet.
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {resumeError && (
              <p className="text-xs text-red-400 mt-1">{resumeError}</p>
            )}
          </div>

          {/* Submit CTA */}
          <div className="flex items-center justify-end pt-4 border-t border-slate-800/80">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing session...
                </>
              ) : (
                <>
                  Start AI Interview
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
