import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import SearchInput from '../components/ui/SearchInput'
import EmptyState from '../components/ui/EmptyState'
import { apiRequest } from '../services/api'

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function ResourceNotice() {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100">
      These are general career resources, not confirmed GNDEC placement-drive recruiters.
      Check each official source for current information.
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading recruiters">
      {[1, 2, 3].map((item) => (
        <Card key={item} className="h-48 animate-pulse p-5" hover={false}>
          <div className="h-5 w-2/3 rounded bg-slate-700/60" />
          <div className="mt-4 h-4 w-full rounded bg-slate-700/40" />
          <div className="mt-2 h-4 w-4/5 rounded bg-slate-700/40" />
          <div className="mt-8 h-4 w-1/2 rounded bg-slate-700/40" />
        </Card>
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <Card className="p-8 text-center" hover={false}>
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
        Unable to load career resources
      </h2>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0B1020] px-4 py-2 text-sm text-slate-200 transition hover:border-violet-500/40 hover:text-white"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </Card>
  )
}

function RecruiterCard({ recruiter }) {
  const websiteUrl = recruiter.website_url
  const sourceUrl = recruiter.source_url

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-sm font-bold text-violet-200"
        >
          {initials(recruiter.name)}
        </div>
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
            {recruiter.name}
          </h2>
          <Badge tone="muted" className="mt-2">General career resource</Badge>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-slate-400">
        Official company career information. This record does not confirm GNDEC placement participation.
      </p>

      <div className="mt-auto flex flex-wrap gap-3 pt-5">
        <Link
          to={`/recruiters/${recruiter.id}`}
          className="inline-flex items-center rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-400/50 hover:text-white"
        >
          View details
        </Link>
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0B1020] px-3 py-2 text-sm text-cyan-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
          >
            Official site
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {sourceUrl && sourceUrl !== websiteUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0B1020] px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Source
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </Card>
  )
}

function RecruiterDetail({ recruiter, onRetry }) {
  const navigate = useNavigate()
  const websiteUrl = recruiter.website_url
  const sourceUrl = recruiter.source_url

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/recruiters')}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to recruiters
      </button>

      <ResourceNotice />

      <Card className="p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-lg font-bold text-violet-200"
          >
            {initials(recruiter.name)}
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white">
              {recruiter.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="muted">General career resource</Badge>
              <Badge tone={recruiter.verification_status === 'verified' ? 'success' : 'muted'}>
                {recruiter.verification_status === 'verified' ? 'Official source identity' : recruiter.verification_status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-5 border-t border-slate-800 pt-6">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">About this entry</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {recruiter.description || 'No company description was published in this record.'}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              No roles, eligibility criteria, skills, hiring status, or interview information is implied by this entry.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Official links</h2>
            <div className="mt-3 flex flex-col items-start gap-3 text-sm">
              {websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                >
                  Official company website
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                >
                  Official career-resource source
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {!websiteUrl && !sourceUrl ? <span className="text-slate-500">No links published.</span> : null}
            </div>
          </div>
        </div>
      </Card>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-300"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh this record
      </button>
    </div>
  )
}

function useRecruiterRequest(accessToken, recruiterId) {
  const [state, setState] = useState({ loading: true, data: recruiterId ? null : [], error: null })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    if (!accessToken) {
      setState({ loading: false, data: recruiterId ? null : [], error: 'Authentication is required to view career resources.' })
      return () => controller.abort()
    }

    setState((current) => ({ ...current, loading: true, error: null }))
    const path = recruiterId ? `/api/recruiters/${recruiterId}` : '/api/recruiters?limit=100&offset=0'

    apiRequest(path, { accessToken, signal: controller.signal })
      .then((data) => {
        if (active) setState({ loading: false, data, error: null })
      })
      .catch((requestError) => {
        if (active && requestError.name !== 'AbortError') {
          setState({ loading: false, data: recruiterId ? null : [], error: requestError.message })
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [accessToken, recruiterId, retryKey])

  return { ...state, retry: () => setRetryKey((current) => current + 1) }
}

function RecruiterDirectory({ accessToken }) {
  const { loading, data, error, retry } = useRecruiterRequest(accessToken, null)
  const [query, setQuery] = useState('')

  const recruiters = Array.isArray(data) ? data : []
  const filteredRecruiters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return recruiters
    return recruiters.filter((recruiter) => recruiter.name.toLowerCase().includes(normalizedQuery))
  }, [query, recruiters])

  return (
    <div className="space-y-6">
      <ResourceNotice />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-slate-400">
          Browse company career pages without implying current openings or GNDEC placement participation.
        </p>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search company name…"
          className="w-full lg:max-w-sm"
        />
      </div>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={retry} /> : null}
      {!loading && !error && recruiters.length === 0 ? (
        <EmptyState
          title="No career resources available"
          description="The directory is currently empty. Check back later for approved source-backed entries."
        />
      ) : null}
      {!loading && !error && recruiters.length > 0 && filteredRecruiters.length === 0 ? (
        <EmptyState
          title="No matches found"
          description="Try another company name or clear the search."
        />
      ) : null}
      {!loading && !error && filteredRecruiters.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRecruiters.map((recruiter) => (
            <RecruiterCard key={recruiter.id} recruiter={recruiter} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RecruiterDetailRoute({ accessToken }) {
  const { recruiterId } = useParams()
  const { loading, data, error, retry } = useRecruiterRequest(accessToken, recruiterId)

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={retry} />
  if (!data) {
    return (
      <EmptyState
        title="Recruiter not found"
        description="This career-resource entry may no longer be available."
      />
    )
  }

  return <RecruiterDetail recruiter={data} onRetry={retry} />
}

export default function Recruiters() {
  const { session, loading, isConfigured, isDemoMode } = useAuth()
  const { recruiterId } = useParams()

  if (loading) return <LoadingState />
  if (isDemoMode || !isConfigured) {
    return (
      <EmptyState
        title="Sign in to view career resources"
        description="Recruiter data is available through the authenticated CareerPilot API."
      />
    )
  }
  if (!session?.access_token) {
    return (
      <EmptyState
        title="Authentication required"
        description="Please sign in again to access career-resource data."
      />
    )
  }

  return recruiterId ? (
    <RecruiterDetailRoute accessToken={session.access_token} />
  ) : (
    <RecruiterDirectory accessToken={session.access_token} />
  )
}
