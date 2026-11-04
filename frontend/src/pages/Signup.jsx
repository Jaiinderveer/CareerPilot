import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSignupRedirectTo } from '../utils/authRedirect'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'

function AuthPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070B16] text-sm text-slate-400">
      Loading session…
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.35 12.27c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
      <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.97.92-3.31.92-2.54 0-4.7-1.72-5.48-4.03H3.27v2.53A9.74 9.74 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.52 13.83A5.86 5.86 0 0 1 6.2 12c0-.64.11-1.26.32-1.83V7.64H3.27A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.02 4.36l3.25-2.53Z" />
      <path fill="#EA4335" d="M12 6.14c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.22 14.63 2.25 12 2.25a9.74 9.74 0 0 0-8.73 5.39l3.25 2.53c.78-2.31 2.94-4.03 5.48-4.03Z" />
    </svg>
  )
}

// Form field class for consistent styling
const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-700 bg-[#10182A] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60'

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function toForm(profile, user) {
  return {
    full_name: profile?.full_name ?? user?.user_metadata?.full_name ?? '',
    email: user?.email ?? '',
    college: profile?.college ?? 'Guru Nanak Dev Engineering College',
    branch: profile?.branch ?? '',
    graduationYear: profile?.graduation_year ?? '',
    cgpa: profile?.cgpa == null ? '' : String(profile.cgpa),
    location: profile?.location ?? '',
    skills: toList(profile?.skills),
    careerInterests: toList(profile?.career_interests ?? profile?.careerInterests),
  }
}

function toProfileRecord(form, userId) {
  return {
    id: userId,
    full_name: form.full_name.trim(),
    college: form.college.trim(),
    branch: form.branch.trim(),
    graduation_year: form.graduationYear === '' ? null : Number(form.graduationYear),
    cgpa: form.cgpa === '' ? null : Number(form.cgpa),
    location: form.location.trim(),
    skills: toList(form.skills),
    career_interests: toList(form.careerInterests),
  }
}

export default function Signup() {
  const [formState, setFormState] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    college: 'Guru Nanak Dev Engineering College',
    branch: '',
    graduationYear: '',
    cgpa: '',
    location: '',
    skills: '',
    careerInterests: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { session, loading, isConfigured, isDemoMode, signInWithOAuth, signUp, error: authError } = useAuth()
  const [oauthLoading, setOauthLoading] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, navigate, session])

  if (loading) return <AuthPageLoading />

  // Derive form fields from state
  const { full_name, email, password, confirmPassword, college, branch, graduationYear, cgpa, location, skills, careerInterests } = formState

  async function handleGoogleSignup() {
    setError('')
    setNotice('')

    if (!isConfigured) {
      setError('Authentication is unavailable in demo mode. Configure Supabase to continue with Google.')
      return
    }

    setOauthLoading(true)
    const result = await signInWithOAuth('google', {
      redirectTo: getSignupRedirectTo(),
    })

    if (result?.error) {
      setError(result.error.message || 'Google signup failed. Please try again.')
      setOauthLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    // Validate required fields
    if (!full_name.trim()) {
      setError('Full name is required.')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Valid email is required.')
      return
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!college.trim()) {
      setError('College is required.')
      return
    }
    if (!branch.trim()) {
      setError('Branch is required.')
      return
    }
    if (!graduationYear.trim()) {
      setError('Graduation year is required.')
      return
    }
    const gy = Number(graduationYear)
    if (!Number.isInteger(gy) || gy < 1900 || gy > 2100) {
      setError('Graduation year must be a valid year between 1900 and 2100.')
      return
    }
    if (cgpa !== '' && (isNaN(cgpa) || Number(cgpa) < 0 || Number(cgpa) > 10)) {
      setError('CGPA must be between 0 and 10.')
      return
    }

    setSubmitting(true)

    const profileData = {
      fullName: full_name,
      college: college,
      branch: branch,
      graduationYear: graduationYear,
      cgpa: cgpa,
      location: location,
      skills: toList(skills),
      careerInterests: toList(careerInterests),
    }

    const result = await signUp(email.trim(), password, profileData)

    if (result.error) {
      setError(result.error.message || 'Signup failed. Please try again.')
      setSubmitting(false)
      return
    }

    if (result.needsEmailConfirmation) {
      setNotice('Account created. Check your email and confirm your address before signing in.')
    } else if (result.session) {
      navigate('/dashboard', { replace: true })
    } else {
      setNotice('Account created. Check your email before signing in.')
    }

    setSubmitting(false)
  }

  const displayError = error || (isDemoMode ? '' : (authError?.message || ''))

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#070B16] to-[#0B1020] p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800/50 bg-[#0B1020] p-8 backdrop-blur-md">
        <h2 className="mb-6 text-center text-2xl font-semibold text-white">Create account</h2>

        {isDemoMode ? (
          <div className="mb-4 rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
            Demo mode — Supabase is not configured, so account creation is unavailable.
          </div>
        ) : null}

        {displayError ? (
          <div className="mb-4 rounded border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {displayError}
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4 rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="signup-fullname">Full name</label>
            <input
              id="signup-fullname"
              type="text"
              value={full_name}
              onChange={(event) =>
                setFormState({ ...formState, full_name: event.target.value })
              }
              className={fieldClass}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(event) =>
                setFormState({ ...formState, email: event.target.value })
              }
              className={fieldClass}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(event) =>
                setFormState({ ...formState, password: event.target.value })
              }
              className={fieldClass}
              minLength={6}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="signup-confirm-password">Confirm password</label>
            <input
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setFormState({ ...formState, confirmPassword: event.target.value })
              }
              className={fieldClass}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="sm:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-300" htmlFor="signup-college">College</label>
              <input
                id="signup-college"
                type="text"
                value={college}
                onChange={(event) =>
                  setFormState({ ...formState, college: event.target.value })
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300" htmlFor="signup-branch">Branch</label>
              <input
                id="signup-branch"
                type="text"
                value={branch}
                onChange={(event) =>
                  setFormState({ ...formState, branch: event.target.value })
                }
                className={fieldClass}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300" htmlFor="signup-graduation-year">Graduation year</label>
            <input
              id="signup-graduation-year"
              type="number"
              value={graduationYear}
              onChange={(event) =>
                setFormState({ ...formState, graduationYear: event.target.value })
              }
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300" htmlFor="signup-cgpa">CGPA (0–10, optional)</label>
            <input
              id="signup-cgpa"
              type="number"
              min="0"
              max="10"
              step="0.01"
              value={cgpa}
              onChange={(event) =>
                setFormState({ ...formState, cgpa: event.target.value })
              }
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300" htmlFor="signup-location">Location (optional)</label>
            <input
              id="signup-location"
              type="text"
              value={location}
              onChange={(event) =>
                setFormState({ ...formState, location: event.target.value })
              }
              className={fieldClass}
            />
          </div>
          <div className="sm:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-300" htmlFor="signup-skills">Skills (comma-separated, optional)</label>
              <input
                id="signup-skills"
                type="text"
                value={skills}
                onChange={(event) =>
                  setFormState({ ...formState, skills: event.target.value })
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300" htmlFor="signup-interests">Career interests (comma-separated, optional)</label>
              <input
                id="signup-interests"
                type="text"
                value={careerInterests}
                onChange={(event) =>
                  setFormState({ ...formState, careerInterests: event.target.value })
                }
                className={fieldClass}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-violet-300 underline hover:text-violet-200">Sign in</Link>
        </p>

        <div className="relative my-6 flex items-center">
          <div className="flex-grow border-t border-slate-700" />
          <span className="mx-4 flex-shrink text-xs text-slate-500">OR</span>
          <div className="flex-grow border-t border-slate-700" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={submitting || oauthLoading || !isConfigured}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-800 bg-[#10182A] py-3 px-4 text-sm font-medium text-slate-300 transition hover:border-violet-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Sign up with Google"
        >
          <GoogleIcon />
          <span>{oauthLoading ? 'Redirecting…' : 'Sign up with Google'}</span>
        </button>
      </div>
    </div>
  )
}