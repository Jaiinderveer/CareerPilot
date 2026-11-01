import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, Map, Sparkles, Target } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import {
  dashboardStats,
  internships,
  recentActivity,
  recruiters,
  roadmaps,
  skillOverview,
  studentProfile,
} from '../data/demoData'

const statCards = [
  {
    label: 'Preparation',
    value: `${dashboardStats.preparationProgress}%`,
    icon: Target,
    hint: 'Demo progress',
  },
  {
    label: 'Active roadmaps',
    value: dashboardStats.activeRoadmaps,
    icon: Map,
    hint: 'In progress',
  },
  {
    label: 'Skills tracked',
    value: dashboardStats.skillsTracked,
    icon: Sparkles,
    hint: 'Sample set',
  },
  {
    label: 'Saved internships',
    value: dashboardStats.savedInternships,
    icon: Briefcase,
    hint: 'Demo saves',
  },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-6" hover={false}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge tone="secondary">Demo data</Badge>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-white md:text-3xl">
              Welcome back, {studentProfile.name.split(' ')[0]}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400 md:text-base">
              Track placement prep across roadmaps, skills, GNDEC-focused recruiter intel, and
              internship discovery — frontend foundation only for this phase.
            </p>
          </div>
          <Link
            to="/roadmaps"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Continue prep
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-white">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{stat.hint}</p>
                </div>
                <div className="rounded-lg bg-violet-500/10 p-2 text-violet-300">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Skills overview
            </h3>
            <Link to="/skills" className="text-sm text-cyan-300 hover:text-cyan-200">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {skillOverview.map((skill) => (
              <ProgressBar
                key={skill.name}
                value={skill.score}
                label={`${skill.name} · ${skill.note}`}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold text-white">
            Preparation progress
          </h3>
          <ProgressBar value={dashboardStats.preparationProgress} label="Overall readiness" />
          <p className="mt-4 text-sm text-slate-400">
            Aggregate of demo roadmap completion. AI assessment arrives in a later phase.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Active roadmaps
            </h3>
            <Link to="/roadmaps" className="text-sm text-cyan-300 hover:text-cyan-200">
              Browse
            </Link>
          </div>
          <div className="space-y-4">
            {roadmaps.slice(0, 3).map((roadmap) => (
              <div key={roadmap.id} className="rounded-xl border border-slate-800 bg-[#0B1020] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-100">{roadmap.title}</p>
                  <Badge tone={roadmap.accent === 'secondary' ? 'secondary' : 'primary'}>
                    {roadmap.category}
                  </Badge>
                </div>
                <ProgressBar value={roadmap.progress} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Recommended recruiters
            </h3>
            <Link to="/recruiters" className="text-sm text-cyan-300 hover:text-cyan-200">
              Directory
            </Link>
          </div>
          <div className="space-y-3">
            {recruiters.slice(0, 3).map((company) => (
              <div
                key={company.id}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0B1020] p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-sm font-semibold text-violet-300">
                  {company.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{company.name}</p>
                  <p className="truncate text-xs text-slate-400">{company.roles.join(' · ')}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold text-white">
            Recent activity
          </h3>
          <ul className="space-y-3">
            {recentActivity.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm text-slate-300">{item.text}</p>
                <span className="shrink-0 text-xs text-slate-500">{item.time}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Internship opportunities
            </h3>
            <Link to="/internships" className="text-sm text-cyan-300 hover:text-cyan-200">
              Explore
            </Link>
          </div>
          <div className="space-y-3">
            {internships.slice(0, 3).map((job) => (
              <div key={job.id} className="rounded-xl border border-slate-800 bg-[#0B1020] p-3">
                <p className="font-medium text-slate-100">{job.role}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {job.company} · {job.workMode}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
