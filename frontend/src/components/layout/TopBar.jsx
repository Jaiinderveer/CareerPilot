import { Bell, ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getDisplayName } from '../../utils/identity'
import { studentProfile } from '../../data/demoData'
import Avatar from '../ui/Avatar'

function IdentitySkeleton() {
  return (
    <div className="flex items-center gap-2" aria-label="Loading account identity">
      <div className="h-8 w-8 animate-pulse rounded-full bg-slate-700/70" />
      <div className="hidden h-3 w-20 animate-pulse rounded bg-slate-700/70 sm:block" />
    </div>
  )
}

export default function TopBar({ title, breadcrumb, onMenuClick }) {
  const { user, profile, loading, profileLoading, isConfigured, isDemoMode, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const menuRef = useRef(null)

  const identityLoading = !isDemoMode && (loading || profileLoading)
  const name = isDemoMode ? studentProfile.name : getDisplayName(user, profile)
  const email = isDemoMode ? studentProfile.email : user?.email ?? ''

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError('')
    const result = await signOut()
    if (result.error) {
      setSignOutError(result.error.message || 'Unable to sign out.')
      setSigningOut(false)
      return
    }
    setSigningOut(false)
    setOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070B16]/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg border border-slate-800 bg-[#10182A] p-2 text-slate-300 hover:text-white md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            {breadcrumb ? <p className="mb-0.5 truncate text-xs text-slate-500">{breadcrumb}</p> : null}
            <h1 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-white md:text-2xl">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="relative rounded-xl border border-slate-800 bg-card p-2.5 text-slate-300 transition hover:border-violet-500/30 hover:text-white"
            aria-label="Notifications (decorative)"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((previous) => !previous)}
              className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-800 bg-[#10182A] py-1.5 pr-2 pl-1.5 transition hover:border-violet-500/30"
              aria-label="Account menu"
              aria-expanded={open}
            >
              {identityLoading ? <IdentitySkeleton /> : (
                <>
                  <Avatar name={name} size="sm" />
                  <span className="hidden max-w-32 truncate text-sm text-slate-200 sm:inline">{name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </>
              )}
            </button>

            {open && !identityLoading ? (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-800 bg-[#0B1020] shadow-xl">
                <div className="border-b border-slate-800 px-4 py-3">
                  <p className="truncate text-sm font-medium text-white">{name}</p>
                  <p className="truncate text-xs text-slate-400">{email}</p>
                  {isDemoMode ? <p className="mt-1 text-[10px] uppercase tracking-wide text-cyan-400">Demo mode</p> : null}
                  {signOutError ? <p className="mt-1 text-xs text-rose-300">{signOutError}</p> : null}
                </div>
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-[#10182A]"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  My Profile
                </Link>
                {!isDemoMode ? (
                  <Link
                    to="/account-settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-[#10182A]"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Account Settings
                  </Link>
                ) : null}
                <div className="border-t border-slate-800 px-4 py-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2 text-sm text-rose-300 transition hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {signingOut ? 'Signing out…' : 'Sign Out'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
