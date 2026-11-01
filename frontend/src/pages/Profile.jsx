import { useEffect, useRef, useState } from 'react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { studentProfile } from '../data/demoData'
import { getDisplayName } from '../utils/identity'

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
    name: profile?.full_name ?? profile?.name ?? user?.user_metadata?.full_name ?? '',
    email: user?.email ?? profile?.email ?? '',
    college: profile?.college ?? '',
    branch: profile?.branch ?? '',
    graduationYear: profile?.graduation_year ?? profile?.graduationYear ?? '',
    cgpa: profile?.cgpa == null ? '' : String(profile.cgpa),
    location: profile?.location ?? '',
    skills: toList(profile?.skills),
    careerInterests: toList(profile?.career_interests ?? profile?.careerInterests),
  }
}

function toProfileRecord(form, userId, skillsInput, careerInterestsInput) {
  return {
    id: userId,
    full_name: form.name.trim(),
    college: form.college.trim(),
    branch: form.branch.trim(),
    graduation_year: form.graduationYear === '' ? null : Number(form.graduationYear),
    cgpa: form.cgpa === '' ? null : Number(form.cgpa),
    location: form.location.trim(),
    skills: toList(skillsInput),
    career_interests: toList(careerInterestsInput),
  }
}

export default function Profile() {
  const {
    user,
    profile: authProfile,
    loading: authLoading,
    profileLoading,
    profileError,
    isConfigured,
    isDemoMode,
    updateProfile,
  } = useAuth()
  const emptyForm = {
    name: '',
    email: '',
    college: '',
    branch: '',
    graduationYear: '',
    cgpa: '',
    location: '',
    skills: [],
    careerInterests: [],
  }
  const initialForm = isDemoMode ? toForm(null, studentProfile) : emptyForm
  const [form, setForm] = useState(initialForm)
  const [savedForm, setSavedForm] = useState(initialForm)
  const [skillsInput, setSkillsInput] = useState(initialForm.skills.join(', '))
  const [careerInterestsInput, setCareerInterestsInput] = useState(initialForm.careerInterests.join(', '))
  const skillsInputFocusedRef = useRef(false)
  const careerInterestsInputFocusedRef = useRef(false)
  const [loading, setLoading] = useState(!isDemoMode && isConfigured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const identityLoading = !isDemoMode && (authLoading || profileLoading)

  useEffect(() => {
    if (isDemoMode) {
      const demoForm = toForm(null, studentProfile)
      setForm(demoForm)
      setSavedForm(demoForm)
      if (!skillsInputFocusedRef.current) setSkillsInput(demoForm.skills.join(', '))
      if (!careerInterestsInputFocusedRef.current) setCareerInterestsInput(demoForm.careerInterests.join(', '))
      setLoading(false)
      return
    }

    if (authLoading || profileLoading || !isConfigured) return

    if (!user?.id || !supabase) {
      setError('No authenticated user is available for this profile.')
      setLoading(false)
      return
    }

    const nextForm = toForm(authProfile, user)
    setForm(nextForm)
    setSavedForm(nextForm)
    if (!skillsInputFocusedRef.current) setSkillsInput(nextForm.skills.join(', '))
    if (!careerInterestsInputFocusedRef.current) setCareerInterestsInput(nextForm.careerInterests.join(', '))
    setLoading(false)
  }, [authLoading, authProfile, isConfigured, isDemoMode, profileLoading, user])

  useEffect(() => {
    if (profileError) setError(profileError.message || 'Failed to load your profile.')
  }, [profileError])

  const preferredName = isDemoMode ? studentProfile.name : getDisplayName(user, authProfile || form)

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (isDemoMode) {
      setSavedForm(form)
      setSuccess('Demo changes saved locally for this session.')
      return
    }

    if (!user?.id || !supabase) {
      setError('You must be signed in to save a profile.')
      return
    }

    const graduationYear = form.graduationYear === '' ? null : Number(form.graduationYear)
    const cgpa = form.cgpa === '' ? null : Number(form.cgpa)
    const skills = toList(skillsInput)
    const careerInterests = toList(careerInterestsInput)

    if (graduationYear !== null && !Number.isInteger(graduationYear)) {
      setError('Graduation year must be a whole number.')
      return
    }
    if (cgpa !== null && (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 9.99)) {
      setError('CGPA must be between 0 and 9.99.')
      return
    }

    setSaving(true)

    try {
      const record = toProfileRecord(form, user.id, skillsInput, careerInterestsInput)
      const { data, error: saveError } = await supabase
        .from('profiles')
        .upsert(record, { onConflict: 'id' })
        .select('id, full_name, college, branch, graduation_year, cgpa, location, skills, career_interests, created_at, updated_at')
        .single()

      if (saveError) throw saveError

      const nextForm = toForm(data, user)
      setForm(nextForm)
      setSavedForm(nextForm)
      setSkillsInput(nextForm.skills.join(', '))
      setCareerInterestsInput(nextForm.careerInterests.join(', '))
      setSuccess('Profile saved to Supabase.')
      updateProfile(data)
    } catch (saveError) {
      setError(saveError.message || 'Failed to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setForm(savedForm)
    setSkillsInput(savedForm.skills.join(', '))
    setCareerInterestsInput(savedForm.careerInterests.join(', '))
    setError('')
    setSuccess('')
  }

  if (authLoading || loading) {
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
          <Avatar name={preferredName} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white">
                {identityLoading ? 'Loading profile…' : preferredName || 'Student profile'}
              </h2>
              <Badge tone={isDemoMode ? 'secondary' : 'success'}>
                {isDemoMode ? 'Demo mode' : 'Authenticated'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {form.college || 'College not set'}{form.graduationYear ? ` · Class of ${form.graduationYear}` : ''}
            </p>
            <p className="mt-1 text-xs text-slate-500">{form.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {form.branch ? <Badge tone="primary">{form.branch}</Badge> : null}
              {form.cgpa ? <Badge tone="secondary">CGPA {form.cgpa}</Badge> : null}
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
              {isDemoMode ? 'Demo mode changes stay local to this session.' : 'Changes are saved to your authenticated Supabase profile.'}
            </p>
          </div>
          {success ? <Badge tone="success">{success}</Badge> : null}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-300" htmlFor="profile-name">
              Name
              <input
                id="profile-name"
                className={fieldClass}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="profile-email">
              Account email
              <input
                id="profile-email"
                type="email"
                className={fieldClass}
                value={form.email}
                readOnly
                disabled
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2" htmlFor="profile-college">
              College
              <input
                id="profile-college"
                className={fieldClass}
                value={form.college}
                onChange={(event) => updateField('college', event.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="profile-branch">
              Branch
              <input
                id="profile-branch"
                className={fieldClass}
                value={form.branch}
                onChange={(event) => updateField('branch', event.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="profile-graduation-year">
              Graduation year
              <input
                id="profile-graduation-year"
                type="number"
                className={fieldClass}
                value={form.graduationYear}
                onChange={(event) => updateField('graduationYear', event.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="profile-cgpa">
              CGPA
              <input
                id="profile-cgpa"
                type="number"
                min="0"
                max="9.99"
                step="0.01"
                className={fieldClass}
                value={form.cgpa}
                onChange={(event) => updateField('cgpa', event.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="profile-location">
              Location
              <input
                id="profile-location"
                className={fieldClass}
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2" htmlFor="profile-skills">
              Skills (comma-separated)
              <input
                id="profile-skills"
                className={fieldClass}
                value={skillsInput}
                onFocus={() => { skillsInputFocusedRef.current = true }}
                onBlur={() => { skillsInputFocusedRef.current = false }}
                onChange={(event) => {
                  setSkillsInput(event.target.value)
                  setSuccess('')
                }}
              />
            </label>
            <label className="block text-sm text-slate-300 sm:col-span-2" htmlFor="profile-interests">
              Career interests (comma-separated)
              <input
                id="profile-interests"
                className={fieldClass}
                value={careerInterestsInput}
                onFocus={() => { careerInterestsInputFocusedRef.current = true }}
                onBlur={() => { careerInterestsInputFocusedRef.current = false }}
                onChange={(event) => {
                  setCareerInterestsInput(event.target.value)
                  setSuccess('')
                }}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : isDemoMode ? 'Save demo changes' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-xl border border-slate-700 bg-[#0B1020] px-4 py-2.5 text-sm text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}