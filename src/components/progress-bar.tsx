interface ProgressBarProps {
  label: string
  current: number
  target: number
  unit: string
  color?: string
}

export function ProgressBar({ label, current, target, unit, color = "bg-blue-500" }: ProgressBarProps) {
  const percentage = (current / target) * 100
  const isOverTarget = current > target

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs md:text-sm font-medium text-gray-800">{label}</span>
        <span className={`text-xs md:text-sm font-medium ${isOverTarget ? "text-red-700" : "text-gray-800"}`}>
          {current.toFixed(1)}/{target} {unit}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            isOverTarget ? "bg-red-500" : color
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="text-xs text-gray-700">
        {percentage.toFixed(1)}%
      </div>
    </div>
  )
}
