export default function Card({ children, className = '', hover = true }) {
  return (
    <div
      className={`rounded-2xl border border-[#1e293b] bg-[#10182A]/90 backdrop-blur-sm ${
        hover
          ? 'transition duration-200 hover:border-violet-500/30 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.12)]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
