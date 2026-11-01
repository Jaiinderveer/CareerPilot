export default function Avatar({ name = 'User', size = 'md', className = '' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 font-semibold text-white ${sizes[size] || sizes.md} ${className}`}
      aria-hidden="true"
    >
      {initials || 'U'}
    </div>
  )
}
