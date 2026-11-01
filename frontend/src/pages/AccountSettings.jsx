import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0B1020] px-3 py-2.5 pr-11 text-sm text-slate-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60'

function getIdentities(user) {
  return Array.isArray(user?.identities) ? user.identities : []
}

function isPasswordIdentity(identity) {
  return identity?.provider === 'email' || identity?.identity_data?.provider === 'email'
}

function hasPasswordFromUser(user) {
  // Check app_metadata.providers first (authoritative source for auth providers)
  const providers = user?.app_metadata?.providers
  if (Array.isArray(providers) && providers.includes('email')) {
    return true
  }
  // Fall back to checking identities
  const identities = Array.isArray(user?.identities) ? user.identities : []
  return identities.some(isPasswordIdentity)
}

function getProviderLabel(provider) {
  if (provider === 'google') return 'Google'
  if (provider === 'email') return 'Email and password'
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown'
}

function getStrength(password) {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  return checks.filter(Boolean).length
}

export default function AccountSettings() {
  const { user, loading: authLoading, isConfigured, isDemoMode, updatePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [passwordConfigured, setPasswordConfigured] = useState(() => {
    if (!user) return false
    // A persisted flag survives refresh/re-login even when Supabase's
    // identities/providers metadata is stale after updateUser({ password }).
    try {
      const stored = localStorage.getItem(`careerpilot:password-configured:${user.id}`)
      if (stored === 'true') return true
    } catch {}
    return hasPasswordFromUser(user)
  })

  const identities = useMemo(() => getIdentities(user), [user])
  const hasPassword = identities.some(isPasswordIdentity)
  const strength = getStrength(newPassword)
  const passwordReady = strength >= 4
  const passwordAction = passwordConfigured ? 'Change password' : 'Set password'

  useEffect(() => {
    if (!user) return
    // Promote to true when the server or localStorage confirms password login.
    // Never demote to false based on server data alone, because Supabase may
    // not immediately add an email identity/provider after updateUser({ password }).
    const serverHasPassword = hasPasswordFromUser(user)
    try {
      const stored = localStorage.getItem(`careerpilot:password-configured:${user.id}`)
      if (serverHasPassword || stored === 'true') {
        setPasswordConfigured(true)
      }
    } catch {}
  }, [user?.id])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isConfigured || isDemoMode || !user) {
      setError('You must be signed in to manage account security.')
      return
    }
    if (!passwordReady) {
      setError('Use at least 8 characters with uppercase, lowercase, a number, and a symbol.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    const result = await updatePassword(newPassword)
    setSaving(false)

    if (result.error) {
      setError(result.error.message || 'Unable to update your password.')
      return
    }

    setPasswordConfigured(true)
    if (user?.id) {
      try {
        localStorage.setItem(`careerpilot:password-configured:${user.id}`, 'true')
      } catch {}
    }
    setNewPassword('')
    setConfirmPassword('')
    setSuccess('Password login is now configured for this account.')
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center text-sm text-slate-400">
        Loading account security…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-6" hover={false}>
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-violet-500/15 p-3 text-violet-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-white">
              Account security
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage how you sign in to CareerPilot. Passwords are handled by Supabase Auth and are never stored in the app.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6" hover={false}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
              Sign-in methods
            </h3>
            <p className="mt-1 text-sm text-slate-400">Connected providers for {user?.email || 'your account'}.</p>
          </div>
          <Badge tone={passwordConfigured ? 'success' : 'secondary'}>
            {passwordConfigured ? 'Password configured' : 'Password login not configured'}
          </Badge>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0B1020] px-4 py-3">
            <div className="flex items-center gap-3">
              <KeyRound className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-200">Account email</p>
                <p className="text-xs text-slate-500">{user?.email || 'Email unavailable'}</p>
              </div>
            </div>
            {passwordConfigured ? (
              <Badge tone="success">Connected</Badge>
            ) : null}
          </div>

          {(() => {
            // Separate OAuth identities from email/password status. Email/password
            // is represented by the "Account email" row above, so OAuth identities
            // (Google, etc.) are listed here to avoid duplicate method cards.
            const oauthIdentities = identities.filter(
              (identity) =>
                identity.provider !== 'email' && identity.identity_data?.provider !== 'email'
            )

            const renderedIdentities = oauthIdentities.map((identity) => {
              const key = identity.id || identity.provider
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0B1020] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">{getProviderLabel(identity.provider)}</p>
                    <p className="text-xs text-slate-500">Connected authentication provider</p>
                  </div>
                  <Badge tone="success">Connected</Badge>
                </div>
              )
            })

            return renderedIdentities.length ? renderedIdentities : (
              <p className="rounded-xl border border-slate-800 bg-[#0B1020] px-4 py-3 text-sm text-slate-400">
                Provider details are unavailable for this session.
              </p>
            )
          })()}
        </div>
      </Card>

      <Card className="p-6" hover={false}>
        <div className="mb-5">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">
            {passwordAction}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {passwordConfigured
              ? 'Update your password while signed in. Your Google connection remains unchanged.'
              : 'Add email/password login to this same authenticated account. No second account will be created.'}
          </p>
        </div>

        {success ? (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200" role="status">
            {success}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm text-slate-300" htmlFor="account-new-password">
            New password
            <div className="relative">
              <input
                id="account-new-password"
                type={showNewPassword ? 'text' : 'password'}
                className={fieldClass}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value)
                  setSuccess('')
                }}
                autoComplete={hasPassword ? 'new-password' : 'new-password'}
                disabled={saving || !isConfigured || isDemoMode}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((value) => !value)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block text-sm text-slate-300" htmlFor="account-confirm-password">
            Confirm new password
            <div className="relative">
              <input
                id="account-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className={fieldClass}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setSuccess('')
                }}
                autoComplete="new-password"
                disabled={saving || !isConfigured || isDemoMode}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className="rounded-xl border border-slate-800 bg-[#0B1020] px-3 py-3 text-xs text-slate-400">
            <div className="mb-2 flex items-center justify-between">
              <span>Password strength</span>
              <span className={passwordReady ? 'text-emerald-300' : 'text-slate-500'}>
                {passwordReady ? 'Strong enough' : 'Use a stronger password'}
              </span>
            </div>
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((level) => (
                <span
                  key={level}
                  className={`h-1.5 flex-1 rounded-full ${level <= strength ? (strength >= 4 ? 'bg-emerald-400' : 'bg-amber-400') : 'bg-slate-700'}`}
                />
              ))}
            </div>
            <p className="mt-2">At least 8 characters, including uppercase, lowercase, a number, and a symbol.</p>
          </div>

          <button
            type="submit"
            disabled={saving || !isConfigured || isDemoMode}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {saving ? 'Saving password…' : passwordAction}
          </button>
        </form>
      </Card>
    </div>
  )
}
