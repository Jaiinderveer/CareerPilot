import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import { roadmaps } from '../data/demoData'

export default function Roadmaps() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm leading-6 text-amber-100">
        <strong className="font-medium">Demo boundary:</strong> tracks, module counts, descriptions, and progress values are sample UI data. They are not personalized recommendations or verified placement requirements.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roadmaps.map((roadmap) => (
          <Card key={roadmap.id} className="flex h-full flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <Badge tone={roadmap.accent === 'secondary' ? 'secondary' : 'primary'}>
                  {roadmap.category}
                </Badge>
                <h2 className="mt-3 font-[family-name:var(--font-display)] text-xl font-semibold text-white">
                  {roadmap.title}
                </h2>
              </div>
              <span className="rounded-lg bg-[#0B1020] px-2.5 py-1 text-sm font-medium text-cyan-300">
                {roadmap.progress}%
              </span>
            </div>
            <p className="mb-5 flex-1 text-sm leading-relaxed text-slate-400">{roadmap.description}</p>
            <ProgressBar
              value={roadmap.progress}
              label={`${roadmap.completedModules}/${roadmap.modules} modules complete`}
            />
          </Card>
        ))}
      </div>
    </div>
  )
}
