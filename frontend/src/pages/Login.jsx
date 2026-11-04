import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getLoginRedirectTo } from '../utils/authRedirect'
import { useAuth } from '../context/AuthContext'

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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const navigate = useNavigate()
  const { session, loading, isConfigured, isDemoMode, signIn, signInWithOAuth, error: authError } = useAuth()

  useEffect(() => {
    if (!loading && session) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, navigate, session])

  if (loading) return <AuthPageLoading />

  async function handleGoogleLogin() {
    setError('')

    if (!isConfigured) {
      setError('Authentication is unavailable in demo mode. Configure Supabase to continue with Google.')
      return
    }

    setOauthLoading(true)
    const result = await signInWithOAuth('google', {
      redirectTo: getLoginRedirectTo(),
    })

    if (result?.error) {
      setError(result.error.message || 'Google sign-in failed. Please try again.')
      setOauthLoading(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!isConfigured) {
      setError('Authentication is unavailable in demo mode. Configure Supabase to sign in.')
      return
    }

    setSubmitting(true)
    const result = await signIn(email.trim(), password)

    if (result.error) {
      setError(result.error.message || 'Login failed. Please check your credentials.')
    } else if (result.session) {
      navigate('/dashboard', { replace: true })
    } else {
      setError('Login did not create a session. Please try again.')
    }

    setSubmitting(false)
  }

  const displayError = error || authError?.message

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#070B16] to-[#0B1020] p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800/50 bg-[#0B1020] p-8 backdrop-blur-md">
        <h2 className="mb-6 text-center text-2xl font-semibold text-white">Welcome back</h2>

        {isDemoMode ? (
          <div className="mb-4 rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
            Demo mode — Supabase is not configured, so authentication is unavailable.
          </div>
        ) : null}

        {displayError ? (
          <div className="mb-4 rounded border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {displayError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#10182A] px-3 py-2.5 text-slate-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#10182A] px-3 py-2.5 text-slate-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-violet-300 underline hover:text-violet-200">Sign up</Link>
        </p>

        <div className="relative my-6 flex items-center">
          <div className="flex-grow border-t border-slate-700" />
          <span className="mx-4 flex-shrink text-xs text-slate-500">OR</span>
          <div className="flex-grow border-t border-slate-700" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting || oauthLoading || !isConfigured}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-800 bg-[#10182A] py-3 px-4 text-sm font-medium text-slate-300 transition hover:border-violet-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Sign in with Google"
        >
          <GoogleIcon />
          <span>{oauthLoading ? 'Redirecting…' : 'Continue with Google'}</span>
        </button>
      </div>
    </div>
  )
}