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
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap
              ${isActive ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : ""}
              ${isComplete ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : ""}
              ${!isActive && !isComplete ? "bg-white/[0.04] text-white/40 border border-white/[0.06]" : ""}
              ${!isReachable ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.08]"}
            `}
          >
            <span
              className={`
                flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                ${isActive ? "bg-indigo-500 text-white" : ""}
                ${isComplete ? "bg-emerald-500 text-white" : ""}
                ${!isActive && !isComplete ? "bg-white/[0.08] text-white/40" : ""}
              `}
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
