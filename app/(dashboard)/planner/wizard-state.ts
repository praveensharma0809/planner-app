export interface PlannerWizardProgress {
  phase: number
  maxPhase: number
}

export interface PlannerPhaseDefinition {
  id: number
  shortLabel: string
  title: string
  description: string
}

export const MIN_PLANNER_PHASE = 1
export const MAX_PLANNER_PHASE = 3
export const PLANNER_WIZARD_STORAGE_KEY = "planner-wizard-progress-v2"

export const PLANNER_PHASES: PlannerPhaseDefinition[] = [
  {
    id: 1,
    shortLabel: "Intake",
    title: "Phase 1: Intake",
    description: "Configure structure, chapter parameters, and scheduling constraints.",
  },
  {
    id: 2,
    shortLabel: "Preview",
    title: "Phase 2: Plan Preview",
    description: "Review generated sessions and tune before commit.",
  },
  {
    id: 3,
    shortLabel: "Confirm",
    title: "Phase 3: Confirm + Commit",
    description: "Choose commit strategy and save the final plan.",
  },
]

export function clampWizardPhase(input: number): number {
  if (!Number.isFinite(input)) return MIN_PLANNER_PHASE
  return Math.min(MAX_PLANNER_PHASE, Math.max(MIN_PLANNER_PHASE, Math.trunc(input)))
}

export function createDefaultWizardProgress(): PlannerWizardProgress {
  return {
    phase: MIN_PLANNER_PHASE,
    maxPhase: MIN_PLANNER_PHASE,
  }
}

export function loadWizardProgress(): PlannerWizardProgress | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.sessionStorage.getItem(PLANNER_WIZARD_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PlannerWizardProgress>
    const phase = clampWizardPhase(parsed.phase ?? MIN_PLANNER_PHASE)
    const maxPhase = clampWizardPhase(parsed.maxPhase ?? MIN_PLANNER_PHASE)

    return {
      phase: Math.min(phase, maxPhase),
      maxPhase,
    }
  } catch {
    return null
  }
}

export function saveWizardProgress(progress: PlannerWizardProgress) {
  if (typeof window === "undefined") return

  const maxPhase = clampWizardPhase(progress.maxPhase)
  const phase = Math.min(clampWizardPhase(progress.phase), maxPhase)

  try {
    window.sessionStorage.setItem(
      PLANNER_WIZARD_STORAGE_KEY,
      JSON.stringify({ phase, maxPhase })
    )
  } catch {
    // Ignore storage write failures.
  }
}

export function clearWizardProgress() {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.removeItem(PLANNER_WIZARD_STORAGE_KEY)
  } catch {
    // Ignore storage deletion failures.
  }
}
