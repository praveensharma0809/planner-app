"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import {
  getPlanConfig,
  getStructure,
  getTopicParams,
  savePlanConfig,
  saveTopicParams,
  type IntakeImportMode,
} from "@/app/actions/planner/setup"
import {
  buildPlanIssues,
  getSessionCoverage,
  hasCriticalIssues,
  MISSING_GENERATED_SESSIONS_MESSAGE,
  type PlanIssue,
  type PlanIssueAction,
  type PlanIssueConstraintField,
  type PlannerConstraintValues as ConstraintValues,
  type PlannerParamValues as ParamValues,
  type PlannerSubjectOption,
} from "@/lib/planner/draft"
import {
  commitPlan,
  generatePlanAction,
  reoptimizePreviewPlan,
  type KeepPreviousMode,
} from "@/app/actions/planner/plan"
import type {
  FeasibilityResult,
  ScheduledSession,
} from "@/lib/planner/engine"
import { Button } from "@/app/components/ui"
import PlanConfirm from "./components/PlanConfirm"
import PlanIssueModal from "./components/PlanIssueModal"
import PlanPreview from "./components/PlanPreview"
import {
  SubjectsDataTable,
  type SubjectNavItem,
  type TopicTaskItem,
} from "./subjects-data-table"
import { PlanHistory } from "../dashboard/PlanHistory"
import {
  PLANNER_PHASES,
  clampWizardPhase,
  clearWizardProgress,
  createDefaultWizardProgress,
  loadWizardProgress,
  PLANNER_WIZARD_PROGRESS_EVENT,
  PLANNER_WIZARD_RESET_EVENT,
  saveWizardProgress,
} from "./wizard-state"
import {
  addDaysISO,
  buildDeadlineMap,
  buildParamsFromStructure,
  mapDbParamsToMap,
  mapDbToConstraintValues,
  roundedHours,
  type StructureSubject,
} from "./PlannerWizardClient.helpers"

interface PlannerWizardClientProps {
  initialSubjects: SubjectNavItem[]
  initialTasksByChapter: Record<string, TopicTaskItem[]>
  initialImportMode: IntakeImportMode
}

interface IssueComputationOverrides {
  constraints?: ConstraintValues | null
  params?: ParamValues[]
  feasibility?: FeasibilityResult | null
  sessions?: ScheduledSession[]
  planStatus?: string | null
}

export default function PlannerWizardClient({
  initialSubjects,
  initialTasksByChapter,
  initialImportMode,
}: PlannerWizardClientProps) {
  const { addToast } = useToast()
  const router = useRouter()

  const [phase, setPhase] = useState<number>(1)
  const [maxPhase, setMaxPhase] = useState<number>(1)

  const [paramMap, setParamMap] = useState<Map<string, ParamValues>>(new Map())
  const [subjectDeadlineState, setSubjectDeadlineState] = useState<Map<string, string>>(new Map())

  const [constraints, setConstraints] = useState<ConstraintValues | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const [sessions, setSessions] = useState<ScheduledSession[]>([])
  const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null)
  const [isReoptimizing, setIsReoptimizing] = useState(false)

  const [isCommitting, setIsCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<{
    status: string
    taskCount?: number
    message?: string
  } | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [planIssues, setPlanIssues] = useState<PlanIssue[]>([])
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [lastPlanStatus, setLastPlanStatus] = useState<string | null>(null)
  const [selectedIntakeTaskIds, setSelectedIntakeTaskIds] = useState<string[]>([])
  const [previewSubjects, setPreviewSubjects] = useState<StructureSubject[]>([])

  const [isAdvancing, setIsAdvancing] = useState(false)
  const hydratedRef = useRef(false)

  const fetchLatestConstraintsFromDb = useCallback(async (): Promise<ConstraintValues> => {
    const configRes = await getPlanConfig()

    if (configRes.status === "UNAUTHORIZED") {
      throw new Error("Please sign in.")
    }

    if (configRes.status === "ERROR") {
      throw new Error(configRes.message)
    }

    if (!configRes.config) {
      throw new Error("Step-2 config missing")
    }

    return mapDbToConstraintValues(configRes.config)
  }, [])

  useEffect(() => {
    const stored = loadWizardProgress()
    if (stored) {
      setPhase(stored.phase)
      setMaxPhase(stored.maxPhase)
    }
    hydratedRef.current = true
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    saveWizardProgress({ phase, maxPhase })
  }, [phase, maxPhase])

  const hydratePlannerInputs = useCallback(async (showErrors = false) => {
    const [structureRes, paramsRes, configRes] = await Promise.all([
      getStructure(),
      getTopicParams(),
      getPlanConfig(),
    ])

    if (structureRes.status === "SUCCESS") {
      setSubjectDeadlineState(buildDeadlineMap(structureRes.tree.subjects))
    } else if (structureRes.status === "ERROR") {
      if (showErrors) {
        addToast(structureRes.message, "error")
      }
    } else if (showErrors) {
      addToast("Please sign in to load planner setup.", "error")
    }

    if (paramsRes.status === "SUCCESS") {
      setParamMap(mapDbParamsToMap(paramsRes.params))
    } else if (showErrors) {
      addToast("Could not load topic parameters.", "error")
    }

    if (configRes.status === "SUCCESS" && configRes.config) {
      setConstraints(mapDbToConstraintValues(configRes.config))
    } else if (configRes.status === "ERROR") {
      if (showErrors) {
        addToast(configRes.message, "error")
      }
    }
  }, [addToast])

  useEffect(() => {
    void hydratePlannerInputs(false)
  }, [hydratePlannerInputs])

  const activePhase = useMemo(
    () => PLANNER_PHASES.find((item) => item.id === phase) ?? PLANNER_PHASES[0],
    [phase]
  )

  const goToPhase = useCallback((nextPhase: number) => {
    const normalized = clampWizardPhase(nextPhase)
    setPhase(normalized)
    setMaxPhase((current) => Math.max(current, normalized))
  }, [])

  const resetWizard = useCallback(() => {
    const baseline = createDefaultWizardProgress()
    setPhase(baseline.phase)
    setMaxPhase(baseline.maxPhase)
    setSessions([])
    setFeasibility(null)
    setCommitResult(null)
    setPlanIssues([])
    setLastPlanStatus(null)
    clearWizardProgress()
    addToast("Planner wizard reset to Phase 1.", "success")
  }, [addToast])

  useEffect(() => {
    const handleTopbarProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ phase: number; maxPhase: number }>).detail
      if (!detail) return
      setPhase(detail.phase)
      setMaxPhase(detail.maxPhase)
    }

    const handleTopbarReset = () => {
      resetWizard()
    }

    window.addEventListener(PLANNER_WIZARD_PROGRESS_EVENT, handleTopbarProgress)
    window.addEventListener(PLANNER_WIZARD_RESET_EVENT, handleTopbarReset)

    return () => {
      window.removeEventListener(PLANNER_WIZARD_PROGRESS_EVENT, handleTopbarProgress)
      window.removeEventListener(PLANNER_WIZARD_RESET_EVENT, handleTopbarReset)
    }
  }, [resetWizard])

  const recomputeIssues = useCallback((overrides?: IssueComputationOverrides) => {
    return buildPlanIssues({
      constraints: overrides?.constraints ?? constraints,
      params: overrides?.params ?? Array.from(paramMap.values()),
      feasibility: overrides?.feasibility ?? feasibility,
      sessions: overrides?.sessions ?? sessions,
      planStatus: overrides?.planStatus ?? lastPlanStatus,
    })
  }, [constraints, feasibility, lastPlanStatus, paramMap, sessions])

  const refreshIssues = useCallback((overrides?: IssueComputationOverrides) => {
    const issues = recomputeIssues(overrides)
    setPlanIssues(issues)
    return issues
  }, [recomputeIssues])

  const updateConstraintsWith = useCallback((
    updater: (previous: ConstraintValues) => ConstraintValues
  ) => {
    setConstraints((previous) => {
      if (!previous) return previous
      const next = updater(previous)
      setPlanIssues(recomputeIssues({ constraints: next }))
      return next
    })
  }, [recomputeIssues])

  const applyIssueConstraintField = useCallback((
    field: PlanIssueConstraintField,
    value: string | number
  ) => {
    updateConstraintsWith((previous) => {
      if (field === "study_start_date" || field === "exam_date") {
        return {
          ...previous,
          [field]: typeof value === "string" ? value : previous[field],
        }
      }

      if (typeof value !== "number") return previous

      const nextValue = (() => {
        switch (field) {
          case "weekday_capacity_minutes":
          case "weekend_capacity_minutes":
            return Math.max(0, value)
          case "max_active_subjects":
            return Math.min(8, Math.max(0, value))
          case "flexibility_minutes":
            return Math.min(120, Math.max(0, value))
          default:
            return value
        }
      })()

      return {
        ...previous,
        [field]: nextValue,
      }
    })
  }, [updateConstraintsWith])

  const handleIssueAction = useCallback((_: string, action: PlanIssueAction) => {
    if (action.kind === "jump") {
      setIsIssueModalOpen(false)
      goToPhase(action.jumpPhase)
      return
    }

    if (action.kind === "date_delta") {
      updateConstraintsWith((previous) => ({
        ...previous,
        [action.field]: addDaysISO(previous[action.field], action.days),
      }))
      return
    }

    const currentValue = Number(constraints?.[action.field] ?? 0)
    applyIssueConstraintField(action.field, currentValue + action.delta)
  }, [applyIssueConstraintField, constraints, goToPhase, updateConstraintsWith])

  const hasCriticalPlanIssues = useMemo(
    () => hasCriticalIssues(planIssues),
    [planIssues]
  )

  const sessionCoverage = useMemo(
    () => getSessionCoverage(feasibility, sessions),
    [feasibility, sessions]
  )
  const missingGeneratedSessions = sessionCoverage.missingGeneratedSessions

  useEffect(() => {
    if (!constraints && !feasibility && sessions.length === 0 && !lastPlanStatus) return
    setPlanIssues(recomputeIssues())
  }, [constraints, feasibility, lastPlanStatus, recomputeIssues, sessions])

  const subjectOptions: PlannerSubjectOption[] = useMemo(() => {
    if (previewSubjects.length > 0) {
      return previewSubjects
        .filter((subject) => subject.archived !== true)
        .map((subject) => {
          const activeTopics = subject.topics.filter((topic) => topic.archived !== true)
          return {
            id: subject.id,
            name: subject.name,
            deadline: subject.deadline ?? undefined,
            topicIds: activeTopics.map((topic) => topic.id),
            topics: activeTopics.map((topic) => ({ id: topic.id, name: topic.name })),
          }
        })
    }

    return initialSubjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      deadline: subjectDeadlineState.get(subject.id),
      topicIds: subject.chapters.map((chapter) => chapter.id),
      topics: subject.chapters.map((chapter) => ({ id: chapter.id, name: chapter.name })),
    }))
  }, [initialSubjects, previewSubjects, subjectDeadlineState])

  const previewTopicOptions = useMemo(() => {
    if (previewSubjects.length > 0) {
      return previewSubjects
        .filter((subject) => subject.archived !== true)
        .flatMap((subject) =>
          subject.topics
            .filter((topic) => topic.archived !== true)
            .map((topic) => ({
              id: topic.id,
              subjectId: subject.id,
              subjectName: subject.name,
              topicName: topic.name,
            }))
        )
    }

    return initialSubjects.flatMap((subject) =>
      subject.chapters.map((chapter) => ({
        id: chapter.id,
        subjectId: subject.id,
        subjectName: subject.name,
        topicName: chapter.name,
      }))
    )
  }, [initialSubjects, previewSubjects])

  const phaseTwoHeaderChips = useMemo(() => {
    if (phase !== 2 || !feasibility) return [] as string[]

    const totalMinutes = sessions.reduce((sum, session) => sum + session.duration_minutes, 0)
    const subjectCount = new Set(sessions.map((session) => session.subject_id)).size
    const topicCount = new Set(
      sessions.map((session) => session.topic_id).filter((topicId) => topicId.trim().length > 0)
    ).size
    const unplacedSessions = sessionCoverage.missingGeneratedSessions

    const chips = [
      `${sessions.length} sessions`,
      `${roundedHours(totalMinutes)}h total`,
      `${subjectCount} subjects`,
      `${topicCount} topics`,
      feasibility.feasible ? "Fit: Relaxed" : feasibility.flexFeasible ? "Fit: Snug" : "Fit: Overloaded",
    ]

    if (unplacedSessions > 0) {
      chips.push(`${unplacedSessions} unplaced`)
    }

    return chips
  }, [feasibility, phase, sessionCoverage.missingGeneratedSessions, sessions])

  async function continueToPreview() {
    setIsAdvancing(true)

    try {
      const scopedTaskIds = selectedIntakeTaskIds.length > 0 ? selectedIntakeTaskIds : undefined

      const structure = await getStructure({
        onlyUndoneTasks: true,
        dropTopicsWithoutTasks: true,
        selectedTaskIds: scopedTaskIds,
      })

      if (structure.status !== "SUCCESS") {
        if (structure.status === "ERROR") {
          addToast(structure.message, "error")
          return
        }
        addToast("Please sign in to continue.", "error")
        return
      }

      const subjectCount = structure.tree.subjects.length
      const chapterCount = structure.tree.subjects.reduce(
        (sum, subject) => sum + subject.topics.filter((topic) => topic.archived !== true).length,
        0
      )

      if (subjectCount === 0 || chapterCount === 0) {
        addToast(
          scopedTaskIds
            ? "No undone tasks matched your current task selection."
            : "Add at least one subject and one chapter before generating preview.",
          "error"
        )
        return
      }

      setSubjectDeadlineState(buildDeadlineMap(structure.tree.subjects))
      setPreviewSubjects(structure.tree.subjects)

      const [paramsRes, latestConstraints] = await Promise.all([
        getTopicParams(),
        fetchLatestConstraintsFromDb(),
      ])

      const existingParamMap = paramsRes.status === "SUCCESS"
        ? mapDbParamsToMap(paramsRes.params)
        : new Map<string, ParamValues>()

      const nextParams = buildParamsFromStructure(
        structure.tree.subjects,
        existingParamMap,
        latestConstraints.exam_date
      )

      const saveParamsRes = await saveTopicParams(
        nextParams.map((param) => ({
          topic_id: param.topic_id,
          estimated_hours: param.estimated_hours,
          deadline: param.deadline || null,
          earliest_start: param.earliest_start || null,
          depends_on: param.depends_on,
          session_length_minutes: param.session_length_minutes,
          rest_after_days: param.rest_after_days,
          max_sessions_per_day: param.max_sessions_per_day,
          study_frequency: param.study_frequency,
        }))
      )

      if (saveParamsRes.status !== "SUCCESS") {
        addToast(
          saveParamsRes.status === "ERROR" ? saveParamsRes.message : "Please sign in.",
          "error"
        )
        return
      }

      setParamMap(new Map(nextParams.map((param) => [param.topic_id, param])))
      setConstraints(latestConstraints)

      const generated = await runPlanGeneration(latestConstraints)
      if (generated) {
        addToast("Phase 1 complete. Preview is ready.", "success")
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Could not prepare the planner preview."
      addToast(message, "error")
    } finally {
      setIsAdvancing(false)
    }
  }

  const runPlanGeneration = useCallback(async (nextConstraints: ConstraintValues) => {
    try {
      setCommitResult(null)
      const saveRes = await savePlanConfig(nextConstraints)
      if (saveRes.status !== "SUCCESS") {
        addToast(saveRes.status === "ERROR" ? saveRes.message : "Please sign in.", "error")
        return false
      }

      const latestConstraints = await fetchLatestConstraintsFromDb()
      setConstraints(latestConstraints)

      setIsGenerating(true)
      let plan: Awaited<ReturnType<typeof generatePlanAction>>
      try {
        plan = await generatePlanAction({
          selectedTaskIds: selectedIntakeTaskIds,
        })
      } finally {
        setIsGenerating(false)
      }

      setLastPlanStatus(plan.status)

      let nextSessions: ScheduledSession[] = []
      let nextFeasibility: FeasibilityResult | null = null

      if (plan.status === "READY" || plan.status === "PARTIAL") {
        nextSessions = plan.schedule
        nextFeasibility = plan.feasibility
        setSessions(nextSessions)
        setFeasibility(nextFeasibility)
        goToPhase(2)
      } else if (plan.status === "INFEASIBLE") {
        nextFeasibility = plan.feasibility
        setFeasibility(nextFeasibility)
        setSessions([])
        goToPhase(1)
      } else if (plan.status === "NO_DAYS") {
        setFeasibility(null)
        setSessions([])
        goToPhase(1)
      } else if (plan.status === "NO_CONFIG") {
        addToast("Step-2 config missing. Save Step-2 constraints first.", "error")
        return false
      } else if (plan.status === "NO_TOPICS") {
        addToast("Add at least one pending task in your chapters before generating the plan.", "error")
        return false
      } else if (plan.status === "ERROR") {
        addToast(`Engine Error: ${plan.message}`, "error")
        return false
      } else if (plan.status === "UNAUTHORIZED") {
        addToast("Please sign in.", "error")
        return false
      }

      const issues = refreshIssues({
        constraints: latestConstraints,
        feasibility: nextFeasibility,
        sessions: nextSessions,
        planStatus: plan.status,
      })

      if (hasCriticalIssues(issues)) {
        setIsIssueModalOpen(true)
        addToast("Resolve critical plan issues in the issue window.", "error")
        return false
      }

      if (plan.status === "READY") {
        addToast("Plan generated and fully schedulable.", "success")
        return true
      }

      if (plan.status === "PARTIAL") {
        addToast("Plan generated with unplaced sessions. Review issues before commit.", "info")
        return true
      }

      if (plan.status === "INFEASIBLE" || plan.status === "NO_DAYS") {
        addToast("Plan check completed. Resolve issues to continue.", "info")
        return false
      }

      return true
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Could not generate planner preview."
      addToast(message, "error")
      return false
    }
  }, [addToast, fetchLatestConstraintsFromDb, goToPhase, refreshIssues, selectedIntakeTaskIds])

  async function handleIssueRecheck() {
    if (!constraints) return
    await runPlanGeneration(constraints)
  }

  function handleEditSessions(editedSessions: ScheduledSession[]) {
    setCommitResult(null)
    setSessions(editedSessions)
    refreshIssues({ sessions: editedSessions })
  }

  function handlePreviewConfirm() {
    const issues = refreshIssues()
    if (missingGeneratedSessions > 0) {
      setIsIssueModalOpen(true)
      addToast(MISSING_GENERATED_SESSIONS_MESSAGE, "error")
      return
    }

    if (hasCriticalIssues(issues)) {
      setIsIssueModalOpen(true)
      addToast("Fix critical issues before moving to commit.", "error")
      return
    }

    goToPhase(3)
  }

  async function handleReoptimizePreview(reservedSessions: ScheduledSession[]) {
    setIsReoptimizing(true)
    const result = await reoptimizePreviewPlan(reservedSessions, {
      selectedTaskIds: selectedIntakeTaskIds,
    })
    setIsReoptimizing(false)

    if (result.status === "SUCCESS") {
      setCommitResult(null)
      setSessions(result.schedule)
      setLastPlanStatus("READY")

      try {
        const scopedTaskIds = selectedIntakeTaskIds.length > 0 ? selectedIntakeTaskIds : undefined
        const structure = await getStructure({
          onlyUndoneTasks: true,
          dropTopicsWithoutTasks: true,
          selectedTaskIds: scopedTaskIds,
        })
        if (structure.status === "SUCCESS") {
          setPreviewSubjects(structure.tree.subjects)
        }
      } catch {
        // Reopt result is still usable even if structure refresh fails.
      }

      const issues = refreshIssues({ sessions: result.schedule, planStatus: "READY" })
      if (hasCriticalIssues(issues)) {
        setIsIssueModalOpen(true)
      }

      if (result.droppedSessions > 0) {
        addToast(`Re-optimized around pinned sessions. ${result.droppedSessions} session(s) are still unplaced.`, "info")
      } else {
        addToast("Re-optimized around pinned and manual sessions.", "success")
      }
      return
    }

    if (result.status === "NO_CONFIG") {
      addToast("Save constraints before re-optimizing the preview.", "error")
      return
    }

    if (result.status === "NO_TOPICS") {
      addToast("No pending chapter tasks were found to regenerate.", "error")
      return
    }

    addToast(result.status === "ERROR" ? result.message : "Please sign in.", "error")
  }

  async function handleCommit(keepMode: KeepPreviousMode, summary?: string) {
    if (isCommitting) return

    const issues = refreshIssues()
    if (missingGeneratedSessions > 0) {
      setIsIssueModalOpen(true)
      addToast(MISSING_GENERATED_SESSIONS_MESSAGE, "error")
      return
    }

    if (hasCriticalIssues(issues)) {
      setIsIssueModalOpen(true)
      addToast("Commit is blocked until critical issues are resolved.", "error")
      return
    }

    setIsCommitting(true)
    setCommitResult(null)
    try {
      const result = await commitPlan(sessions, keepMode, summary)

      if (result.status === "SUCCESS") {
        setCommitResult({ status: "SUCCESS", taskCount: result.taskCount })
        setHistoryRefreshKey((current) => current + 1)
        addToast(`Plan committed: ${result.taskCount} tasks created.`, "success")
        router.push("/dashboard")
        return
      }

      const errorMessage = result.status === "ERROR"
        ? result.message
        : "Failed to commit plan."
      setCommitResult({ status: "ERROR", message: errorMessage })
      addToast(errorMessage, "error")
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to commit plan."
      setCommitResult({ status: "ERROR", message: errorMessage })
      addToast(errorMessage, "error")
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="page-root fade-in flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto">
      <div className="ui-card mt-3 p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            {phase === 3 ? (
              <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                Phase 3: Confirm + Commit - Choose commit strategy and save the final plan.
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-sky-400/85">
                  {activePhase.title}
                </h2>
                <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                  {activePhase.description}
                </p>
              </div>
            )}

            {phase === 2 && phaseTwoHeaderChips.length > 0 && (
              <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
                {phaseTwoHeaderChips.map((chip) => (
                  <span
                    key={chip}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/60"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {phase === 1 ? (
          <div className="mt-4 space-y-4">
            <SubjectsDataTable
              initialSubjects={initialSubjects}
              initialTasksByChapter={initialTasksByChapter}
              initialImportMode={initialImportMode}
              embedded
              showPageHeader={false}
              onSelectedTaskIdsChange={setSelectedIntakeTaskIds}
            />

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs sm:text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                  Continue when your structure includes at least one subject and one chapter.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    void continueToPreview()
                  }}
                  disabled={isAdvancing || isGenerating}
                >
                  {isAdvancing || isGenerating ? "Preparing Preview..." : "Generate Phase 2 Preview"}
                </Button>
              </div>
            </div>
          </div>
        ) : phase === 2 ? (
          <div className="mt-4">
            {feasibility ? (
              <PlanPreview
                sessions={sessions}
                feasibility={feasibility}
                constraints={constraints}
                subjects={subjectOptions}
                topicOptions={previewTopicOptions.filter((topic) => topic.id)}
                onEdit={handleEditSessions}
                onReoptimize={handleReoptimizePreview}
                onConfirm={handlePreviewConfirm}
                onGoToPhase={goToPhase}
                isReoptimizing={isReoptimizing}
              />
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                  Generate the plan first
                </p>
                <p className="mt-2 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                  Finish intake in Phase 1 to produce a plan preview.
                </p>
                <div className="mt-4">
                  <Button variant="ghost" size="sm" onClick={() => goToPhase(1)}>
                    Back to Phase 1
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : phase === 3 ? (
          <div className="mt-4">
            {feasibility ? (
              <div className="space-y-5">
                <PlanConfirm
                  sessions={sessions}
                  feasibility={feasibility}
                  onCommit={handleCommit}
                  isCommitting={isCommitting}
                  commitResult={commitResult}
                  commitBlocked={missingGeneratedSessions > 0 || hasCriticalPlanIssues}
                  commitBlockedReason={
                    missingGeneratedSessions > 0
                      ? MISSING_GENERATED_SESSIONS_MESSAGE
                      : hasCriticalPlanIssues
                        ? "Critical issues still need fixes in the issue window."
                        : undefined
                  }
                  onResolveIssues={() => setIsIssueModalOpen(true)}
                />

                <PlanHistory
                  title="Recent Plans"
                  showPlannerLinks={false}
                  emptyMessage="No plans committed yet."
                  emptyHint="Commit a schedule to start building history."
                  maxVisible={4}
                  refreshKey={historyRefreshKey}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                  Preview required before commit
                </p>
                <p className="mt-2 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                  Complete Phase 2 before moving to commit.
                </p>
                <div className="mt-4">
                  <Button variant="ghost" size="sm" onClick={() => goToPhase(2)}>
                    Back to Phase 2
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Phase {phase}
            </p>
            <p className="mt-2 text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
              Unknown phase
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
              Use the phase stepper to return to a valid step.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => goToPhase(1)}>
                Back to Phase 1
              </Button>
            </div>
          </div>
        )}
      </div>

      <PlanIssueModal
        open={isIssueModalOpen}
        issues={planIssues}
        constraints={constraints}
        isRechecking={isGenerating || isAdvancing}
        onClose={() => setIsIssueModalOpen(false)}
        onApplyAction={handleIssueAction}
        onInlineConstraintChange={applyIssueConstraintField}
        onRecheck={handleIssueRecheck}
      />
    </div>
  )
}
