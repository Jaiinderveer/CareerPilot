import { useMemo, useState } from 'react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import SearchInput from '../components/ui/SearchInput'
import EmptyState from '../components/ui/EmptyState'
import { recruiters } from '../data/demoData'

export default function Recruiters() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recruiters
    return recruiters.filter((company) => {
      const haystack = [
        company.name,
        ...company.roles,
        ...company.skills,
        company.eligibility,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Searchable sample company directory. All entries are labelled demonstration data.
        </p>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search companies, roles, skills…"
          className="w-full sm:max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No companies match"
          description="Try another keyword or clear the search to see the full sample directory."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((company) => (
            <Card key={company.id} className="flex h-full flex-col p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-sm font-bold text-violet-200">
                  {company.initials}
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
                    {company.name}
                  </h2>
                  <p className="text-xs text-slate-500">{company.location}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1.5 text-xs tracking-wide text-slate-500 uppercase">Roles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {company.roles.map((role) => (
                      <Badge key={role} tone="primary">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs tracking-wide text-slate-500 uppercase">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {company.skills.map((skill) => (
                      <Badge key={skill} tone="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs tracking-wide text-slate-500 uppercase">Rounds</p>
                  <p className="text-slate-300">{company.rounds.join(' → ')}</p>
                </div>
                <div>
                  <p className="mb-1.5 text-xs tracking-wide text-slate-500 uppercase">Eligibility</p>
                  <p className="text-slate-400">{company.eligibility}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
