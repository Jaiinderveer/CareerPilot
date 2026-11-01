import { Bell, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { studentProfile } from '../../data/demoData'
import Avatar from '../ui/Avatar'

export default function TopBar({ title, breadcrumb, onMenuClick }) {
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
            {breadcrumb ? (
              <p className="mb-0.5 truncate text-xs text-slate-500">{breadcrumb}</p>
            ) : null}
            <h1 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-white md:text-2xl">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="relative rounded-xl border border-slate-800 bg-[#10182A] p-2.5 text-slate-300 transition hover:border-violet-500/30 hover:text-white"
            aria-label="Notifications (decorative)"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </button>

          <Link
            to="/profile"
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#10182A] py-1.5 pr-3 pl-1.5 transition hover:border-violet-500/30"
          >
            <Avatar name={studentProfile.name} size="sm" />
            <span className="hidden text-sm text-slate-200 sm:inline">{studentProfile.name}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
