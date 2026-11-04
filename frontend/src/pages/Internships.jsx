import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import SearchInput from '../components/ui/SearchInput'
import EmptyState from '../components/ui/EmptyState'
import { internships } from '../data/demoData'

const workModes = ['All', 'Remote', 'Hybrid', 'On-site']

export default function Internships() {
  const [query, setQuery] = useState('')
  const [workMode, setWorkMode] = useState('All')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return internships.filter((job) => {
      const matchesMode = workMode === 'All' || job.workMode === workMode
      if (!matchesMode) return false
      if (!q) return true
      const haystack = [job.company, job.role, ...job.skills, job.eligibility]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, workMode])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm leading-6 text-amber-100">
        <strong className="font-medium">Demo boundary:</strong> every listing on this page is sample data, not a live opening. Dates, eligibility, and application links are placeholders and must not be used as application guidance.
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by company, role, or skill…"
          className="w-full lg:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {workModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setWorkMode(mode)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                workMode === mode
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
                  : 'border-slate-700 bg-[#10182A] text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No internships found"
          description="Adjust search or work-mode filters to see sample listings again."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((job) => (
            <Card key={job.id} className="flex h-full flex-col p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
                    {job.role}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{job.company}</p>
                </div>
                <Badge tone="secondary">{job.workMode}</Badge>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <Badge key={skill} tone="muted">
                    {skill}
                  </Badge>
                ))}
              </div>

              <p className="mb-2 text-sm text-slate-400">{job.eligibility}</p>
              <p className="mb-5 text-sm text-slate-500">
                Deadline:{' '}
                <span className="text-slate-300">
                  {new Date(job.deadline).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </p>

              <a
                href={job.applyUrl}
                className="mt-auto inline-flex items-center gap-2 self-start rounded-xl border border-slate-700 bg-[#0B1020] px-3 py-2 text-sm text-cyan-300 transition hover:border-cyan-500/40 hover:text-cyan-200"
                onClick={(event) => event.preventDefault()}
              >
                Application link (placeholder)
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
