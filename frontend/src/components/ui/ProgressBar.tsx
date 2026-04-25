import clsx from 'clsx'

interface ProgressBarProps {
  value: number  // 0-100
  label?: string
  className?: string
  color?: 'blue' | 'green' | 'yellow'
}

export function ProgressBar({ value, label, className, color = 'blue' }: ProgressBarProps) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  }

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs text-gray-300 font-medium">{value}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', colors[color])}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
