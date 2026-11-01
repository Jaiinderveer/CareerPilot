const tones = {
  primary: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  secondary: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  muted: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
}

export default function Badge({ children, tone = 'muted', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.muted} ${className}`}
    >
      {children}
    </span>
  )
}
