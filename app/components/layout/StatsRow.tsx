export interface StatItem {
  label: string
  value: string | number
  /** Tailwind color class, e.g. "bg-indigo-400" */
  dotColor?: string
  /** Optional sub-label rendered below value */
  sub?: string
}

interface StatsRowProps {
  stats: StatItem[]
}

/**
 * StatsRow — a row of compact stat chips shown below the PageHeader.
 *
 * Usage:
 *   <StatsRow stats={[{ label: "streak", value: "7", dotColor: "bg-orange-400" }]} />
 */
export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="stats-row">
      {stats.map((s) => (
        <div key={s.label} className="stats-chip">
          {s.dotColor && (
            <span className={`stats-chip-dot ${s.dotColor}`} aria-hidden="true" />
          )}
          <div className="min-w-0">
            <div className="stats-chip-value">{s.value}</div>
            <div className="stats-chip-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
