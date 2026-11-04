import Card from '../components/ui/Card'
import ProgressBar from '../components/ui/ProgressBar'
import { skillCategories } from '../data/demoData'

export default function Skills() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm leading-6 text-amber-100">
        <strong className="font-medium">Demo boundary:</strong> these scores are sample UI values only. They are not AI-assessed measurements, verified skill evidence, or hiring recommendations.
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
