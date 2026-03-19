"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Button, Input } from "@/app/components/ui"

export interface PlannerTaskDraft {
  id?: string
  local_key?: string
  title: string
  completed?: boolean
  subtopic_id?: string | null
  effort_minutes?: number
  sort_order: number
}

export interface SubtopicDraft {
  id?: string
  local_key?: string
  name: string
  sort_order: number
}

export interface TopicDraft {
  id?: string
  name: string
  sort_order: number
  subtopics: SubtopicDraft[]
  tasks: PlannerTaskDraft[]
  default_task_minutes?: number
}

export interface SubjectDraft {
  id?: string
  name: string
  sort_order: number
  topics: TopicDraft[]
}

export interface StructureImportOptions {
  onlyUndoneTasks: boolean
  dropTopicsWithoutTasks: boolean
}

export interface TopicEffortPrefill {
  estimated_hours: number
  session_length_minutes: number
  task_count: number
}

export interface StructureSavePayload {
  plannerOnly: boolean
  topicEffortPrefill: Record<string, TopicEffortPrefill>
}

interface StructureBuilderProps {
  initialSubjects: SubjectDraft[]
  onSave: (subjects: SubjectDraft[], payload: StructureSavePayload) => void
  onImportFromSubjects?: (options: StructureImportOptions) => Promise<SubjectDraft[]>
  isSaving: boolean
}

const ALL_UNIT_FILTER = "__all__"
const UNCLUSTERED_UNIT_FILTER = "__unclustered__"
const DEFAULT_TASK_MINUTES = 45
const EMPTY_TOPICS: TopicDraft[] = []
const EMPTY_SUBTOPICS: SubtopicDraft[] = []
const EMPTY_TASKS: PlannerTaskDraft[] = []

function makeLocalKey(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function clampMinutes(value: number, fallback = DEFAULT_TASK_MINUTES): number {
  const base = Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.min(240, Math.max(15, base || fallback))
}

function toNumber(input: string, fallback = 0): number {
  const parsed = Number.parseInt(input, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function taskKey(task: PlannerTaskDraft, fallbackIndex: number): string {
  return task.id ?? task.local_key ?? `task_${fallbackIndex}`
}

function subtopicKey(subtopic: SubtopicDraft, fallbackIndex: number): string {
  return subtopic.id ?? subtopic.local_key ?? `subtopic_${fallbackIndex}`
}

function emptySubject(sortOrder: number): SubjectDraft {
  return {
    name: "",
    sort_order: sortOrder,
    topics: [],
  }
}

function emptyTopic(sortOrder: number, defaultMinutes: number): TopicDraft {
  return {
    name: "",
    sort_order: sortOrder,
    subtopics: [],
    tasks: [],
    default_task_minutes: defaultMinutes,
  }
}

function emptySubtopic(sortOrder: number): SubtopicDraft {
  return {
    local_key: makeLocalKey("unit"),
    name: "",
    sort_order: sortOrder,
  }
}

function emptyTask(sortOrder: number, defaultMinutes: number): PlannerTaskDraft {
  return {
    local_key: makeLocalKey("task"),
    title: "",
    completed: false,
    subtopic_id: null,
    effort_minutes: defaultMinutes,
    sort_order: sortOrder,
  }
}

function normalizeDrafts(input: SubjectDraft[]): SubjectDraft[] {
  return input.map((subject, subjectIndex) => ({
    ...subject,
    sort_order: subjectIndex,
    topics: (subject.topics ?? []).map((topic, topicIndex) => ({
      ...topic,
      sort_order: topicIndex,
      subtopics: (topic.subtopics ?? []).map((subtopic, subtopicIndex) => ({
        ...subtopic,
        local_key: subtopic.local_key ?? (subtopic.id ? undefined : makeLocalKey("unit")),
        sort_order: subtopicIndex,
      })),
      tasks: (topic.tasks ?? []).map((task, taskIndex) => ({
        ...task,
        local_key: task.local_key ?? (task.id ? undefined : makeLocalKey("task")),
        effort_minutes: task.effort_minutes,
        sort_order: taskIndex,
      })),
    })),
  }))
}

export default function StructureBuilder({
  initialSubjects,
  onSave,
  onImportFromSubjects,
  isSaving,
}: StructureBuilderProps) {
  const [subjects, setSubjects] = useState<SubjectDraft[]>(normalizeDrafts(initialSubjects))
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0)
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0)
  const [unitFilter, setUnitFilter] = useState<string>(ALL_UNIT_FILTER)

  const [globalTaskMinutesInput, setGlobalTaskMinutesInput] = useState(String(DEFAULT_TASK_MINUTES))
  const [topicTaskMinutesInput, setTopicTaskMinutesInput] = useState(String(DEFAULT_TASK_MINUTES))

  const [selectedTaskKeys, setSelectedTaskKeys] = useState<Set<string>>(new Set())

  const [isImporting, setIsImporting] = useState(false)
  const [importOnlyUndone, setImportOnlyUndone] = useState(false)
  const [plannerOnlyMode, setPlannerOnlyMode] = useState(false)

  useEffect(() => {
    setSubjects(normalizeDrafts(initialSubjects))
    setPlannerOnlyMode(false)
  }, [initialSubjects])

  useEffect(() => {
    if (subjects.length === 0) {
      setSelectedSubjectIndex(0)
      setSelectedTopicIndex(0)
      return
    }

    setSelectedSubjectIndex((previous) => Math.min(previous, subjects.length - 1))
  }, [subjects.length])

  const selectedSubject = subjects[selectedSubjectIndex]
  const selectedTopics = selectedSubject?.topics ?? EMPTY_TOPICS

  useEffect(() => {
    if (!selectedSubject || selectedTopics.length === 0) {
      setSelectedTopicIndex(0)
      return
    }

    setSelectedTopicIndex((previous) => Math.min(previous, selectedTopics.length - 1))
  }, [selectedSubject, selectedTopics.length])

  const selectedTopic = selectedTopics[selectedTopicIndex]
  const selectedSubtopics = selectedTopic?.subtopics ?? EMPTY_SUBTOPICS
  const selectedTasks = selectedTopic?.tasks ?? EMPTY_TASKS

  useEffect(() => {
    setUnitFilter(ALL_UNIT_FILTER)
    setSelectedTaskKeys(new Set())

    if (selectedTopic?.default_task_minutes) {
      setTopicTaskMinutesInput(String(clampMinutes(selectedTopic.default_task_minutes)))
      return
    }

    setTopicTaskMinutesInput(String(clampMinutes(toNumber(globalTaskMinutesInput, DEFAULT_TASK_MINUTES))))
  }, [selectedSubjectIndex, selectedTopicIndex, selectedTopic?.default_task_minutes, globalTaskMinutesInput])

  const totalTopics = useMemo(
    () => subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
    [subjects]
  )

  const totalSubtopics = useMemo(
    () => subjects.reduce(
      (sum, subject) => sum + subject.topics.reduce((topicSum, topic) => topicSum + topic.subtopics.length, 0),
      0
    ),
    [subjects]
  )

  const totalTasks = useMemo(
    () => subjects.reduce(
      (sum, subject) => sum + subject.topics.reduce((topicSum, topic) => topicSum + topic.tasks.length, 0),
      0
    ),
    [subjects]
  )

  const visibleTasks = useMemo(() => {
    if (!selectedTopic) return EMPTY_TASKS

    if (unitFilter === ALL_UNIT_FILTER) return selectedTopic.tasks
    if (unitFilter === UNCLUSTERED_UNIT_FILTER) {
      return selectedTopic.tasks.filter((task) => !task.subtopic_id)
    }

    return selectedTopic.tasks.filter((task) => task.subtopic_id === unitFilter)
  }, [selectedTopic, unitFilter])

  const allVisibleSelected =
    visibleTasks.length > 0
    && visibleTasks.every((task, index) => selectedTaskKeys.has(taskKey(task, index)))

  const unitCounts = useMemo(() => {
    const counts = new Map<string, number>()
    let unclustered = 0

    for (const task of selectedTasks) {
      if (!task.subtopic_id) {
        unclustered += 1
        continue
      }
      counts.set(task.subtopic_id, (counts.get(task.subtopic_id) ?? 0) + 1)
    }

    return { counts, unclustered }
  }, [selectedTasks])

  function setSubjectName(index: number, name: string) {
    setSubjects((previous) =>
      previous.map((subject, subjectIndex) =>
        subjectIndex === index ? { ...subject, name } : subject
      )
    )
  }

  function setTopicName(subjectIndex: number, topicIndex: number, name: string) {
    setSubjects((previous) =>
      previous.map((subject, currentSubjectIndex) => {
        if (currentSubjectIndex !== subjectIndex) return subject
        return {
          ...subject,
          topics: subject.topics.map((topic, currentTopicIndex) =>
            currentTopicIndex === topicIndex ? { ...topic, name } : topic
          ),
        }
      })
    )
  }

  function setSubtopicName(subjectIndex: number, topicIndex: number, subtopicIndex: number, name: string) {
    setSubjects((previous) =>
      previous.map((subject, currentSubjectIndex) => {
        if (currentSubjectIndex !== subjectIndex) return subject
        return {
          ...subject,
          topics: subject.topics.map((topic, currentTopicIndex) => {
            if (currentTopicIndex !== topicIndex) return topic
            return {
              ...topic,
              subtopics: topic.subtopics.map((subtopic, currentSubtopicIndex) =>
                currentSubtopicIndex === subtopicIndex ? { ...subtopic, name } : subtopic
              ),
            }
          }),
        }
      })
    )
  }

  function mutateSelectedTopic(mutator: (topic: TopicDraft) => TopicDraft) {
    if (!selectedSubject) return

    setSubjects((previous) =>
      previous.map((subject, subjectIndex) => {
        if (subjectIndex !== selectedSubjectIndex) return subject
        return {
          ...subject,
          topics: subject.topics.map((topic, topicIndex) =>
            topicIndex === selectedTopicIndex ? mutator(topic) : topic
          ),
        }
      })
    )
  }

  function addSubject() {
    setSubjects((previous) => [...previous, emptySubject(previous.length)])
    setSelectedSubjectIndex(subjects.length)
    setSelectedTopicIndex(0)
    setPlannerOnlyMode(false)
  }

  function deleteSubject(index: number) {
    setSubjects((previous) => previous.filter((_, subjectIndex) => subjectIndex !== index))
    setPlannerOnlyMode(false)
  }

  function addTopic() {
    if (!selectedSubject) return

    const defaultMinutes = clampMinutes(toNumber(globalTaskMinutesInput, DEFAULT_TASK_MINUTES))
    setSubjects((previous) =>
      previous.map((subject, subjectIndex) => {
        if (subjectIndex !== selectedSubjectIndex) return subject
        return {
          ...subject,
          topics: [...subject.topics, emptyTopic(subject.topics.length, defaultMinutes)],
        }
      })
    )

    setSelectedTopicIndex(selectedTopics.length)
    setPlannerOnlyMode(false)
  }

  function deleteTopic(topicIndex: number) {
    if (!selectedSubject) return

    setSubjects((previous) =>
      previous.map((subject, subjectIndex) => {
        if (subjectIndex !== selectedSubjectIndex) return subject
        return {
          ...subject,
          topics: subject.topics.filter((_, currentTopicIndex) => currentTopicIndex !== topicIndex),
        }
      })
    )

    setPlannerOnlyMode(false)
  }

  function addSubtopic() {
    if (!selectedTopic) return

    mutateSelectedTopic((topic) => ({
      ...topic,
      subtopics: [...topic.subtopics, emptySubtopic(topic.subtopics.length)],
    }))

    setPlannerOnlyMode(false)
  }

  function deleteSubtopic(subtopicIndex: number) {
    if (!selectedTopic) return

    const removing = selectedTopic.subtopics[subtopicIndex]
    const removingKey = removing ? subtopicKey(removing, subtopicIndex) : null
    mutateSelectedTopic((topic) => ({
      ...topic,
      subtopics: topic.subtopics.filter((_, currentSubtopicIndex) => currentSubtopicIndex !== subtopicIndex),
      tasks: topic.tasks.map((task) =>
        task.subtopic_id === removingKey ? { ...task, subtopic_id: null } : task
      ),
    }))

    setPlannerOnlyMode(false)
  }

  function addTask() {
    if (!selectedTopic) return

    const topicDefault = clampMinutes(
      selectedTopic.default_task_minutes ?? toNumber(globalTaskMinutesInput, DEFAULT_TASK_MINUTES)
    )

    mutateSelectedTopic((topic) => ({
      ...topic,
      tasks: [...topic.tasks, emptyTask(topic.tasks.length, topicDefault)],
      default_task_minutes: topic.default_task_minutes ?? topicDefault,
    }))

    setPlannerOnlyMode(false)
  }

  function updateTask(taskIndex: number, updater: (task: PlannerTaskDraft) => PlannerTaskDraft) {
    if (!selectedTopic) return

    mutateSelectedTopic((topic) => ({
      ...topic,
      tasks: topic.tasks.map((task, currentTaskIndex) =>
        currentTaskIndex === taskIndex ? updater(task) : task
      ),
    }))
  }

  function deleteTask(taskIndex: number) {
    if (!selectedTopic) return

    mutateSelectedTopic((topic) => ({
      ...topic,
      tasks: topic.tasks.filter((_, currentTaskIndex) => currentTaskIndex !== taskIndex),
    }))

    setPlannerOnlyMode(false)
  }

  function toggleTaskSelection(key: string) {
    setSelectedTaskKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleSelectVisibleTasks() {
    setSelectedTaskKeys((previous) => {
      const next = new Set(previous)
      if (allVisibleSelected) {
        for (const [index, task] of visibleTasks.entries()) {
          next.delete(taskKey(task, index))
        }
      } else {
        for (const [index, task] of visibleTasks.entries()) {
          next.add(taskKey(task, index))
        }
      }
      return next
    })
  }

  function deleteSelectedTasks() {
    if (!selectedTopic) return

    mutateSelectedTopic((topic) => ({
      ...topic,
      tasks: topic.tasks.filter((task, index) => !selectedTaskKeys.has(taskKey(task, index))),
    }))

    setSelectedTaskKeys(new Set())
    setPlannerOnlyMode(false)
  }

  function applyGlobalAverageToEmptyTasks() {
    const globalMinutes = clampMinutes(toNumber(globalTaskMinutesInput, DEFAULT_TASK_MINUTES))

    setSubjects((previous) =>
      previous.map((subject) => ({
        ...subject,
        topics: subject.topics.map((topic) => ({
          ...topic,
          default_task_minutes: topic.default_task_minutes ?? globalMinutes,
          tasks: topic.tasks.map((task) =>
            task.effort_minutes && task.effort_minutes > 0
              ? task
              : { ...task, effort_minutes: globalMinutes }
          ),
        })),
      }))
    )

    setPlannerOnlyMode(false)
  }

  function applyTopicAverageToVisibleTasks() {
    if (!selectedTopic) return

    const topicMinutes = clampMinutes(toNumber(topicTaskMinutesInput, DEFAULT_TASK_MINUTES))

    mutateSelectedTopic((topic) => ({
      ...topic,
      default_task_minutes: topicMinutes,
      tasks: topic.tasks.map((task) => {
        const include =
          unitFilter === ALL_UNIT_FILTER
          || (unitFilter === UNCLUSTERED_UNIT_FILTER && !task.subtopic_id)
          || task.subtopic_id === unitFilter

        if (!include) return task

        return {
          ...task,
          effort_minutes: topicMinutes,
        }
      }),
    }))

    setPlannerOnlyMode(false)
  }

  async function handleImport() {
    if (!onImportFromSubjects) return

    setIsImporting(true)
    try {
      const imported = await onImportFromSubjects({
        onlyUndoneTasks: importOnlyUndone,
        dropTopicsWithoutTasks: importOnlyUndone,
      })

      setSubjects(normalizeDrafts(imported))
      setSelectedSubjectIndex(0)
      setSelectedTopicIndex(0)
      setUnitFilter(ALL_UNIT_FILTER)
      setSelectedTaskKeys(new Set())
      setPlannerOnlyMode(true)
    } finally {
      setIsImporting(false)
    }
  }

  function buildTopicEffortPrefill(data: SubjectDraft[]): Record<string, TopicEffortPrefill> {
    const fallbackGlobalMinutes = clampMinutes(toNumber(globalTaskMinutesInput, DEFAULT_TASK_MINUTES))
    const payload: Record<string, TopicEffortPrefill> = {}

    for (const subject of data) {
      for (const topic of subject.topics) {
        if (!topic.id) continue

        const topicMinutes = clampMinutes(topic.default_task_minutes ?? fallbackGlobalMinutes)
        const undoneTasks = topic.tasks.filter((task) => !task.completed)
        const sourceTasks = undoneTasks.length > 0 ? undoneTasks : topic.tasks

        const fallbackTaskCount = sourceTasks.length > 0
          ? sourceTasks.length
          : topic.subtopics.length

        const totalMinutes = sourceTasks.length > 0
          ? sourceTasks.reduce((sum, task) => {
              const taskMinutes = clampMinutes(task.effort_minutes ?? topicMinutes)
              return sum + taskMinutes
            }, 0)
          : fallbackTaskCount * topicMinutes

        payload[topic.id] = {
          estimated_hours: Number((totalMinutes / 60).toFixed(1)),
          session_length_minutes: topicMinutes,
          task_count: fallbackTaskCount,
        }
      }
    }

    return payload
  }

  function handleSave() {
    const sanitized = subjects
      .map((subject, subjectIndex) => ({
        ...subject,
        name: subject.name.trim(),
        sort_order: subjectIndex,
        topics: subject.topics
          .map((topic, topicIndex) => ({
            ...topic,
            name: topic.name.trim(),
            sort_order: topicIndex,
            subtopics: topic.subtopics
              .map((subtopic, subtopicIndex) => ({
                ...subtopic,
                name: subtopic.name.trim(),
                sort_order: subtopicIndex,
              }))
              .filter((subtopic) => subtopic.name.length > 0),
            tasks: topic.tasks
              .map((task, taskIndex) => ({
                ...task,
                title: task.title.trim(),
                sort_order: taskIndex,
              }))
              .filter((task) => task.title.length > 0),
          }))
          .filter((topic) => topic.name.length > 0),
      }))
      .filter((subject) => subject.name.length > 0)

    const topicEffortPrefill = buildTopicEffortPrefill(sanitized)

    onSave(sanitized, {
      plannerOnly: plannerOnlyMode,
      topicEffortPrefill,
    })
  }

  const canProceed = subjects.some(
    (subject) => subject.name.trim().length > 0 && subject.topics.some((topic) => topic.name.trim().length > 0)
  )

  const selectedDetailTitle = unitFilter === ALL_UNIT_FILTER
    ? selectedTopic?.name ?? "Overview"
    : unitFilter === UNCLUSTERED_UNIT_FILTER
      ? "Unclustered Tasks"
      : selectedSubtopics.find((subtopic, index) => subtopicKey(subtopic, index) === unitFilter)?.name ?? "Unit"

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-purple-500" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/80">Phase 1</p>
            </div>
            <h2 className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-lg font-bold text-transparent">
              Structure + Effort Intake
            </h2>
            <p className="text-xs font-light text-white/40">
              Mirror your Subjects page hierarchy and capture effort before planning.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-300">
              {subjects.length} subject{subjects.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 font-medium text-purple-300">
              {totalTopics} chapter{totalTopics === 1 ? "" : "s"}
            </span>
            <span className="rounded-md border border-pink-500/20 bg-pink-500/10 px-2 py-0.5 font-medium text-pink-300">
              {totalSubtopics} unit{totalSubtopics === 1 ? "" : "s"}
            </span>
            <span className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 font-medium text-sky-300">
              {totalTasks} task{totalTasks === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      </div>

      <section
        className="rounded-xl border p-3"
        style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-md border border-white/[0.10] px-2 py-1 text-xs text-white/70">
            <input
              type="checkbox"
              checked={importOnlyUndone}
              onChange={(event) => setImportOnlyUndone(event.target.checked)}
            />
            Import only undone tasks/units
          </label>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              void handleImport()
            }}
            disabled={!onImportFromSubjects || isImporting}
          >
            {isImporting ? "Importing..." : "Import Subjects Data"}
          </Button>

          <div className="min-w-[220px] flex-1" />

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
              Global Avg Task Min
            </label>
            <input
              type="number"
              min={15}
              max={240}
              value={globalTaskMinutesInput}
              onChange={(event) => setGlobalTaskMinutesInput(event.target.value)}
              className="ui-input h-9 w-24"
            />
            <Button variant="ghost" size="sm" onClick={applyGlobalAverageToEmptyTasks}>
              Fill Empty Efforts
            </Button>
          </div>
        </div>

        {plannerOnlyMode && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
            Imported snapshot mode: Save & Continue applies this structure for planning without changing the source Subjects page.
          </p>
        )}
      </section>

      {subjects.length === 0 ? (
        <div className="empty-state">
          <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            No structure loaded.
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--sh-text-muted)" }}>
            Import from Subjects or add your first subject manually.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={addSubject}>Add Subject</Button>
            <Button
              variant="ghost"
              onClick={() => {
                void handleImport()
              }}
              disabled={!onImportFromSubjects || isImporting}
            >
              {isImporting ? "Importing..." : "Import Subjects Data"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl border p-3 sm:p-4"
          style={{
            borderColor: "var(--sh-border)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            boxShadow: "var(--sh-shadow-sm)",
          }}
        >
          <p className="mb-3 text-xs font-medium sm:hidden" style={{ color: "var(--sh-text-muted)" }}>
            Swipe horizontally between Subjects, Chapters, and planner overview.
          </p>

          <div className="flex h-[min(80vh,860px)] min-h-[560px] items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
            <PlannerColumn
              title="Subjects"
              activeIndex={selectedSubjectIndex}
              items={subjects.map((subject, subjectIndex) => ({
                label: subject.name || "Untitled Subject",
                hint: `${subject.topics.length} chapter${subject.topics.length === 1 ? "" : "s"}`,
                onClick: () => setSelectedSubjectIndex(subjectIndex),
                onDelete: subjects.length > 1 ? () => deleteSubject(subjectIndex) : undefined,
              }))}
              footer={
                <Button variant="primary" size="sm" className="w-full justify-center" onClick={addSubject}>
                  Add Subject
                </Button>
              }
            />

            <PlannerColumn
              title="Chapters"
              activeIndex={selectedTopicIndex}
              items={selectedTopics.map((topic, topicIndex) => ({
                label: topic.name || "Untitled Chapter",
                hint: `${topic.tasks.length} task${topic.tasks.length === 1 ? "" : "s"}`,
                onClick: () => setSelectedTopicIndex(topicIndex),
                onDelete: () => deleteTopic(topicIndex),
              }))}
              emptyMessage="No chapters in this subject."
              footer={
                <Button variant="primary" size="sm" className="w-full justify-center" onClick={addTopic}>
                  Add Chapter
                </Button>
              }
            />

            <section
              className="min-w-[360px] h-full flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start"
              style={{ borderColor: "var(--sh-border)", background: "var(--sh-card)" }}
            >
              {selectedSubject && selectedTopic ? (
                <div className="flex h-full min-h-0 flex-col">
                  <nav
                    className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: "var(--sh-text-muted)" }}
                  >
                    <span>{selectedSubject.name || "Untitled Subject"}</span>
                    <span>{">"}</span>
                    <span>{selectedTopic.name || "Untitled Chapter"}</span>
                    {unitFilter !== ALL_UNIT_FILTER && (
                      <>
                        <span>{">"}</span>
                        <span style={{ color: "var(--sh-text-secondary)" }}>{selectedDetailTitle}</span>
                      </>
                    )}
                  </nav>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Subject Name"
                      value={selectedSubject.name}
                      onChange={(event) => setSubjectName(selectedSubjectIndex, event.target.value)}
                      placeholder="e.g. Mathematics"
                    />
                    <Input
                      label="Chapter Name"
                      value={selectedTopic.name}
                      onChange={(event) => setTopicName(selectedSubjectIndex, selectedTopicIndex, event.target.value)}
                      placeholder="e.g. Linear Algebra"
                    />
                  </div>

                  <section
                    className="mt-3 rounded-lg border p-3"
                    style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                        Units + Task Effort
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={addSubtopic}>Add Unit</Button>
                        <Button variant="primary" size="sm" onClick={addTask}>Add Task</Button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <UnitChip
                        label={`All (${selectedTasks.length})`}
                        active={unitFilter === ALL_UNIT_FILTER}
                        onClick={() => setUnitFilter(ALL_UNIT_FILTER)}
                      />
                      <UnitChip
                        label={`Unclustered (${unitCounts.unclustered})`}
                        active={unitFilter === UNCLUSTERED_UNIT_FILTER}
                        onClick={() => setUnitFilter(UNCLUSTERED_UNIT_FILTER)}
                      />
                      {selectedSubtopics.map((subtopic, subtopicIndex) => {
                        const key = subtopicKey(subtopic, subtopicIndex)
                        return (
                        <UnitChip
                          key={key}
                          label={`${subtopic.name || "Untitled"} (${unitCounts.counts.get(key) ?? 0})`}
                          active={unitFilter === key}
                          onClick={() => setUnitFilter(key)}
                        />
                        )
                      })}
                    </div>

                    {selectedSubtopics.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {selectedSubtopics.map((subtopic, subtopicIndex) => (
                          <div
                            key={`unit-edit-${subtopicKey(subtopic, subtopicIndex)}`}
                            className="flex items-center gap-2 rounded-md border px-2 py-1.5"
                            style={{ borderColor: "var(--sh-border)" }}
                          >
                            <input
                              type="text"
                              value={subtopic.name}
                              onChange={(event) =>
                                setSubtopicName(
                                  selectedSubjectIndex,
                                  selectedTopicIndex,
                                  subtopicIndex,
                                  event.target.value
                                )
                              }
                              placeholder="Unit name"
                              className="ui-input h-8 flex-1"
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => deleteSubtopic(subtopicIndex)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section
                    className="mt-3 rounded-lg border p-3"
                    style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.015)" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                        {selectedTaskKeys.size} selected
                      </span>

                      <label className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
                        Chapter Avg Task Min
                      </label>
                      <input
                        type="number"
                        min={15}
                        max={240}
                        value={topicTaskMinutesInput}
                        onChange={(event) => setTopicTaskMinutesInput(event.target.value)}
                        className="ui-input h-9 w-24"
                      />

                      <Button variant="ghost" size="sm" onClick={applyTopicAverageToVisibleTasks}>
                        Apply Avg To Visible
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectVisibleTasks}
                        disabled={visibleTasks.length === 0}
                      >
                        {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        onClick={deleteSelectedTasks}
                        disabled={selectedTaskKeys.size === 0}
                      >
                        Delete Selected
                      </Button>
                    </div>
                  </section>

                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      {visibleTasks.length === 0 && (
                        <div
                          className="rounded-lg border border-dashed px-4 py-6 text-center text-sm"
                          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                        >
                          No tasks in this view yet.
                        </div>
                      )}

                      {visibleTasks.map((task, visibleIndex) => {
                        const fullIndex = selectedTasks.findIndex((candidate) => candidate === task)
                        const key = taskKey(task, fullIndex >= 0 ? fullIndex : visibleIndex)

                        return (
                          <div
                            key={key}
                            className="rounded-lg border px-3 py-2"
                            style={{
                              borderColor: "var(--sh-border)",
                              background: task.completed
                                ? "rgba(52, 211, 153, 0.08)"
                                : "rgba(255, 255, 255, 0.02)",
                            }}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedTaskKeys.has(key)}
                                onChange={() => toggleTaskSelection(key)}
                                className="h-4 w-4 rounded border"
                                aria-label="Select task"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  updateTask(fullIndex, (current) => ({
                                    ...current,
                                    completed: !current.completed,
                                  }))
                                }
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors"
                                style={{
                                  borderColor: task.completed ? "var(--sh-success)" : "var(--sh-border)",
                                  background: task.completed ? "var(--sh-success)" : "transparent",
                                }}
                                aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                              >
                                {task.completed && (
                                  <svg
                                    className="h-3 w-3 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>

                              <input
                                type="text"
                                value={task.title}
                                onChange={(event) =>
                                  updateTask(fullIndex, (current) => ({
                                    ...current,
                                    title: event.target.value,
                                  }))
                                }
                                placeholder="Task title"
                                className="ui-input h-9 min-w-[180px] flex-1"
                              />

                              <select
                                value={task.subtopic_id ?? UNCLUSTERED_UNIT_FILTER}
                                onChange={(event) => {
                                  const next = event.target.value
                                  updateTask(fullIndex, (current) => ({
                                    ...current,
                                    subtopic_id: next === UNCLUSTERED_UNIT_FILTER ? null : next,
                                  }))
                                }}
                                className="ui-input h-9 min-w-[150px]"
                              >
                                <option value={UNCLUSTERED_UNIT_FILTER}>Unclustered</option>
                                {selectedSubtopics.map((subtopic, subtopicIndex) => (
                                  <option key={`task-unit-${subtopicKey(subtopic, subtopicIndex)}`} value={subtopicKey(subtopic, subtopicIndex)}>
                                    {subtopic.name || `Unit ${subtopicIndex + 1}`}
                                  </option>
                                ))}
                              </select>

                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={15}
                                  max={240}
                                  value={task.effort_minutes ?? ""}
                                  onChange={(event) => {
                                    const value = toNumber(event.target.value, clampMinutes(toNumber(topicTaskMinutesInput, DEFAULT_TASK_MINUTES)))
                                    updateTask(fullIndex, (current) => ({
                                      ...current,
                                      effort_minutes: clampMinutes(value),
                                    }))
                                  }}
                                  className="ui-input h-9 w-20"
                                />
                                <span className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
                                  min
                                </span>
                              </div>

                              <Button variant="danger" size="sm" onClick={() => deleteTask(fullIndex)}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm"
                  style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                >
                  Select a subject and chapter to build detailed structure.
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
          Phase 1 now captures chapter tasks and effort so phase 2 can start with meaningful defaults.
        </p>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!canProceed || isSaving}
        >
          {isSaving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </div>
  )
}

interface PlannerColumnItem {
  label: string
  hint?: string
  onClick: () => void
  onDelete?: () => void
}

interface PlannerColumnProps {
  title: string
  items: PlannerColumnItem[]
  activeIndex: number
  emptyMessage?: string
  footer?: ReactNode
}

function PlannerColumn({
  title,
  items,
  activeIndex,
  emptyMessage = "No items available.",
  footer,
}: PlannerColumnProps) {
  return (
    <section
      className="w-[220px] min-w-[208px] h-full shrink-0 rounded-xl border px-2 py-2 snap-start flex flex-col"
      style={{
        borderColor: "var(--sh-border)",
        background: "color-mix(in srgb, var(--sh-card) 94%, var(--foreground) 6%)",
      }}
    >
      <div className="px-1.5 pb-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--sh-text-muted)" }}
        >
          {title}
        </p>
      </div>

      <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="px-2 py-4 text-sm" style={{ color: "var(--sh-text-muted)" }}>
            {emptyMessage}
          </p>
        )}

        {items.map((item, index) => {
          const isActive = index === activeIndex

          return (
            <div
              key={`${item.label}-${index}`}
              className="rounded-lg border p-1.5 transition-colors"
              style={{
                borderColor: isActive ? "var(--sh-primary-glow)" : "transparent",
                background: isActive ? "var(--sh-primary-muted)" : "transparent",
              }}
            >
              <div className="flex items-start gap-1.5">
                <button
                  type="button"
                  onClick={item.onClick}
                  className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[rgba(124,108,255,0.08)]"
                >
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: isActive ? "var(--sh-primary-light)" : "var(--sh-text-primary)" }}
                  >
                    {item.label}
                  </p>
                  {item.hint && (
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                      {item.hint}
                    </p>
                  )}
                </button>

                {item.onDelete && (
                  <Button variant="danger" size="sm" onClick={item.onDelete}>
                    x
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {footer && (
        <div className="mt-2 space-y-1.5 border-t px-1 pt-2" style={{ borderColor: "var(--sh-border)" }}>
          {footer}
        </div>
      )}
    </section>
  )
}

interface UnitChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function UnitChip({ label, active, onClick }: UnitChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors"
      style={{
        borderColor: active ? "var(--sh-primary-glow)" : "var(--sh-border)",
        background: active ? "var(--sh-primary-muted)" : "transparent",
        color: active ? "var(--sh-primary-light)" : "var(--sh-text-secondary)",
      }}
    >
      {label}
    </button>
  )
}
