export default function ProgressBar({ value = 0, label, className = '' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-300">{label}</span>
          <span className="font-medium text-slate-100">{clamped}%</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
