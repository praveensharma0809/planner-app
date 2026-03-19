"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/app/components/Toast"
import PlannerStepper from "./components/PlannerStepper"
import StructureBuilder, {
  type StructureImportOptions,
  type StructureSavePayload,
  type SubjectDraft,
} from "./components/StructureBuilder"
import ParamsEditor from "./components/ParamsEditor"
import ConstraintsForm from "./components/ConstraintsForm"
import PlanPreview from "./components/PlanPreview"
import PlanConfirm from "./components/PlanConfirm"
import PlanIssueModal from "./components/PlanIssueModal"
import {
  getPlanConfig,
  getStructure,
  getTopicParams,
  savePlanConfig,
  saveStructure,
  saveSubjectDeadlines,
  saveTopicParams,
} from "@/app/actions/planner/setup"
import {
  buildPlanIssues,
  hasCriticalIssues,
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
  type PlanIssue,
  type PlanIssueAction,
  type PlanIssueConstraintField,
  type PlannerConstraintValues as ConstraintValues,
  type PlannerParamValues as ParamValues,
  type PlannerSubjectOption,
  type PlannerTopicForParams as TopicForParams,
} from "@/lib/planner/draft"
import {
  commitPlan,
  generatePlanAction,
  reoptimizePreviewPlan,
  type KeepPreviousMode,
} from "@/app/actions/planner/plan"
import type {
  ScheduledSession,
  FeasibilityResult,
  PlanOrderCriterion,
  TopicOrderingMode,
} from "@/lib/planner/engine"
import { PageHeader } from "@/app/components/layout/PageHeader"
import { PlanHistory } from "../dashboard/PlanHistory"

// ── sessionStorage helpers ────────────────────────────────────────────────────
const STORAGE_KEY = "planner-wizard-state"
const PLANNER_ENGINE_VERSION = "2026-06-v2-stack"

interface PersistedState {
  engineVersion?: string
  phase: number
  maxPhase: number
  topics: TopicForParams[]
  paramMap: [string, ParamValues][]
  constraints: ConstraintValues | null
  sessions: ScheduledSession[]
  feasibility: FeasibilityResult | null
}

function saveProgress(state: PersistedState) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        engineVersion: PLANNER_ENGINE_VERSION,
      })
    )
  } catch { /* quota exceeded – ignore */ }
}

function loadProgress(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function mapSubjectOrdering(
  raw: Record<string, string> | null | undefined
): Record<string, TopicOrderingMode> {
  if (!raw) return {}

  const mapped: Record<string, TopicOrderingMode> = {}
  for (const [subjectId, mode] of Object.entries(raw)) {
    if (mode === "custom_tiers") {
      mapped[subjectId] = "parallel"
      continue
    }
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

function clearProgress() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().split("T")[0]
}

interface IssueComputationOverrides {
  constraints?: ConstraintValues | null
  params?: ParamValues[]
  feasibility?: FeasibilityResult | null
  sessions?: ScheduledSession[]
  planStatus?: string | null
}

type StructureResponse = Awaited<ReturnType<typeof getStructure>>
type StructureSubject = Extract<StructureResponse, { status: "SUCCESS" }>['tree']['subjects'][number]

// ── Mapping helpers (DB → UI types) ──────────────────────────────────────────
function mapDbToParamValues(p: {
  topic_id: string; estimated_hours: number; priority: number;
  deadline?: string | null; earliest_start?: string | null;
  depends_on?: string[] | null; session_length_minutes?: number;
  rest_after_days?: number; max_sessions_per_day?: number;
  study_frequency?: string; tier?: number;
}): ParamValues {
  return {
    topic_id: p.topic_id,
    estimated_hours: p.estimated_hours,
    priority: 3,
    deadline: p.deadline ?? "",
    earliest_start: p.earliest_start ?? "",
    depends_on: p.depends_on ?? [],
    session_length_minutes: p.session_length_minutes ?? 60,
    rest_after_days: p.rest_after_days ?? 0,
    max_sessions_per_day: p.max_sessions_per_day ?? 0,
    study_frequency: p.study_frequency === "spaced" ? "spaced" : "daily",
    tier: 0,
  }
}

function mapDbToConstraintValues(c: {
  study_start_date: string; exam_date: string;
  weekday_capacity_minutes: number; weekend_capacity_minutes: number;
  plan_order?: string; final_revision_days?: number; buffer_percentage?: number;
  max_active_subjects?: number; day_of_week_capacity?: (number | null)[] | null;
  custom_day_capacity?: Record<string, number> | null;
  plan_order_stack?: string[] | null; flexibility_minutes?: number;
  max_daily_minutes?: number; max_topics_per_subject_per_day?: number;
  min_subject_gap_days?: number;
  subject_ordering?: Record<string, string> | null;
  flexible_threshold?: Record<string, number> | null;
}): ConstraintValues {
  return {
    study_start_date: c.study_start_date,
    exam_date: c.exam_date,
    weekday_capacity_minutes: c.weekday_capacity_minutes,
    weekend_capacity_minutes: c.weekend_capacity_minutes,
    plan_order: (c.plan_order as ConstraintValues["plan_order"]) ?? "balanced",
    final_revision_days: c.final_revision_days ?? 0,
    buffer_percentage: c.buffer_percentage ?? 0,
    max_active_subjects: c.max_active_subjects ?? 0,
    day_of_week_capacity: c.day_of_week_capacity ?? [null, null, null, null, null, null, null],
    custom_day_capacity: c.custom_day_capacity ?? {},
    plan_order_stack: (c.plan_order_stack as PlanOrderCriterion[]) ?? ["urgency", "subject_order", "deadline"],
    flexibility_minutes: c.flexibility_minutes ?? 0,
    max_daily_minutes: c.max_daily_minutes ?? 480,
    max_topics_per_subject_per_day: c.max_topics_per_subject_per_day ?? 1,
    min_subject_gap_days: c.min_subject_gap_days ?? 0,
    subject_ordering: mapSubjectOrdering(c.subject_ordering),
    flexible_threshold: c.flexible_threshold ?? {},
  }
}

function clampSessionLength(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_SESSION_LENGTH_MINUTES
  return Math.min(
    MAX_SESSION_LENGTH_MINUTES,
    Math.max(MIN_SESSION_LENGTH_MINUTES, Math.trunc(minutes))
  )
}

function mapStructureSubjectsToDrafts(subjects: StructureSubject[]): SubjectDraft[] {
  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    sort_order: subject.sort_order,
    topics: subject.topics.map((topic) => {
      const averageTaskMinutes = topic.tasks.length > 0
        ? Math.round(
            topic.tasks.reduce((sum, task) => sum + clampSessionLength(task.duration_minutes), 0)
            / topic.tasks.length
          )
        : 45

      return {
        id: topic.id,
        name: topic.name,
        sort_order: topic.sort_order,
        default_task_minutes: averageTaskMinutes,
        subtopics: topic.subtopics.map((subtopic) => ({
          id: subtopic.id,
          name: subtopic.name,
          sort_order: subtopic.sort_order,
        })),
        tasks: topic.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          completed: task.completed,
          subtopic_id: task.subtopic_id,
          effort_minutes: clampSessionLength(task.duration_minutes),
          sort_order: task.sort_order,
        })),
      }
    }),
  }))
}

function buildTopicListFromSubjects(subjects: SubjectDraft[]): TopicForParams[] {
  const topicList: TopicForParams[] = []

  for (const subject of subjects) {
    for (const topic of subject.topics) {
      if (!topic.id) continue
      topicList.push({
        id: topic.id,
        subject_name: subject.name,
        topic_name: topic.name,
      })
    }
  }

  return topicList
}

function buildDeadlineMap(subjects: StructureSubject[]): Map<string, string> {
  const deadlineMap = new Map<string, string>()

  for (const subject of subjects) {
    if (!subject.deadline) continue
    deadlineMap.set(subject.id, subject.deadline)
  }

  return deadlineMap
}

function applyTopicEffortPrefill(
  source: Map<string, ParamValues>,
  prefill: StructureSavePayload['topicEffortPrefill']
): Map<string, ParamValues> {
  const next = new Map(source)

  for (const [topicId, values] of Object.entries(prefill)) {
    const existing = next.get(topicId)
    const estimatedHours = Number.isFinite(values.estimated_hours)
      ? Math.max(0, Number(values.estimated_hours.toFixed(2)))
      : 0
    const sessionLengthMinutes = clampSessionLength(values.session_length_minutes)

    if (!existing) {
      next.set(topicId, {
        topic_id: topicId,
        estimated_hours: estimatedHours,
        priority: 3,
        deadline: "",
        earliest_start: "",
        depends_on: [],
        session_length_minutes: sessionLengthMinutes,
        rest_after_days: 0,
        max_sessions_per_day: 0,
        study_frequency: "daily",
        tier: 0,
      })
      continue
    }

    next.set(topicId, {
      ...existing,
      estimated_hours: estimatedHours,
      session_length_minutes: sessionLengthMinutes,
    })
  }

  return next
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

export default function PlannerPage() {
  const { addToast } = useToast()

  // Phase state
  const [phase, setPhase] = useState(1)
  const [maxPhase, setMaxPhase] = useState(1)

  // Phase 1 – structure
  const [subjects, setSubjects] = useState<SubjectDraft[]>([])
  const [structureLoaded, setStructureLoaded] = useState(false)
  const [isSavingStructure, setIsSavingStructure] = useState(false)

  // Phase 2 – params
  const [topics, setTopics] = useState<TopicForParams[]>([])
  const [paramMap, setParamMap] = useState<Map<string, ParamValues>>(new Map())
  const [subjectDeadlineState, setSubjectDeadlineState] = useState<Map<string, string>>(new Map())
  const [isSavingParams, setIsSavingParams] = useState(false)

  // Phase 3 – constraints
  const [constraints, setConstraints] = useState<ConstraintValues | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // Phase 4 – preview
  const [sessions, setSessions] = useState<ScheduledSession[]>([])
  const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isReoptimizing, setIsReoptimizing] = useState(false)

  // Phase 5 – confirm
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<{ status: string; taskCount?: number } | null>(null)
  const [planIssues, setPlanIssues] = useState<PlanIssue[]>([])
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [lastPlanStatus, setLastPlanStatus] = useState<string | null>(null)

  // Track whether initial hydration from sessionStorage is done
  const hydratedRef = useRef(false)

  const loadTopicParamMap = useCallback(async (): Promise<Map<string, ParamValues>> => {
    const paramsRes = await getTopicParams()
    if (paramsRes.status !== "SUCCESS") return new Map<string, ParamValues>()
    return mapDbParamsToMap(paramsRes.params)
  }, [])

  // ── Persist progress whenever key state changes ──────────────────────────
  useEffect(() => {
    if (!hydratedRef.current) return // don't write until initial load complete
    saveProgress({
      phase,
      maxPhase,
      topics,
      paramMap: Array.from(paramMap.entries()),
      constraints,
      sessions,
      feasibility,
    })
  }, [phase, maxPhase, topics, paramMap, constraints, sessions, feasibility])

  // ── Load on mount: restore from sessionStorage + fetch structure from DB ─
  useEffect(() => {
    async function init() {
      // 1. Try to hydrate from sessionStorage
      const savedRaw = loadProgress()
      const saved =
        savedRaw && savedRaw.engineVersion === PLANNER_ENGINE_VERSION
          ? savedRaw
          : null

      // Planner logic changed, so invalidate stale preview/commit state.
      if (savedRaw && !saved) {
        clearProgress()
      }

      if (saved) {
        if (saved.phase) setPhase(saved.phase)
        if (saved.maxPhase) setMaxPhase(saved.maxPhase)
        if (saved.topics) setTopics(saved.topics)
        if (saved.paramMap) setParamMap(new Map(saved.paramMap))
        if (saved.constraints) setConstraints(saved.constraints)
        if (saved.sessions) setSessions(saved.sessions)
        if (saved.feasibility) setFeasibility(saved.feasibility)
      }

      // 2. Always fetch live structure from DB (source of truth for Phase 1)
      const res = await getStructure()
      if (res.status === "SUCCESS") {
        const mapped = mapStructureSubjectsToDrafts(res.tree.subjects)
        setSubjects(mapped)

        setSubjectDeadlineState(buildDeadlineMap(res.tree.subjects))
        setTopics(buildTopicListFromSubjects(mapped))

        if (!saved?.paramMap?.length) {
          setParamMap(await loadTopicParamMap())
        }

        if (!saved?.constraints) {
          const configRes = await getPlanConfig()
          if (configRes.status === "SUCCESS" && configRes.config) {
            setConstraints(mapDbToConstraintValues(configRes.config))
          }
        }
      }

      setStructureLoaded(true)
      hydratedRef.current = true
    }
    init()
  }, [loadTopicParamMap])

  const goToPhase = useCallback((p: number) => {
    setPhase(p)
    setMaxPhase((prev) => Math.max(prev, p))
  }, [])

  const recomputeIssues = useCallback((overrides?: IssueComputationOverrides) => {
    return buildPlanIssues({
      constraints: overrides?.constraints ?? constraints,
      params: overrides?.params ?? Array.from(paramMap.values()),
      feasibility: overrides?.feasibility ?? feasibility,
      sessions: overrides?.sessions ?? sessions,
      planStatus: overrides?.planStatus ?? lastPlanStatus,
    })
  }, [constraints, paramMap, feasibility, sessions, lastPlanStatus])

  const refreshIssues = useCallback((overrides?: IssueComputationOverrides) => {
    const issues = recomputeIssues(overrides)
    setPlanIssues(issues)
    return issues
  }, [recomputeIssues])

  const updateConstraintsWith = useCallback((
    updater: (prev: ConstraintValues) => ConstraintValues
  ) => {
    setConstraints((prev) => {
      if (!prev) return prev
      const next = updater(prev)
      setPlanIssues(recomputeIssues({ constraints: next }))
      return next
    })
  }, [recomputeIssues])

  const applyIssueConstraintField = useCallback((
    field: PlanIssueConstraintField,
    value: string | number
  ) => {
    updateConstraintsWith((prev) => {
      if (field === "study_start_date" || field === "exam_date") {
        return {
          ...prev,
          [field]: typeof value === "string" ? value : prev[field],
        }
      }

      if (typeof value !== "number") return prev

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
        ...prev,
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
      updateConstraintsWith((prev) => ({
        ...prev,
        [action.field]: addDaysISO(prev[action.field], action.days),
      }))
      return
    }

    applyIssueConstraintField(action.field, ((constraints?.[action.field] as number | undefined) ?? 0) + action.delta)
  }, [constraints, goToPhase, updateConstraintsWith, applyIssueConstraintField])

  const hasCriticalPlanIssues = hasCriticalIssues(planIssues)

  const importStructureFromSubjects = useCallback(async (
    options: StructureImportOptions
  ): Promise<SubjectDraft[]> => {
    const res = await getStructure({
      onlyUndoneTasks: options.onlyUndoneTasks,
      dropTopicsWithoutTasks: options.dropTopicsWithoutTasks,
    })

    if (res.status !== "SUCCESS") {
      addToast("Please sign in to import structure.", "error")
      return subjects
    }

    return mapStructureSubjectsToDrafts(res.tree.subjects)
  }, [addToast, subjects])

  useEffect(() => {
    if (!constraints && !feasibility && sessions.length === 0 && !lastPlanStatus) return
    setPlanIssues(recomputeIssues())
  }, [constraints, feasibility, sessions, lastPlanStatus, recomputeIssues])

  // Phase 1 save
  const handleSaveStructure = async (
    drafts: SubjectDraft[],
    payload: StructureSavePayload
  ) => {
    setIsSavingStructure(true)

    try {
      const prefill = payload.topicEffortPrefill ?? {}

      if (payload.plannerOnly) {
        setSubjects(drafts)
        setTopics(buildTopicListFromSubjects(drafts))

        const fromDb = await loadTopicParamMap()
        setParamMap(applyTopicEffortPrefill(fromDb, prefill))

        addToast("Imported snapshot applied for this planner run.", "success")
        goToPhase(2)
        return
      }

      const res = await saveStructure(drafts)
      if (res.status !== "SUCCESS") {
        addToast(res.status === "ERROR" ? res.message : "Please sign in.", "error")
        return
      }

      // Reload structure to get server-assigned IDs and synced task snapshots.
      const fresh = await getStructure()
      if (fresh.status !== "SUCCESS") {
        addToast("Structure was saved but refresh failed. Reload planner once.", "error")
        return
      }

      const mapped = mapStructureSubjectsToDrafts(fresh.tree.subjects)
      setSubjects(mapped)
      setSubjectDeadlineState(buildDeadlineMap(fresh.tree.subjects))
      setTopics(buildTopicListFromSubjects(mapped))

      const fromDb = await loadTopicParamMap()
      setParamMap(applyTopicEffortPrefill(fromDb, prefill))

      addToast("Structure saved.", "success")
      goToPhase(2)
    } finally {
      setIsSavingStructure(false)
    }
  }

  // Phase 2 save
  const handleSaveParams = async (params: ParamValues[], newSubjectDeadlines?: Map<string, string>) => {
    setIsSavingParams(true)

    // Save subject deadlines if any were changed
    if (newSubjectDeadlines && newSubjectDeadlines.size > 0) {
      const dlUpdates = Array.from(newSubjectDeadlines.entries()).map(([id, deadline]) => ({ id, deadline }))
      const dlRes = await saveSubjectDeadlines(dlUpdates)
      if (dlRes.status === "ERROR") {
        setIsSavingParams(false)
        addToast(dlRes.message ?? "Failed to save subject deadlines.", "error")
        return
      }
      setSubjectDeadlineState(newSubjectDeadlines)
    }
    const res = await saveTopicParams(
      params.map((p) => ({
        topic_id: p.topic_id,
        estimated_hours: p.estimated_hours,
        priority: 3,
        deadline: p.deadline || null,
        earliest_start: p.earliest_start || null,
        depends_on: p.depends_on,
        session_length_minutes: p.session_length_minutes ?? 60,
        rest_after_days: p.rest_after_days ?? 0,
        max_sessions_per_day: p.max_sessions_per_day ?? 0,
        study_frequency: p.study_frequency === "spaced" ? "spaced" : "daily",
        tier: 0,
      }))
    )
    setIsSavingParams(false)

    if (res.status !== "SUCCESS") {
      addToast(res.status === "ERROR" ? res.message : "Please sign in.", "error")
      return
    }

    setParamMap(new Map(params.map((param) => [param.topic_id, param])))

    // Load existing config
    const configRes = await getPlanConfig()
    if (configRes.status === "SUCCESS" && configRes.config) {
      setConstraints(mapDbToConstraintValues(configRes.config))
    }

    goToPhase(3)
  }

  // Phase 3 save & generate
  const runPlanGeneration = useCallback(async (config: ConstraintValues) => {
    const saveRes = await savePlanConfig(config)
    if (saveRes.status !== "SUCCESS") {
      addToast(saveRes.status === "ERROR" ? saveRes.message : "Please sign in.", "error")
      return false
    }

    setConstraints(config)

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
      goToPhase(4)
    } else if (plan.status === "INFEASIBLE") {
      nextFeasibility = plan.feasibility
      setFeasibility(nextFeasibility)
      setSessions([])
      goToPhase(3)
    } else if (plan.status === "NO_DAYS") {
      setFeasibility(null)
      setSessions([])
      goToPhase(3)
    } else if (plan.status === "NO_CONFIG") {
      addToast("Save constraints first.", "error")
      return false
    } else if (plan.status === "NO_TOPICS") {
      addToast("Add at least one topic with estimated hours.", "error")
      return false
    } else if (plan.status === "UNAUTHORIZED") {
      addToast("Please sign in.", "error")
      return false
    }

    const issues = refreshIssues({
      constraints: config,
      feasibility: nextFeasibility,
      sessions: nextSessions,
      planStatus: plan.status,
    })
    const blocked = hasCriticalIssues(issues)

    if (blocked) {
      setIsIssueModalOpen(true)
      addToast("Resolve critical plan issues in the issue window.", "error")
      return false
    }

    if (plan.status === "READY") {
      addToast("Plan generated and fully schedulable.", "success")
      return true
    }

    if (plan.status === "INFEASIBLE" || plan.status === "NO_DAYS" || plan.status === "PARTIAL") {
      addToast("Plan check completed. Resolve issues to continue.", "info")
      return false
    }

    return true
  }, [addToast, goToPhase, refreshIssues])

  const handleSaveConfig = async (config: ConstraintValues) => {
    setIsSavingConfig(true)
    await runPlanGeneration(config)
    setIsSavingConfig(false)
  }

  const handleIssueRecheck = async () => {
    if (!constraints) return
    await runPlanGeneration(constraints)
  }

  // Phase 4 edit
  const handleEditSessions = (edited: ScheduledSession[]) => {
    setSessions(edited)
    refreshIssues({ sessions: edited })
  }

  // Phase 4 → 5
  const handlePreviewConfirm = () => {
    const issues = refreshIssues()
    if (hasCriticalIssues(issues)) {
      setIsIssueModalOpen(true)
      addToast("Fix critical issues before moving to commit.", "error")
      return
    }
    goToPhase(5)
  }

  const handleReoptimizePreview = async (reservedSessions: ScheduledSession[]) => {
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

  // Phase 5 commit
  const handleCommit = async (keepMode: KeepPreviousMode, summary?: string) => {
    const issues = refreshIssues()
    if (hasCriticalIssues(issues)) {
      setIsIssueModalOpen(true)
      addToast("Commit is blocked until critical issues are resolved.", "error")
      return
    }

    setIsCommitting(true)
    setCommitResult(null)
    const res = await commitPlan(sessions, keepMode, summary)
    setIsCommitting(false)

    if (res.status === "SUCCESS") {
      setCommitResult({ status: "SUCCESS", taskCount: res.taskCount })
      addToast(`Plan committed — ${res.taskCount} tasks created!`, "success")
    } else {
      setCommitResult({ status: "ERROR" })
      addToast("Failed to commit plan.", "error")
    }
  }

  const subjectOptions: PlannerSubjectOption[] = subjects.flatMap((subject) =>
    subject.id
      ? [{
          id: subject.id,
          name: subject.name,
          deadline: subjectDeadlineState.get(subject.id),
          topicIds: subject.topics.map((t) => t.id ?? "").filter(Boolean),
          topics: subject.topics
            .filter((t) => t.id)
            .map((t) => ({ id: t.id!, name: t.name })),
        }]
      : []
  )
  const previewTopicOptions = subjects.flatMap((subject) =>
    subject.id
      ? subject.topics.map((topic) => ({
          id: topic.id ?? "",
          subjectId: subject.id!,
          subjectName: subject.name,
          topicName: topic.name,
        }))
      : []
  )
  const constraintsFormKey = JSON.stringify({
    constraints,
    subjectIds: subjectOptions.map((subject) => subject.id),
  })

  return (
    <div className="page-root">
      <PageHeader
        eyebrow="5-phase wizard"
        title="Planner"
      />

      <div className="mt-6">
        <PlannerStepper
          currentPhase={phase}
          onPhaseClick={goToPhase}
          maxReachedPhase={maxPhase}
        />
      </div>

      <div className="ui-card mt-6 p-6">
        {phase === 1 && structureLoaded && (
            <StructureBuilder
              initialSubjects={subjects}
              onSave={handleSaveStructure}
              onImportFromSubjects={importStructureFromSubjects}
              isSaving={isSavingStructure}
            />
          )}

          {phase === 2 && (
            <ParamsEditor
              topics={topics}
              initialParams={paramMap}
              constraints={constraints}
              subjects={subjectOptions}
              onSave={handleSaveParams}
              isSaving={isSavingParams}
            />
          )}

          {phase === 3 && (
            <ConstraintsForm
              key={constraintsFormKey}
              initial={constraints}
              subjects={subjectOptions}
              topicParams={Array.from(paramMap.values())}
              onSave={handleSaveConfig}
              isSaving={isSavingConfig || isGenerating}
            />
          )}

          {phase === 4 && feasibility && (
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
          )}

          {phase === 5 && feasibility && (
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
          )}
        </div>

      <PlanIssueModal
        open={isIssueModalOpen}
        issues={planIssues}
        constraints={constraints}
        isRechecking={isGenerating || isSavingConfig}
        onClose={() => setIsIssueModalOpen(false)}
        onApplyAction={handleIssueAction}
        onInlineConstraintChange={applyIssueConstraintField}
        onRecheck={handleIssueRecheck}
      />
    </div>
  )
}