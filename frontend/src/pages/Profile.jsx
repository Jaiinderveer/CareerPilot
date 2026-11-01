import { useState } from 'react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import { studentProfile } from '../data/demoData'

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B1020] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20'

export default function Profile() {
  const [form, setForm] = useState({ ...studentProfile })
  const [savedFlash, setSavedFlash] = useState(false)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2200)
  }

  function handleReset() {
    setForm({ ...studentProfile })
    setSavedFlash(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6" hover={false}>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={form.name} size="lg" />
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white">
              {form.name}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {form.college} · Class of {form.graduationYear}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="primary">{form.branch}</Badge>
              <Badge tone="secondary">CGPA {form.cgpa}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6" hover={false}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Edit profile
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Local form only — persistence will be added in a later phase.
            </p>
          </div>
          {savedFlash ? <Badge tone="success">Saved locally (session)</Badge> : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300">
              Name
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-slate-300">
              Email
              <input
                type="email"
                className={fieldClass}
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2">
              College
              <input
                className={fieldClass}
                value={form.college}
                onChange={(e) => updateField('college', e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Branch
              <input
                className={fieldClass}
                value={form.branch}
                onChange={(e) => updateField('branch', e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Graduation year
              <input
                type="number"
                className={fieldClass}
                value={form.graduationYear}
                onChange={(e) => updateField('graduationYear', Number(e.target.value))}
              />
            </label>
            <label className="block text-sm text-slate-300">
              CGPA
              <input
                className={fieldClass}
                value={form.cgpa}
                onChange={(e) => updateField('cgpa', e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Location
              <input
                className={fieldClass}
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2">
              Skills (comma-separated)
              <input
                className={fieldClass}
                value={form.skills.join(', ')}
                onChange={(e) =>
                  updateField(
                    'skills',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2">
              Career interests (comma-separated)
              <input
                className={fieldClass}
                value={form.careerInterests.join(', ')}
                onChange={(e) =>
                  updateField(
                    'careerInterests',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-700 bg-[#0B1020] px-4 py-2.5 text-sm text-slate-300 transition hover:text-white"
            >
              Reset
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
