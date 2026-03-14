export type ProgressVariant = "default" | "success" | "warning" | "danger"

interface ProgressProps {
  value: number // 0–100
  variant?: ProgressVariant
  height?: number
  className?: string
  showLabel?: boolean
}

const variantClass: Record<ProgressVariant, string> = {
  default: "ui-progress-default",
  success: "ui-progress-success",
  warning: "ui-progress-warning",
  danger:  "ui-progress-danger",
}

export function Progress({
  value,
  variant = "default",
  height = 6,
  className = "",
  showLabel = false,
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="ui-progress-track flex-1"
        style={{ height }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`ui-progress-bar ${variantClass[variant]}`}
          style={{ width: `${Math.max(clamped, 2)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums" style={{ color: "var(--sh-text-muted)", minWidth: "2.5rem", textAlign: "right" }}>
          {clamped}%
        </span>
      )}
    </div>
  )
}
