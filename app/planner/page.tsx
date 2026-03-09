"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/app/components/Toast"
import PlannerStepper from "./components/PlannerStepper"
import StructureBuilder, { type SubjectDraft } from "./components/StructureBuilder"
import ParamsEditor, { type ParamValues, type TopicForParams } from "./components/ParamsEditor"
import ConstraintsForm, { type ConstraintValues } from "./components/ConstraintsForm"
import PlanPreview from "./components/PlanPreview"
import PlanConfirm from "./components/PlanConfirm"
import { getStructure } from "@/app/actions/planner/getStructure"
import { saveStructure } from "@/app/actions/planner/saveStructure"
import { getTopicParams } from "@/app/actions/planner/getTopicParams"
import { saveTopicParams } from "@/app/actions/planner/saveTopicParams"
import { getPlanConfig } from "@/app/actions/planner/getPlanConfig"
import { savePlanConfig } from "@/app/actions/planner/savePlanConfig"
import { generatePlanAction } from "@/app/actions/planner/generatePlan"
import { commitPlan } from "@/app/actions/planner/commitPlan"
import type { KeepPreviousMode } from "@/app/actions/planner/commitPlan"
import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/types"

// ── sessionStorage helpers ────────────────────────────────────────────────────
const STORAGE_KEY = "planner-wizard-state"
const PLANNER_ENGINE_VERSION = "2026-03-08-sequential-v2"

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

function clearProgress() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
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
  const [isSavingParams, setIsSavingParams] = useState(false)

  // Phase 3 – constraints
  const [constraints, setConstraints] = useState<ConstraintValues | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  // Phase 4 – preview
  const [sessions, setSessions] = useState<ScheduledSession[]>([])
  const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Phase 5 – confirm
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<{ status: string; taskCount?: number } | null>(null)

  // Track whether initial hydration from sessionStorage is done
  const hydratedRef = useRef(false)

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
        const mapped: SubjectDraft[] = res.tree.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          sort_order: s.sort_order,
          topics: s.topics.map((t) => ({
            id: t.id,
            name: t.name,
            sort_order: t.sort_order,
            subtopics: t.subtopics.map((st) => ({
              id: st.id,
              name: st.name,
              sort_order: st.sort_order,
            })),
          })),
        }))
        setSubjects(mapped)

        // If we restored to Phase 2+ but don't have topics yet, rebuild them
        if (saved && saved.phase >= 2 && (!saved.topics || saved.topics.length === 0)) {
          const topicList: TopicForParams[] = []
          for (const s of res.tree.subjects) {
            for (const t of s.topics) {
              topicList.push({ id: t.id, subject_name: s.name, topic_name: t.name })
            }
          }
          setTopics(topicList)
        }

        // If we restored to Phase 2+ but don't have params, load them
        if (saved && saved.phase >= 2 && (!saved.paramMap || saved.paramMap.length === 0)) {
          const paramsRes = await getTopicParams()
          if (paramsRes.status === "SUCCESS") {
            const map = new Map<string, ParamValues>()
            for (const p of paramsRes.params) {
              map.set(p.topic_id, {
                topic_id: p.topic_id,
                estimated_hours: p.estimated_hours,
                priority: p.priority,
                deadline: p.deadline ?? "",
                earliest_start: p.earliest_start ?? "",
                depends_on: p.depends_on ?? [],
                session_length_minutes: p.session_length_minutes ?? 60,
              })
            }
            setParamMap(map)
          }
        }

        // If restored to Phase 3+ but no constraints, load from DB
        if (saved && saved.phase >= 3 && !saved.constraints) {
          const configRes = await getPlanConfig()
          if (configRes.status === "SUCCESS" && configRes.config) {
            setConstraints({
              study_start_date: configRes.config.study_start_date,
              exam_date: configRes.config.exam_date,
              weekday_capacity_minutes: configRes.config.weekday_capacity_minutes,
              weekend_capacity_minutes: configRes.config.weekend_capacity_minutes,
              plan_order: (configRes.config.plan_order as ConstraintValues["plan_order"]) ?? "balanced",
              final_revision_days: configRes.config.final_revision_days ?? 2,
              buffer_percentage: configRes.config.buffer_percentage ?? 10,
              max_active_subjects: configRes.config.max_active_subjects ?? 0,
            })
          }
        }
      }

      setStructureLoaded(true)
      hydratedRef.current = true
    }
    init()
  }, [])

  const goToPhase = useCallback((p: number) => {
    setPhase(p)
    setMaxPhase((prev) => Math.max(prev, p))
  }, [])

  // Phase 1 save
  const handleSaveStructure = async (drafts: SubjectDraft[]) => {
    setIsSavingStructure(true)
    const res = await saveStructure(drafts)
    setIsSavingStructure(false)

    if (res.status !== "SUCCESS") {
      addToast(res.status === "ERROR" ? res.message : "Please sign in.", "error")
      return
    }

    // Reload structure to get server-assigned IDs
    const fresh = await getStructure()
    if (fresh.status === "SUCCESS") {
      const mapped: SubjectDraft[] = fresh.tree.subjects.map((s) => ({
        id: s.id,
        name: s.name,
        sort_order: s.sort_order,
        topics: s.topics.map((t) => ({
          id: t.id,
          name: t.name,
          sort_order: t.sort_order,
          subtopics: t.subtopics.map((st) => ({
            id: st.id,
            name: st.name,
            sort_order: st.sort_order,
          })),
        })),
      }))
      setSubjects(mapped)

      // Build topics list for params editor
      const topicList: TopicForParams[] = []
      for (const s of fresh.tree.subjects) {
        for (const t of s.topics) {
          topicList.push({ id: t.id, subject_name: s.name, topic_name: t.name })
        }
      }
      setTopics(topicList)

      // Load existing params
      const paramsRes = await getTopicParams()
      if (paramsRes.status === "SUCCESS") {
        const map = new Map<string, ParamValues>()
        for (const p of paramsRes.params) {
          map.set(p.topic_id, {
            topic_id: p.topic_id,
            estimated_hours: p.estimated_hours,
            priority: p.priority,
            deadline: p.deadline ?? "",
            earliest_start: p.earliest_start ?? "",
            depends_on: p.depends_on ?? [],
            session_length_minutes: p.session_length_minutes ?? 60,
          })
        }
        setParamMap(map)
      }
    }

    addToast("Structure saved.", "success")
    goToPhase(2)
  }

  // Phase 2 save
  const handleSaveParams = async (params: ParamValues[]) => {
    setIsSavingParams(true)
    const res = await saveTopicParams(
      params.map((p) => ({
        topic_id: p.topic_id,
        estimated_hours: p.estimated_hours,
        priority: p.priority,
        deadline: p.deadline || null,
        earliest_start: p.earliest_start || null,
        depends_on: p.depends_on,
        session_length_minutes: p.session_length_minutes ?? 60,
      }))
    )
    setIsSavingParams(false)

    if (res.status !== "SUCCESS") {
      addToast(res.status === "ERROR" ? res.message : "Please sign in.", "error")
      return
    }

    // Load existing config
    const configRes = await getPlanConfig()
    if (configRes.status === "SUCCESS" && configRes.config) {
      setConstraints({
        study_start_date: configRes.config.study_start_date,
        exam_date: configRes.config.exam_date,
        weekday_capacity_minutes: configRes.config.weekday_capacity_minutes,
        weekend_capacity_minutes: configRes.config.weekend_capacity_minutes,
        plan_order: (configRes.config.plan_order as ConstraintValues["plan_order"]) ?? "balanced",
        final_revision_days: configRes.config.final_revision_days ?? 2,
        buffer_percentage: configRes.config.buffer_percentage ?? 10,
        max_active_subjects: configRes.config.max_active_subjects ?? 0,
      })
    }

    goToPhase(3)
  }

  // Phase 3 save & generate
  const handleSaveConfig = async (config: ConstraintValues) => {
    setIsSavingConfig(true)
    const res = await savePlanConfig(config)
    if (res.status !== "SUCCESS") {
      setIsSavingConfig(false)
      addToast(res.status === "ERROR" ? res.message : "Please sign in.", "error")
      return
    }

    setIsGenerating(true)
    const plan = await generatePlanAction()
    setIsGenerating(false)
    setIsSavingConfig(false)

    if (plan.status === "READY") {
      setSessions(plan.schedule)
      setFeasibility(plan.feasibility)
      if (!plan.feasibility.feasible) {
        addToast("Plan generated with warnings — review the plan preview carefully.", "info")
      } else {
        addToast("Plan generated!", "success")
      }
      goToPhase(4)
    } else if (plan.status === "INFEASIBLE") {
      setFeasibility(plan.feasibility)
      setSessions([])
      addToast("Plan is infeasible — adjust parameters or constraints.", "error")
    } else if (plan.status === "NO_CONFIG") {
      addToast("Save constraints first.", "error")
    } else if (plan.status === "NO_TOPICS") {
      addToast("Add at least one topic with estimated hours.", "error")
    } else {
      addToast("Please sign in.", "error")
    }
  }

  // Phase 4 edit
  const handleEditSessions = (edited: ScheduledSession[]) => {
    setSessions(edited)
  }

  // Phase 4 → 5
  const handlePreviewConfirm = () => {
    goToPhase(5)
  }

  // Phase 5 commit
  const handleCommit = async (keepMode: KeepPreviousMode) => {
    setIsCommitting(true)
    setCommitResult(null)
    const res = await commitPlan(sessions, keepMode)
    setIsCommitting(false)

    if (res.status === "SUCCESS") {
      setCommitResult({ status: "SUCCESS", taskCount: res.taskCount })
      addToast(`Plan committed — ${res.taskCount} tasks created!`, "success")
    } else {
      setCommitResult({ status: "ERROR" })
      addToast("Failed to commit plan.", "error")
    }
  }

  return (
    <main className="min-h-screen text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
            5-phase planner wizard
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Planner
          </h1>
        </header>

        <PlannerStepper
          currentPhase={phase}
          onPhaseClick={goToPhase}
          maxReachedPhase={maxPhase}
        />

        <section className="glass-card">
          {phase === 1 && structureLoaded && (
            <StructureBuilder
              initialSubjects={subjects}
              onSave={handleSaveStructure}
              isSaving={isSavingStructure}
            />
          )}

          {phase === 2 && (
            <ParamsEditor
              topics={topics}
              initialParams={paramMap}
              onSave={handleSaveParams}
              isSaving={isSavingParams}
            />
          )}

          {phase === 3 && (
            <ConstraintsForm
              initial={constraints}
              onSave={handleSaveConfig}
              isSaving={isSavingConfig || isGenerating}
            />
          )}

          {phase === 4 && feasibility && (
            <PlanPreview
              sessions={sessions}
              feasibility={feasibility}
              constraints={constraints}
              onEdit={handleEditSessions}
              onConfirm={handlePreviewConfirm}
              onGoToPhase={goToPhase}
            />
          )}

          {phase === 5 && feasibility && (
            <PlanConfirm
              sessions={sessions}
              feasibility={feasibility}
              onCommit={handleCommit}
              isCommitting={isCommitting}
              commitResult={commitResult}
            />
          )}
        </section>
      </div>
    </main>
  )
}