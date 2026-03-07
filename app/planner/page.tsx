"use client"

import { useCallback, useEffect, useState } from "react"
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
import { getPlanHistory } from "@/app/actions/planner/getPlanHistory"
import type { ScheduledSession, FeasibilityResult } from "@/lib/planner/types"
import type { PlanSnapshot } from "@/lib/types/db"

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

  // History
  const [history, setHistory] = useState<PlanSnapshot[]>([])

  // Load structure on mount
  useEffect(() => {
    getStructure().then((res) => {
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
      }
      setStructureLoaded(true)
    })
    getPlanHistory().then((res) => {
      if (res.status === "SUCCESS") setHistory(res.snapshots)
    })
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
            revision_sessions: p.revision_sessions,
            practice_sessions: p.practice_sessions,
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
        revision_sessions: p.revision_sessions,
        practice_sessions: p.practice_sessions,
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
        session_length_minutes: configRes.config.session_length_minutes,
        final_revision_days: configRes.config.final_revision_days,
        buffer_percentage: configRes.config.buffer_percentage,
      })
    }

    addToast("Parameters saved.", "success")
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
      addToast("Plan generated!", "success")
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
  const handleCommit = async () => {
    setIsCommitting(true)
    setCommitResult(null)
    const res = await commitPlan(sessions)
    setIsCommitting(false)

    if (res.status === "SUCCESS") {
      setCommitResult({ status: "SUCCESS", taskCount: res.taskCount })
      addToast(`Plan committed — ${res.taskCount} tasks created!`, "success")
      // Refresh history
      const histRes = await getPlanHistory()
      if (histRes.status === "SUCCESS") setHistory(histRes.snapshots)
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
              onEdit={handleEditSessions}
              onConfirm={handlePreviewConfirm}
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

        {/* Plan History */}
        {history.length > 0 && (
          <section className="glass-card space-y-3">
            <h2 className="text-lg font-bold">Plan History</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((snap) => {
                const timeStr = new Date(snap.created_at).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                )
                return (
                  <div
                    key={snap.id}
                    className="flex items-center gap-3 text-sm bg-white/[0.04] rounded-xl px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-white/80">
                        {snap.task_count} tasks
                      </span>
                      {snap.summary && (
                        <span className="text-white/40 ml-2">{snap.summary}</span>
                      )}
                    </div>
                    <span className="text-xs text-white/25 shrink-0">{timeStr}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}