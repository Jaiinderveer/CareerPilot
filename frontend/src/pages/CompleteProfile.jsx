import { useEffect, useState } from 'react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B1020] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60'

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function toForm(profile, user) {
  return {
    name: profile?.full_name ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '',
    email: user?.email ?? '',
    college: profile?.college ?? '',
    branch: profile?.branch ?? '',
    graduationYear: profile?.graduation_year ?? '',
    cgpa: profile?.cgpa == null ? '' : String(profile.cgpa),
    location: profile?.location ?? '',
    skills: toList(profile?.skills),
    careerInterests: toList(profile?.career_interests),
  }
}

export default function CompleteProfile() {
  const {
    loading: authLoading,
    profile: authProfile,
    profileLoading,
    isConfigured,
    user,
    updateProfile,
  } = useAuth()
  const [form, setForm] = useState(() => toForm(authProfile, user))
  const [skillsInput, setSkillsInput] = useState(() => toList(authProfile?.skills).join(', '))
  const [careerInterestsInput, setCareerInterestsInput] = useState(() => toList(authProfile?.career_interests).join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (authLoading || profileLoading || !isConfigured || !user?.id) return

    const nextForm = toForm(authProfile, user)
    setForm(nextForm)
    setSkillsInput(nextForm.skills.join(', '))
    setCareerInterestsInput(nextForm.careerInterests.join(', '))
  }, [authLoading, authProfile, isConfigured, profileLoading, user])

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!user?.id || !isConfigured) {
      setError('You must be signed in to complete your profile.')
      return
    }

    const graduationYear = form.graduationYear === '' ? null : Number(form.graduationYear)
    const cgpa = form.cgpa === '' ? null : Number(form.cgpa)

    if (graduationYear !== null && (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > 2100)) {
      setError('Graduation year must be a valid year between 1900 and 2100.')
      return
    }
    if (cgpa !== null && (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10)) {
      setError('CGPA must be between 0 and 10.')
      return
    }

    setSaving(true)

    try {
      const record = {
        id: user.id,
        full_name: form.name.trim(),
        college: form.college.trim(),
        branch: form.branch.trim(),
        graduation_year: graduationYear,
        cgpa: cgpa,
        location: form.location.trim(),
        skills: toList(skillsInput),
        career_interests: toList(careerInterestsInput),
      }

      const { data, error: saveError } = await supabase
        .from('profiles')
        .upsert(record, { onConflict: 'id' })
        .select('*')
        .single()

      if (saveError) throw saveError

      const nextForm = toForm(data, user)
      setForm(nextForm)
      setSkillsInput(nextForm.skills.join(', '))
      setCareerInterestsInput(nextForm.careerInterests.join(', '))
      updateProfile(data)
      setSuccess('Profile saved to Supabase.')
    } catch (saveError) {
      setError(saveError.message || 'Failed to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center text-sm text-slate-400">
        Loading profile…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6" hover={false}>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={form.name || user?.email?.split('@')[0] || 'Student'} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white">
                {form.name || 'Student profile'}
              </h2>
              <Badge tone="warning">Incomplete profile</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">{form.college || 'College not set'}{form.graduationYear ? ` · Class of ${form.graduationYear}` : ''}</p>
            <p className="mt-1 text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6" hover={false}>
        <h3 className="mb-5 font-[family-name:var(--font-display)] text-lg font-semibold text-white">
          Complete your academic details
        </h3>

        {success ? (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300" htmlFor="complete-name">
              Full name
              <input
                id="complete-name"
                className={fieldClass}
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="complete-email">
              Email
              <input
                id="complete-email"
                type="email"
                className={fieldClass}
                value={form.email}
                readOnly
                disabled
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="complete-college">
              College
              <input
                id="complete-college"
                type="text"
                className={fieldClass}
                value={form.college}
                onChange={(e) => updateField('college', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="complete-branch">
              Branch
              <input
                id="complete-branch"
                type="text"
                className={fieldClass}
                value={form.branch}
                onChange={(e) => updateField('branch', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="complete-graduation-year">
              Graduation year
              <input
                id="complete-graduation-year"
                type="number"
                className={fieldClass}
                value={form.graduationYear}
                onChange={(e) => updateField('graduationYear', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="complete-cgpa">
              CGPA (0–10, optional)
              <input
                id="complete-cgpa"
                type="number"
                min="0"
                max="10"
                step="0.01"
                className={fieldClass}
                value={form.cgpa}
                onChange={(e) => updateField('cgpa', e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="complete-location">
              Location (optional)
              <input
                id="complete-location"
                type="text"
                className={fieldClass}
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
              />
            </label>
          </div>
          <div className="sm:grid-cols-2">
            <label className="block text-sm text-slate-300" htmlFor="complete-skills">
              Skills (comma-separated, optional)
              <input
                id="complete-skills"
                type="text"
                className={fieldClass}
                value={skillsInput}
                onChange={(e) => {
                  setSkillsInput(e.target.value)
                  setError('')
                }}
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="complete-interests">
              Career interests (comma-separated, optional)
              <input
                id="complete-interests"
                type="text"
                className={fieldClass}
                value={careerInterestsInput}
                onChange={(e) => {
                  setCareerInterestsInput(e.target.value)
                  setError('')
                }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Card>
    </div>
  )
}