import { NavLink } from 'react-router-dom'
import {
  Briefcase,
  Building2,
  LayoutDashboard,
  Map,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { navItems, studentProfile } from '../../data/demoData'
import Avatar from '../ui/Avatar'

const icons = {
  LayoutDashboard,
  Map,
  Building2,
  Briefcase,
  Sparkles,
  User,
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-[#0B1020] transition-transform duration-300 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-[0_0_24px_rgba(139,92,246,0.35)]">
              <span className="font-[family-name:var(--font-display)] text-sm font-bold text-white">
                CP
              </span>
            </div>
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-white">
                CareerPilot
              </p>
              <p className="text-xs text-slate-400">GNDEC · Demo UI</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = icons[item.icon]
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-300 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                  }`
                }
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#10182A] p-3">
            <Avatar name={studentProfile.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{studentProfile.name}</p>
              <p className="truncate text-xs text-slate-400">{studentProfile.branch}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
