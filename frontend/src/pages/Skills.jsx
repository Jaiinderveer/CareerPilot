import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
import { skillCategories } from '../data/demoData'

export default function Skills() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="muted">Demo scores</Badge>
        <p className="text-sm text-slate-400">
          Sample skill levels for UI only — not AI-assessed measurements.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {skillCategories.map((category) => {
          const average = Math.round(
            category.skills.reduce((sum, skill) => sum + skill.score, 0) / category.skills.length,
          )

          return (
            <Card key={category.id} className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
                    {category.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{category.description}</p>
                </div>
                <span className="rounded-lg bg-[#0B1020] px-2 py-1 text-sm font-medium text-violet-300">
                  {average}%
                </span>
              </div>
              <div className="space-y-3">
                {category.skills.map((skill) => (
                  <ProgressBar key={skill.name} value={skill.score} label={skill.name} />
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
