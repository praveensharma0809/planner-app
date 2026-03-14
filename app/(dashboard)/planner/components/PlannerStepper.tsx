"use client"

const PHASE_LABELS = [
  "Structure",
  "Parameters",
  "Constraints",
  "Preview",
  "Confirm",
] as const

interface PlannerStepperProps {
  currentPhase: number
  onPhaseClick: (phase: number) => void
  maxReachedPhase: number
}

export default function PlannerStepper({
  currentPhase,
  onPhaseClick,
  maxReachedPhase,
}: PlannerStepperProps) {
  return (
    <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
      {PHASE_LABELS.map((label, i) => {
        const phase = i + 1
        const isActive = phase === currentPhase
        const isComplete = phase < currentPhase
        const isReachable = phase <= maxReachedPhase

        return (
          <button
            key={phase}
            onClick={() => isReachable && onPhaseClick(phase)}
            disabled={!isReachable}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
            style={{
              border: "1px solid",
              borderColor: isActive
                ? "var(--sh-primary-border, rgba(124,108,255,0.4))"
                : isComplete
                ? "var(--sh-success-border, rgba(52,211,153,0.3))"
                : "var(--sh-border)",
              background: isActive
                ? "rgba(124,108,255,0.12)"
                : isComplete
                ? "rgba(52,211,153,0.08)"
                : "var(--sh-card)",
              color: isActive
                ? "var(--nav-item-active-color, rgb(167,139,250))"
                : isComplete
                ? "rgb(52,211,153)"
                : "var(--sh-text-muted)",
              opacity: !isReachable ? 0.4 : 1,
              cursor: !isReachable ? "not-allowed" : "pointer",
            }}
          >
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
              style={{
                background: isActive
                  ? "var(--sh-primary, #7c6cff)"
                  : isComplete
                  ? "rgb(52,211,153)"
                  : "rgba(255,255,255,0.08)",
                color: isActive || isComplete ? "#fff" : "var(--sh-text-muted)",
              }}
            >
              {isComplete ? "✓" : phase}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
