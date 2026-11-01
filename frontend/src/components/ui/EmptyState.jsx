import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'Nothing here yet', description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-[#10182A]/50 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-100">
        {title}
      </h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p> : null}
    </div>
  )
}
