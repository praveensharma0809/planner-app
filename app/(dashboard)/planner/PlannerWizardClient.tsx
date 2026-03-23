"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useToast } from "@/app/components/Toast"
import {
  getPlanConfig,
  getStructure,
  getTopicParams,
  savePlanConfig,
  saveTopicParams,
} from "@/app/actions/planner/setup"
import {
  buildPlanIssues,
  hasCriticalIssues,
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
  TopicOrderingMode,
} from "@/lib/planner/engine"
import { PageHeader } from "@/app/components/layout/PageHeader"
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
  saveWizardProgress,
} from "./wizard-state"

interface PlannerWizardClientProps {
  initialSubjects: SubjectNavItem[]
  initialTasksByChapter: Record<string, TopicTaskItem[]>
}

interface IssueComputationOverrides {
  constraints?: ConstraintValues | null
  params?: ParamValues[]
  feasibility?: FeasibilityResult | null
  sessions?: ScheduledSession[]
  planStatus?: string | null
}

type StructureResponse = Awaited<ReturnType<typeof getStructure>>
type StructureSubject = Extract<StructureResponse, { status: "SUCCESS" }>["tree"]["subjects"][number]

function mapSubjectOrdering(
  raw: Record<string, string> | null | undefined
): Record<string, TopicOrderingMode> {
  if (!raw) return {}

  const mapped: Record<string, TopicOrderingMode> = {}
  for (const [subjectId, mode] of Object.entries(raw)) {
    if (
      mode === "sequential"
      || mode === "flexible_sequential"
      || mode === "parallel"
    ) {
      mapped[subjectId] = mode
    }
  }

  return mapped
}

function mapDbToParamValues(param: {
  topic_id: string
  estimated_hours: number
  priority: number
  deadline?: string | null
  earliest_start?: string | null
  depends_on?: string[] | null
  session_length_minutes?: number
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
  tier?: number
}): ParamValues {
  return {
    topic_id: param.topic_id,
    estimated_hours: param.estimated_hours,
    priority: 3,
    deadline: param.deadline ?? "",
    earliest_start: param.earliest_start ?? "",
    depends_on: param.depends_on ?? [],
    session_length_minutes: param.session_length_minutes ?? 60,
    rest_after_days: param.rest_after_days ?? 0,
    max_sessions_per_day: param.max_sessions_per_day ?? 0,
    study_frequency: param.study_frequency === "spaced" ? "spaced" : "daily",
    tier: 0,
  }
}

function mapDbParamsToMap(rows: Array<{
  topic_id: string
  estimated_hours: number
  priority: number
  deadline?: string | null
  earliest_start?: string | null
  depends_on?: string[] | null
  session_length_minutes?: number
  rest_after_days?: number
  max_sessions_per_day?: number
  study_frequency?: string
  tier?: number
}>): Map<string, ParamValues> {
  const map = new Map<string, ParamValues>()
  for (const row of rows) {
    map.set(row.topic_id, mapDbToParamValues(row))
  }
  return map
}

function mapDbToConstraintValues(config: {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order?: string
  final_revision_days?: number
  buffer_percentage?: number
  max_active_subjects?: number
  day_of_week_capacity?: (number | null)[] | null
  custom_day_capacity?: Record<string, number> | null
  plan_order_stack?: string[] | null
  flexibility_minutes?: number
  max_daily_minutes?: number
  max_topics_per_subject_per_day?: number
  min_subject_gap_days?: number
  subject_ordering?: Record<string, string> | null
  flexible_threshold?: Record<string, number> | null
}): ConstraintValues {
  return {
    study_start_date: config.study_start_date,
    exam_date: config.exam_date,
    weekday_capacity_minutes: config.weekday_capacity_minutes,
    weekend_capacity_minutes: config.weekend_capacity_minutes,
    plan_order: (config.plan_order as ConstraintValues["plan_order"]) ?? "balanced",
    final_revision_days: config.final_revision_days ?? 0,
    buffer_percentage: config.buffer_percentage ?? 0,
    max_active_subjects: config.max_active_subjects ?? 0,
    day_of_week_capacity:
      config.day_of_week_capacity ?? [null, null, null, null, null, null, null],
    custom_day_capacity: config.custom_day_capacity ?? {},
    plan_order_stack:
      (config.plan_order_stack as ConstraintValues["plan_order_stack"]) ?? ["urgency", "subject_order", "deadline"],
    flexibility_minutes: config.flexibility_minutes ?? 0,
    max_daily_minutes: config.max_daily_minutes ?? 480,
    max_topics_per_subject_per_day: config.max_topics_per_subject_per_day ?? 1,
    min_subject_gap_days: config.min_subject_gap_days ?? 0,
    subject_ordering: mapSubjectOrdering(config.subject_ordering),
    flexible_threshold: config.flexible_threshold ?? {},
  }
}

function todayISODate(): string {
  return new Date().toISOString().split("T")[0]
}

function roundedHoursFromMinutes(totalMinutes: number): number {
  if (totalMinutes <= 0) return 1
  return Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10)
}

function defaultConstraintValues(latestSubjectDeadline?: string): ConstraintValues {
  const studyStart = todayISODate()
  const fallbackExamDate = addDaysISO(studyStart, 90)
  const examDate = latestSubjectDeadline && latestSubjectDeadline > studyStart
    ? latestSubjectDeadline
    : fallbackExamDate

  return {
    study_start_date: studyStart,
    exam_date: examDate,
    weekday_capacity_minutes: 180,
    weekend_capacity_minutes: 240,
    plan_order: "balanced",
    final_revision_days: 0,
    buffer_percentage: 0,
    max_active_subjects: 0,
    day_of_week_capacity: [null, null, null, null, null, null, null],
    custom_day_capacity: {},
    plan_order_stack: ["urgency", "subject_order", "deadline"],
    flexibility_minutes: 0,
    max_daily_minutes: 480,
    max_topics_per_subject_per_day: 1,
    min_subject_gap_days: 0,
    subject_ordering: {},
    flexible_threshold: {},
  }
}

function buildDeadlineMap(subjects: StructureSubject[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const subject of subjects) {
    if (subject.deadline) {
      map.set(subject.id, subject.deadline)
    }
  }
  return map
}

  function getLatestSubjectDeadline(subjects: StructureSubject[]): string | undefined {
    let latest: string | undefined

    for (const subject of subjects) {
      if (!subject.deadline) continue
      if (!latest || subject.deadline > latest) {
        latest = subject.deadline
      }
    }

    return latest
  }

  function buildParamsFromStructure(
    subjects: StructureSubject[],
    existingMap: Map<string, ParamValues>,
    fallbackExamDate: string
  ): ParamValues[] {
    const values: ParamValues[] = []

    for (const subject of subjects) {
      const subjectDeadline = subject.deadline ?? ""

      for (const topic of subject.topics) {
        const current = existingMap.get(topic.id)
        const taskMinutes = topic.tasks.reduce(
          (sum, task) => sum + Math.max(0, task.duration_minutes ?? 0),
          0
        )

        values.push({
          topic_id: topic.id,
          estimated_hours: current?.estimated_hours ?? roundedHoursFromMinutes(taskMinutes),
          priority: 3,
          deadline: current?.deadline || subjectDeadline || fallbackExamDate,
          earliest_start: current?.earliest_start ?? "",
          depends_on: current?.depends_on ?? [],
          session_length_minutes: current?.session_length_minutes ?? 60,
          rest_after_days: current?.rest_after_days ?? 0,
          max_sessions_per_day: current?.max_sessions_per_day ?? 0,
          study_frequency: current?.study_frequency === "spaced" ? "spaced" : "daily",
          tier: 0,
        })
      }
    }

    return values
  }

function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]
}

export default function PlannerWizardClient({
  initialSubjects,
  initialTasksByChapter,
}: PlannerWizardClientProps) {
  const { addToast } = useToast()

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
  const [commitResult, setCommitResult] = useState<{ status: string; taskCount?: number } | null>(null)
  const [planIssues, setPlanIssues] = useState<PlanIssue[]>([])
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [lastPlanStatus, setLastPlanStatus] = useState<string | null>(null)

  const [isAdvancing, setIsAdvancing] = useState(false)
  const hydratedRef = useRef(false)

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

  function selectPhase(nextPhase: number) {
    const normalized = clampWizardPhase(nextPhase)
    if (normalized > maxPhase) {
      addToast("Complete earlier phases to unlock this step.", "info")
      return
    }
    setPhase(normalized)
  }

  function resetWizard() {
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
  }

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
          case "max_daily_minutes":
            return Math.min(720, Math.max(30, value))
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

  useEffect(() => {
    if (!constraints && !feasibility && sessions.length === 0 && !lastPlanStatus) return
    setPlanIssues(recomputeIssues())
  }, [constraints, feasibility, lastPlanStatus, recomputeIssues, sessions])

  const subjectOptions: PlannerSubjectOption[] = useMemo(
    () => initialSubjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      deadline: subjectDeadlineState.get(subject.id),
      topicIds: subject.chapters.map((chapter) => chapter.id),
      topics: subject.chapters.map((chapter) => ({ id: chapter.id, name: chapter.name })),
    })),
    [initialSubjects, subjectDeadlineState]
  )

  const previewTopicOptions = useMemo(
    () => initialSubjects.flatMap((subject) =>
      subject.chapters.map((chapter) => ({
        id: chapter.id,
        subjectId: subject.id,
        subjectName: subject.name,
        topicName: chapter.name,
      }))
    ),
    [initialSubjects]
  )

  async function continueToPreview() {
    setIsAdvancing(true)

    try {
      const structure = await getStructure()

      if (structure.status !== "SUCCESS") {
        addToast("Please sign in to continue.", "error")
        return
      }

      const subjectCount = structure.tree.subjects.length
      const chapterCount = structure.tree.subjects.reduce(
        (sum, subject) => sum + subject.topics.length,
        0
      )

      if (subjectCount === 0 || chapterCount === 0) {
        addToast(
          "Add at least one subject and one chapter before generating preview.",
          "error"
        )
        return
      }

      setSubjectDeadlineState(buildDeadlineMap(structure.tree.subjects))
      const latestSubjectDeadline = getLatestSubjectDeadline(structure.tree.subjects)

      const [paramsRes, configRes] = await Promise.all([
        getTopicParams(),
        getPlanConfig(),
      ])

      const existingParamMap = paramsRes.status === "SUCCESS"
        ? mapDbParamsToMap(paramsRes.params)
        : new Map<string, ParamValues>()

      const nextConstraints =
        configRes.status === "SUCCESS" && configRes.config
          ? mapDbToConstraintValues(configRes.config)
          : defaultConstraintValues(latestSubjectDeadline)

      const nextParams = buildParamsFromStructure(
        structure.tree.subjects,
        existingParamMap,
        nextConstraints.exam_date
      )

      const saveParamsRes = await saveTopicParams(
        nextParams.map((param) => ({
          topic_id: param.topic_id,
          estimated_hours: param.estimated_hours,
          priority: 3,
          deadline: param.deadline || null,
          earliest_start: param.earliest_start || null,
          depends_on: param.depends_on,
          session_length_minutes: param.session_length_minutes,
          rest_after_days: param.rest_after_days,
          max_sessions_per_day: param.max_sessions_per_day,
          study_frequency: param.study_frequency,
          tier: 0,
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
      setConstraints(nextConstraints)

      const generated = await runPlanGeneration(nextConstraints)
      if (generated) {
        addToast("Phase 1 complete. Preview is ready.", "success")
      }
    } finally {
      setIsAdvancing(false)
    }
  }

  const runPlanGeneration = useCallback(async (nextConstraints: ConstraintValues) => {
    const saveRes = await savePlanConfig(nextConstraints)
    if (saveRes.status !== "SUCCESS") {
      addToast(saveRes.status === "ERROR" ? saveRes.message : "Please sign in.", "error")
      return false
    }

    setConstraints(nextConstraints)

    setIsGenerating(true)
    const plan = await generatePlanAction()
    setIsGenerating(false)
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
      addToast("Could not save intake constraints.", "error")
      return false
    } else if (plan.status === "NO_TOPICS") {
      addToast("Add at least one topic with estimated hours.", "error")
      return false
    } else if (plan.status === "UNAUTHORIZED") {
      addToast("Please sign in.", "error")
      return false
    }

    const issues = refreshIssues({
      constraints: nextConstraints,
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
  }, [addToast, goToPhase, refreshIssues])

  async function handleIssueRecheck() {
    if (!constraints) return
    await runPlanGeneration(constraints)
  }

  function handleEditSessions(editedSessions: ScheduledSession[]) {
    setSessions(editedSessions)
    refreshIssues({ sessions: editedSessions })
  }

  function handlePreviewConfirm() {
    const issues = refreshIssues()
    if (hasCriticalIssues(issues)) {
      setIsIssueModalOpen(true)
      addToast("Fix critical issues before moving to commit.", "error")
      return
    }

    goToPhase(3)
  }

  async function handleReoptimizePreview(reservedSessions: ScheduledSession[]) {
    setIsReoptimizing(true)
    const result = await reoptimizePreviewPlan(reservedSessions)
    setIsReoptimizing(false)

    if (result.status === "SUCCESS") {
      setSessions(result.schedule)
      setLastPlanStatus("READY")
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
      addToast("No saved planner topics were found to regenerate.", "error")
      return
    }

    addToast(result.status === "ERROR" ? result.message : "Please sign in.", "error")
  }

  async function handleCommit(keepMode: KeepPreviousMode, summary?: string) {
    const issues = refreshIssues()
    if (hasCriticalIssues(issues)) {
      setIsIssueModalOpen(true)
      addToast("Commit is blocked until critical issues are resolved.", "error")
      return
    }

    setIsCommitting(true)
    setCommitResult(null)
    const result = await commitPlan(sessions, keepMode, summary)
    setIsCommitting(false)

    if (result.status === "SUCCESS") {
      setCommitResult({ status: "SUCCESS", taskCount: result.taskCount })
      addToast(`Plan committed - ${result.taskCount} tasks created!`, "success")
      return
    }

    setCommitResult({ status: "ERROR" })
    addToast("Failed to commit plan.", "error")
  }

  return (
    <div className="page-root fade-in">
      <PageHeader
        eyebrow="3-phase wizard"
        title="Planner"
        subtitle="Complete Phase 1 intake, review Phase 2 preview, then confirm in Phase 3."
        actions={(
          <Button variant="ghost" size="sm" onClick={resetWizard}>
            Reset Wizard
          </Button>
        )}
      />

      <div className="mt-6">
        <PlannerPhaseStepper
          currentPhase={phase}
          maxPhase={maxPhase}
          onSelectPhase={selectPhase}
        />
      </div>

      <div className="ui-card mt-6 p-4 sm:p-5">
        <div className="space-y-1.5 border-b border-white/[0.08] pb-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-sky-400/80">
            {activePhase.shortLabel}
          </p>
          <h2 className="text-lg font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            {activePhase.title}
          </h2>
          <p className="text-sm" style={{ color: "var(--sh-text-secondary)" }}>
            {activePhase.description}
          </p>
        </div>

        {phase === 1 ? (
          <div className="mt-4 space-y-4">
            <SubjectsDataTable
              initialSubjects={initialSubjects}
              initialTasksByChapter={initialTasksByChapter}
              embedded
              showPageHeader={false}
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
                  commitBlocked={hasCriticalPlanIssues}
                  commitBlockedReason={hasCriticalPlanIssues ? "Critical issues still need fixes in the issue window." : undefined}
                  onResolveIssues={() => setIsIssueModalOpen(true)}
                />

                <PlanHistory
                  title="Recent Plans"
                  showPlannerLinks={false}
                  emptyMessage="No plans committed yet."
                  emptyHint="Commit a schedule to start building history."
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

interface PlannerPhaseStepperProps {
  currentPhase: number
  maxPhase: number
  onSelectPhase: (phase: number) => void
}

function PlannerPhaseStepper({
  currentPhase,
  maxPhase,
  onSelectPhase,
}: PlannerPhaseStepperProps) {
  return (
    <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2" aria-label="Planner phases">
      {PLANNER_PHASES.map((phase) => {
        const isActive = phase.id === currentPhase
        const isComplete = phase.id < currentPhase
        const isReachable = phase.id <= maxPhase

        return (
          <button
            key={phase.id}
            type="button"
            onClick={() => isReachable && onSelectPhase(phase.id)}
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
              opacity: !isReachable ? 0.45 : 1,
              cursor: !isReachable ? "not-allowed" : "pointer",
            }}
            aria-current={isActive ? "step" : undefined}
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
              {isComplete ? "✓" : phase.id}
            </span>
            <span className="hidden sm:inline">{phase.shortLabel}</span>
          </button>
        )
      })}
    </nav>
  )
}
