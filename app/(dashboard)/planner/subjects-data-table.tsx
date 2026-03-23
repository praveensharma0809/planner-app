"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"
import {
  getPlanConfig,
  getStructure,
  getTopicParams,
  savePlanConfig,
  saveTopicParams,
} from "@/app/actions/planner/setup"
import {
  addChapter,
  archiveChapter,
  deleteChapter,
  unarchiveChapter,
  updateChapter,
} from "@/app/actions/subjects/chapters"
import {
  addSubtopic,
  deleteSubtopic,
  updateSubtopic,
} from "@/app/actions/subjects/subtopics"
import {
  assignTasksToCluster,
  bulkUpdateSubjectTaskDuration,
  bulkCreateSubjectTasks,
  createSubjectTask,
  deleteSubjectTasks,
  deleteSubjectTask,
  reorderTasks,
  updateSubjectTaskDuration,
  updateSubjectTaskTitle,
} from "@/app/actions/subjects/tasks"
import { addOffDay } from "@/app/actions/offdays/addOffDay"
import { deleteOffDay } from "@/app/actions/offdays/deleteOffDay"
import { getOffDays } from "@/app/actions/offdays/getOffDays"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
import { reorderSubjects as reorderSubjectsAction } from "@/app/actions/subjects/reorderSubjects"
import { reorderChapters as reorderChaptersAction } from "@/app/actions/subjects/reorderChapters"
import { useSidebar } from "@/app/components/layout/AppShell"
import { PageHeader } from "@/app/components/layout/PageHeader"
import { useToast } from "@/app/components/Toast"
import { Button, Input, Modal } from "@/app/components/ui"
import { SubjectDrawer } from "./SubjectDrawer"
import {
  MAX_SESSION_LENGTH_MINUTES,
  MIN_SESSION_LENGTH_MINUTES,
} from "@/lib/planner/draft"

export interface SubjectNavTopic {
  id: string
  name: string
}

export interface SubjectNavChapter {
  id: string
  name: string
  archived?: boolean
  earliestStart?: string | null
  deadline?: string | null
  restAfterDays?: number
  topics: SubjectNavTopic[]
}

export interface SubjectNavItem {
  id: string
  name: string
  archived: boolean
  chapters: SubjectNavChapter[]
}

export interface TopicTaskItem {
  id: string
  topicId: string
  clusterId: string | null
  title: string
  completed: boolean
  durationMinutes: number
}

interface IntakeConstraintsDraft {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  day_of_week_capacity: (number | null)[]
  custom_day_capacity: Record<string, number>
  flexibility_minutes: number
  max_daily_minutes: number
  max_active_subjects: number
}

interface OffDayItem {
  id: string
  date: string
  reason: string | null
}

type DependencyScope = "subject" | "chapter"

interface TopicMetaDraft {
  earliestStart: string | null
  deadline: string | null
  restAfterDays: number
}

interface TopicParamDraft {
  topic_id: string
  estimated_hours: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  session_length_minutes: number
  rest_after_days: number
  max_sessions_per_day: number
  study_frequency: "daily" | "spaced"
}

interface Props {
  initialSubjects: SubjectNavItem[]
  initialTasksByChapter: Record<string, TopicTaskItem[]>
  embedded?: boolean
  showPageHeader?: boolean
  pageHeaderTitle?: string
  pageHeaderEyebrow?: string
  pageHeaderSubtitle?: string
}

interface ColumnItem {
  id: string
  label: string
  hint?: string
  onEdit?: () => void
  onDelete?: () => void
}

type NameDialogState = {
  open: boolean
  mode: "create" | "edit"
  targetId: string | null
  value: string
  earliestStart?: string
  deadline?: string
  restAfterDays?: string
}

type TaskCreateMode = "single" | "bulk"
type NumberPlacement = "suffix" | "prefix"

const NONE_CLUSTER_VALUE = "__none__"
const NEW_CLUSTER_VALUE = "__new__"
const ALL_CLUSTER_FILTER_VALUE = "__all__"
const UNCLUSTERED_FILTER_VALUE = "__unclustered__"
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const CLOSED_DIALOG_STATE: NameDialogState = {
  open: false,
  mode: "create",
  targetId: null,
  value: "",
  earliestStart: "",
  deadline: "",
  restAfterDays: "0",
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function defaultIntakeConstraints(): IntakeConstraintsDraft {
  return {
    study_start_date: new Date().toISOString().slice(0, 10),
    exam_date: "",
    weekday_capacity_minutes: 180,
    weekend_capacity_minutes: 240,
    day_of_week_capacity: [null, null, null, null, null, null, null],
    custom_day_capacity: {},
    flexibility_minutes: 0,
    max_daily_minutes: 480,
    max_active_subjects: 0,
  }
}

function normalizeDurationMinutes(rawMinutes: number): number {
  const parsed = Number.isFinite(rawMinutes)
    ? Math.trunc(rawMinutes)
    : MIN_SESSION_LENGTH_MINUTES

  return clampInteger(parsed, MIN_SESSION_LENGTH_MINUTES, MAX_SESSION_LENGTH_MINUTES)
}

function normalizeDayOfWeekCapacity(values: (number | null)[] | null | undefined): (number | null)[] {
  const next = Array.from({ length: 7 }, (_, index) => {
    const value = values?.[index]
    if (value == null) return null

    const parsed = Math.trunc(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  })

  return next
}

function composeSeriesName(
  baseName: string,
  index: number,
  placement: NumberPlacement,
  separator: string,
  numberPadding: number
): string {
  const numeric = String(index).padStart(Math.max(0, numberPadding), "0")
  const cleanSeparator = separator.trim()

  if (placement === "prefix") {
    return cleanSeparator ? `${numeric}${cleanSeparator}${baseName}` : `${numeric}${baseName}`
  }

  return cleanSeparator ? `${baseName}${cleanSeparator}${numeric}` : `${baseName}${numeric}`
}

function buildNumericPatternKey(title: string): string | null {
  const normalized = title.trim().toLowerCase()
  if (!normalized) return null

  if (!/\d/.test(normalized)) return null
  return normalized.replace(/\d+/g, "#")
}

function extractNumericParts(title: string): number[] {
  const matches = title.match(/\d+/g)
  if (!matches) return []

  return matches
    .map((token) => Number.parseInt(token, 10))
    .filter((value) => Number.isFinite(value))
}

function shouldAutoOrderTasks(tasks: TopicTaskItem[]): boolean {
  if (tasks.length < 2) return false

  const patternCounts = new Map<string, number>()
  for (const task of tasks) {
    const key = buildNumericPatternKey(task.title)
    if (!key) continue
    patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1)
  }

  let maxPatternCount = 0
  for (const count of patternCounts.values()) {
    if (count > maxPatternCount) {
      maxPatternCount = count
    }
  }

  return maxPatternCount >= 2
}

function compareTasksNaturally(left: TopicTaskItem, right: TopicTaskItem): number {
  const leftTitle = left.title.trim()
  const rightTitle = right.title.trim()

  if (!leftTitle && !rightTitle) {
    return left.id.localeCompare(right.id)
  }
  if (!leftTitle) return 1
  if (!rightTitle) return -1

  const leftPattern = buildNumericPatternKey(leftTitle)
  const rightPattern = buildNumericPatternKey(rightTitle)

  if (leftPattern && rightPattern && leftPattern === rightPattern) {
    const leftNumbers = extractNumericParts(leftTitle)
    const rightNumbers = extractNumericParts(rightTitle)
    const maxLength = Math.max(leftNumbers.length, rightNumbers.length)

    for (let index = 0; index < maxLength; index += 1) {
      const leftValue = leftNumbers[index]
      const rightValue = rightNumbers[index]

      if (leftValue === undefined && rightValue === undefined) break
      if (leftValue === undefined) return -1
      if (rightValue === undefined) return 1
      if (leftValue !== rightValue) return leftValue - rightValue
    }
  }

  const byTitle = leftTitle.localeCompare(rightTitle, undefined, {
    numeric: true,
    sensitivity: "base",
  })

  if (byTitle !== 0) return byTitle
  return left.id.localeCompare(right.id)
}

export function SubjectsDataTable({
  initialSubjects,
  initialTasksByChapter,
  embedded = false,
  showPageHeader = true,
  pageHeaderTitle = "Subjects",
  pageHeaderEyebrow,
  pageHeaderSubtitle,
}: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const { collapsed } = useSidebar()
  const sidebarExpanded = !collapsed
  const [subjects, setSubjects] = useState<SubjectNavItem[]>(initialSubjects)
  const [tasksByChapter, setTasksByChapter] =
    useState<Record<string, TopicTaskItem[]>>(initialTasksByChapter)
  const [showArchived, setShowArchived] = useState(false)
  const [pendingSubjectId, setPendingSubjectId] = useState<string | null>(null)
  const [pendingChapterId, setPendingChapterId] = useState<string | null>(null)
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set())

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [selectedSubjectIdForDrawer, setSelectedSubjectIdForDrawer] = useState<string | null>(null)

  const [chapterDialog, setChapterDialog] = useState<NameDialogState>(CLOSED_DIALOG_STATE)
  const [chapterDialogSaving, setChapterDialogSaving] = useState(false)

  const [clusterDialog, setClusterDialog] = useState<NameDialogState>(CLOSED_DIALOG_STATE)
  const [clusterDialogSaving, setClusterDialogSaving] = useState(false)

  const [taskDialog, setTaskDialog] = useState<NameDialogState>(CLOSED_DIALOG_STATE)
  const [taskDialogSaving, setTaskDialogSaving] = useState(false)
  const [taskDurationDrafts, setTaskDurationDrafts] = useState<Record<string, string>>({})
  const [taskDurationSavingIds, setTaskDurationSavingIds] = useState<Set<string>>(new Set())
  const [bulkDurationInput, setBulkDurationInput] = useState("60")
  const [bulkDurationSaving, setBulkDurationSaving] = useState(false)

  const [taskComposerOpen, setTaskComposerOpen] = useState(false)
  const [taskComposerSaving, setTaskComposerSaving] = useState(false)
  const [taskCreateMode, setTaskCreateMode] = useState<TaskCreateMode>("single")
  const [singleTaskTitle, setSingleTaskTitle] = useState("")
  const [bulkBaseName, setBulkBaseName] = useState("")
  const [bulkCount, setBulkCount] = useState("5")
  const [bulkStartAt, setBulkStartAt] = useState("1")
  const [bulkNumberPadding, setBulkNumberPadding] = useState("0")
  const [bulkSeparator, setBulkSeparator] = useState("-")
  const [bulkPlacement, setBulkPlacement] = useState<NumberPlacement>("suffix")
  const [composerClusterValue, setComposerClusterValue] = useState(NONE_CLUSTER_VALUE)
  const [composerNewClusterName, setComposerNewClusterName] = useState("")

  const [manageMode, setManageMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [assignClusterValue, setAssignClusterValue] = useState(NONE_CLUSTER_VALUE)
  const [assigningCluster, setAssigningCluster] = useState(false)
  const [deletingSelectedTasks, setDeletingSelectedTasks] = useState(false)

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [clusterFilterValue, setClusterFilterValue] = useState(ALL_CLUSTER_FILTER_VALUE)
  const [clusterManagerExpanded, setClusterManagerExpanded] = useState(false)
  const [manualOrderChapterIds, setManualOrderChapterIds] = useState<Set<string>>(new Set())
  const [reorderingTaskIds, setReorderingTaskIds] = useState<string[]>([])
  const [reorderingSubjects, setReorderingSubjects] = useState(false)
  const [reorderingChapters, setReorderingChapters] = useState(false)

  const [importingAll, setImportingAll] = useState(false)
  const [importingUndone, setImportingUndone] = useState(false)
  const [resettingIntake, setResettingIntake] = useState(false)

  const [dependencyModalOpen, setDependencyModalOpen] = useState(false)
  const [dependencyScope, setDependencyScope] = useState<DependencyScope>("chapter")
  const [dependencyTargetChapterId, setDependencyTargetChapterId] = useState("")
  const [dependencySelectedIds, setDependencySelectedIds] = useState<Set<string>>(new Set())
  const [dependencySearch, setDependencySearch] = useState("")
  const [dependencyLoading, setDependencyLoading] = useState(false)
  const [dependencySaving, setDependencySaving] = useState(false)
  const [topicParamsByTopic, setTopicParamsByTopic] = useState<Map<string, TopicParamDraft>>(new Map())

  const [constraintsDraft, setConstraintsDraft] = useState<IntakeConstraintsDraft>(
    defaultIntakeConstraints()
  )
  const [constraintsLoading, setConstraintsLoading] = useState(true)
  const [constraintsSaving, setConstraintsSaving] = useState(false)

  const [offDays, setOffDays] = useState<OffDayItem[]>([])
  const [offDaysLoading, setOffDaysLoading] = useState(true)
  const [offDayDateInput, setOffDayDateInput] = useState("")
  const [offDayReasonInput, setOffDayReasonInput] = useState("")
  const [offDaySaving, setOffDaySaving] = useState(false)

  const [customCapacityDateInput, setCustomCapacityDateInput] = useState("")
  const [customCapacityMinutesInput, setCustomCapacityMinutesInput] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    setSubjects(initialSubjects)
  }, [initialSubjects])

  useEffect(() => {
    setTasksByChapter(initialTasksByChapter)
  }, [initialTasksByChapter])

  const mapTopicParamsToDraftMap = useCallback((rows: Array<{
    topic_id: string
    estimated_hours: number
    deadline?: string | null
    earliest_start?: string | null
    depends_on?: string[] | null
    session_length_minutes?: number
    rest_after_days?: number
    max_sessions_per_day?: number
    study_frequency?: string
  }>) => {
    const map = new Map<string, TopicParamDraft>()
    for (const row of rows) {
      map.set(row.topic_id, {
        topic_id: row.topic_id,
        estimated_hours: Math.max(0, row.estimated_hours ?? 0),
        deadline: row.deadline ?? null,
        earliest_start: row.earliest_start ?? null,
        depends_on: row.depends_on ?? [],
        session_length_minutes: normalizeDurationMinutes(row.session_length_minutes ?? 60),
        rest_after_days: Math.max(0, row.rest_after_days ?? 0),
        max_sessions_per_day: Math.max(0, row.max_sessions_per_day ?? 0),
        study_frequency: row.study_frequency === "spaced" ? "spaced" : "daily",
      })
    }
    return map
  }, [])

  const loadTopicParamsSnapshot = useCallback(async (showErrorToast = false) => {
    const paramsRes = await getTopicParams()
    if (paramsRes.status !== "SUCCESS") {
      if (showErrorToast) {
        addToast("Failed to load chapter dependency data.", "error")
      }
      return new Map<string, TopicParamDraft>()
    }

    const map = mapTopicParamsToDraftMap(paramsRes.params)
    setTopicParamsByTopic(map)
    return map
  }, [addToast, mapTopicParamsToDraftMap])

  const loadStep2Snapshot = useCallback(async (showErrorToast = false) => {
    setConstraintsLoading(true)
    setOffDaysLoading(true)

    const [configRes, offDaysRes] = await Promise.all([
      getPlanConfig(),
      getOffDays(),
    ])

    if (configRes.status === "SUCCESS" && configRes.config) {
      const cfg = configRes.config
      setConstraintsDraft({
        study_start_date: cfg.study_start_date,
        exam_date: cfg.exam_date,
        weekday_capacity_minutes: cfg.weekday_capacity_minutes,
        weekend_capacity_minutes: cfg.weekend_capacity_minutes,
        day_of_week_capacity: normalizeDayOfWeekCapacity(cfg.day_of_week_capacity),
        custom_day_capacity: cfg.custom_day_capacity ?? {},
        flexibility_minutes: Math.max(0, cfg.flexibility_minutes ?? 0),
        max_daily_minutes: Math.max(30, cfg.max_daily_minutes ?? 480),
        max_active_subjects: Math.max(0, cfg.max_active_subjects ?? 0),
      })
    } else if (showErrorToast) {
      addToast("Could not load saved constraints.", "error")
    }

    if (offDaysRes.status === "SUCCESS") {
      setOffDays(
        offDaysRes.offDays.map((offDay) => ({
          id: offDay.id,
          date: offDay.date,
          reason: offDay.reason,
        }))
      )
    } else if (showErrorToast) {
      addToast("Could not load off-days.", "error")
    }

    setConstraintsLoading(false)
    setOffDaysLoading(false)
  }, [addToast])

  useEffect(() => {
    void loadStep2Snapshot(false)
    void loadTopicParamsSnapshot(false)
  }, [loadStep2Snapshot, loadTopicParamsSnapshot])

  const activeSubjects = useMemo(
    () => subjects.filter((subject) => !subject.archived),
    [subjects]
  )
  const archivedSubjects = useMemo(
    () => subjects.filter((subject) => subject.archived),
    [subjects]
  )
  const displaySubjects = showArchived ? archivedSubjects : activeSubjects

  useEffect(() => {
    if (displaySubjects.length === 0) {
      setSelectedSubjectId(null)
      return
    }

    setSelectedSubjectId((current) => {
      if (current && displaySubjects.some((subject) => subject.id === current)) return current
      return displaySubjects[0].id
    })
  }, [displaySubjects])

  const selectedSubject =
    displaySubjects.find((subject) => subject.id === selectedSubjectId) ?? null

  useEffect(() => {
    const chapters = selectedSubject?.chapters ?? []
    if (chapters.length === 0) {
      setSelectedChapterId(null)
      return
    }

    setSelectedChapterId((current) => {
      if (current && chapters.some((chapter) => chapter.id === current)) return current
      return chapters[0].id
    })
  }, [selectedSubject])

  const selectedChapter =
    selectedSubject?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null

  const allActiveChapters = useMemo(
    () => activeSubjects.flatMap((subject) =>
      subject.chapters.map((chapter) => ({
        ...chapter,
        subjectId: subject.id,
        subjectName: subject.name,
      }))
    ),
    [activeSubjects]
  )

  const chapterById = useMemo(
    () => new Map(allActiveChapters.map((chapter) => [chapter.id, chapter])),
    [allActiveChapters]
  )

  useEffect(() => {
    setClusterFilterValue(ALL_CLUSTER_FILTER_VALUE)
    setSelectedTaskIds(new Set())
    setManageMode(false)
    setAssignClusterValue(NONE_CLUSTER_VALUE)
    setComposerClusterValue(NONE_CLUSTER_VALUE)
    setComposerNewClusterName("")
    setClusterManagerExpanded(false)
  }, [selectedChapter?.id, showArchived])

  useEffect(() => {
    if (!dependencyModalOpen || !dependencyTargetChapterId) return
    setDependencySelectedIds(new Set(topicParamsByTopic.get(dependencyTargetChapterId)?.depends_on ?? []))
  }, [dependencyModalOpen, dependencyTargetChapterId, topicParamsByTopic])

  const chapterTasks = useMemo(
    () => (selectedChapter ? tasksByChapter[selectedChapter.id] ?? [] : []),
    [selectedChapter, tasksByChapter]
  )
  const completedCount = useMemo(
    () => chapterTasks.filter((task) => task.completed).length,
    [chapterTasks]
  )
  const chapterClusters = useMemo(
    () => selectedChapter?.topics ?? [],
    [selectedChapter]
  )

  const clusterNameById = useMemo(
    () => new Map(chapterClusters.map((cluster) => [cluster.id, cluster.name])),
    [chapterClusters]
  )

  const { clusterTaskCounts, unclusteredTaskCount } = useMemo(() => {
    const counts = new Map<string, number>()
    let unclustered = 0

    for (const task of chapterTasks) {
      if (!task.clusterId) {
        unclustered += 1
        continue
      }
      counts.set(task.clusterId, (counts.get(task.clusterId) ?? 0) + 1)
    }

    return {
      clusterTaskCounts: counts,
      unclusteredTaskCount: unclustered,
    }
  }, [chapterTasks])

  const visibleTasks = useMemo(() => {
    if (clusterFilterValue === ALL_CLUSTER_FILTER_VALUE) {
      return chapterTasks
    }

    if (clusterFilterValue === UNCLUSTERED_FILTER_VALUE) {
      return chapterTasks.filter((task) => !task.clusterId)
    }

    return chapterTasks.filter((task) => task.clusterId === clusterFilterValue)
  }, [chapterTasks, clusterFilterValue])

  const visibleCompletedCount = useMemo(
    () => visibleTasks.filter((task) => task.completed).length,
    [visibleTasks]
  )

  const subjectColumnItems: ColumnItem[] = displaySubjects.map((subject) => ({
    id: subject.id,
    label: subject.name,
    hint: `${subject.chapters.length} chapter${subject.chapters.length === 1 ? "" : "s"}`,
    onEdit: showArchived ? undefined : () => openEditSubject(subject.id),
  }))

  const chapterColumnItems: ColumnItem[] = (selectedSubject?.chapters ?? []).map((chapter) => ({
    id: chapter.id,
    label: chapter.name,
    hint: `${chapter.topics.length} cluster${chapter.topics.length === 1 ? "" : "s"}`,
    onEdit: showArchived ? undefined : () => openEditChapter(chapter.id, chapter.name),
  }))

  const allVisibleSelected =
    visibleTasks.length > 0 && visibleTasks.every((task) => selectedTaskIds.has(task.id))

  const selectedDetailTitle = (() => {
    if (clusterFilterValue === ALL_CLUSTER_FILTER_VALUE) {
      return selectedChapter?.name ?? "Overview"
    }

    if (clusterFilterValue === UNCLUSTERED_FILTER_VALUE) {
      return "Unclustered"
    }

    return clusterNameById.get(clusterFilterValue) ?? "Cluster"
  })()

  const progressCompleted =
    clusterFilterValue === ALL_CLUSTER_FILTER_VALUE ? completedCount : visibleCompletedCount
  const progressTotal =
    clusterFilterValue === ALL_CLUSTER_FILTER_VALUE ? chapterTasks.length : visibleTasks.length
  const progressScopeLabel =
    clusterFilterValue === ALL_CLUSTER_FILTER_VALUE ? "Chapter progress" : "Filtered progress"

  const bulkPreview = useMemo(() => {
    const baseName = bulkBaseName.trim()
    if (!baseName) return []

    const count = clampInteger(Number.parseInt(bulkCount, 10) || 0, 1, 4)
    const startAt = clampInteger(Number.parseInt(bulkStartAt, 10) || 1, 1, 9999)
    const numberPadding = clampInteger(Number.parseInt(bulkNumberPadding, 10) || 0, 0, 6)

    return Array.from({ length: count }, (_, index) =>
      composeSeriesName(
        baseName,
        startAt + index,
        bulkPlacement,
        bulkSeparator,
        numberPadding
      )
    )
  }, [bulkBaseName, bulkCount, bulkStartAt, bulkNumberPadding, bulkPlacement, bulkSeparator])

  function resetTaskComposerFields() {
    setTaskCreateMode("single")
    setSingleTaskTitle("")
    setBulkBaseName("")
    setBulkCount("5")
    setBulkStartAt("1")
    setBulkNumberPadding("0")
    setBulkSeparator("-")
    setBulkPlacement("suffix")
    setComposerClusterValue(NONE_CLUSTER_VALUE)
    setComposerNewClusterName("")
  }

  function openCreateSubject() {
    if (showArchived) return
    setDrawerMode("create")
    setSelectedSubjectIdForDrawer(null)
    setDrawerOpen(true)
  }

  function openEditSubject(subjectId: string) {
    setDrawerMode("edit")
    setSelectedSubjectIdForDrawer(subjectId)
    setDrawerOpen(true)
  }

  function openCreateChapter() {
    if (!selectedSubject || showArchived) return
    setChapterDialog({
      open: true,
      mode: "create",
      targetId: null,
      value: "",
      earliestStart: "",
      deadline: "",
      restAfterDays: "0",
    })
  }

  function openEditChapter(chapterId: string, chapterName: string) {
    const chapter = selectedSubject?.chapters.find((item) => item.id === chapterId)
    setChapterDialog({
      open: true,
      mode: "edit",
      targetId: chapterId,
      value: chapterName,
      earliestStart: chapter?.earliestStart ?? "",
      deadline: chapter?.deadline ?? "",
      restAfterDays: String(Math.max(0, chapter?.restAfterDays ?? 0)),
    })
  }

  function openCreateCluster() {
    if (!selectedChapter || showArchived) return
    setClusterDialog({
      open: true,
      mode: "create",
      targetId: null,
      value: "",
    })
  }

  function openEditCluster(clusterId: string, clusterName: string) {
    setClusterDialog({
      open: true,
      mode: "edit",
      targetId: clusterId,
      value: clusterName,
    })
  }

  function openEditTask(taskId: string, taskTitle: string) {
    setTaskDialog({
      open: true,
      mode: "edit",
      targetId: taskId,
      value: taskTitle,
    })
  }

  function openTaskComposer() {
    if (!selectedChapter || showArchived) return
    resetTaskComposerFields()
    setTaskComposerOpen(true)
  }

  async function handleArchiveSelected() {
    if (!selectedSubjectId || pendingSubjectId) return

    setPendingSubjectId(selectedSubjectId)
    const result = await toggleArchiveSubject(selectedSubjectId)

    if (result.status === "SUCCESS") {
      setSubjects((previous) =>
        previous.map((subject) =>
          subject.id === selectedSubjectId ? { ...subject, archived: result.archived } : subject
        )
      )
      addToast(result.archived ? "Subject archived." : "Subject restored.", "success")
      router.refresh()
    } else {
      addToast(result.status === "ERROR" ? result.message : "Unauthorized", "error")
    }

    setPendingSubjectId(null)
  }

  async function handleArchiveChapter() {
    if (!selectedChapterId || pendingChapterId) return

    setPendingChapterId(selectedChapterId)

    try {
      const result = await archiveChapter(selectedChapterId)

      if (result.status === "SUCCESS") {
        addToast("Chapter archived.", "success")
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setPendingChapterId(null)
    }
  }

  async function handleUnarchiveChapter() {
    if (!selectedChapterId || pendingChapterId) return

    setPendingChapterId(selectedChapterId)

    try {
      const result = await unarchiveChapter(selectedChapterId)

      if (result.status === "SUCCESS") {
        addToast("Chapter restored.", "success")
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setPendingChapterId(null)
    }
  }

  async function handleTasksDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id || !selectedChapter) {
      return
    }

    const activeTaskId = String(active.id)
    const overTaskId = String(over.id)
    const fromIndex = visibleTasks.findIndex((task) => task.id === activeTaskId)
    const toIndex = visibleTasks.findIndex((task) => task.id === overTaskId)

    if (fromIndex < 0 || toIndex < 0) {
      return
    }

    const chapterId = selectedChapter.id
    const hadManualOverride = manualOrderChapterIds.has(chapterId)
    if (!hadManualOverride) {
      setManualOrderChapterIds((current) => {
        const next = new Set(current)
        next.add(chapterId)
        return next
      })
    }

    const reorderedVisibleTasks = arrayMove(visibleTasks, fromIndex, toIndex)
    let reorderedChapterTasks: TopicTaskItem[]

    if (clusterFilterValue === ALL_CLUSTER_FILTER_VALUE) {
      reorderedChapterTasks = reorderedVisibleTasks
    } else {
      const reorderedVisibleIdSet = new Set(reorderedVisibleTasks.map((task) => task.id))

      let cursor = 0
      reorderedChapterTasks = chapterTasks.map((task) => {
        if (!reorderedVisibleIdSet.has(task.id)) {
          return task
        }

        const nextTask = reorderedVisibleTasks[cursor]
        cursor += 1
        return nextTask
      })
    }

    const orderedChapterTaskIds = reorderedChapterTasks.map((task) => task.id)

    setReorderingTaskIds(orderedChapterTaskIds)
    setTasksByChapter((previous) => ({
      ...previous,
      [chapterId]: reorderedChapterTasks,
    }))

    const result = await reorderTasks({
      chapterId,
      taskIds: orderedChapterTaskIds,
    })

    if (result.status !== "SUCCESS") {
      if (!hadManualOverride) {
        setManualOrderChapterIds((current) => {
          const next = new Set(current)
          next.delete(chapterId)
          return next
        })
      }
      addToast(result.status === "ERROR" ? result.message : "Failed to reorder tasks.", "error")
      router.refresh()
    }

    setReorderingTaskIds([])
  }

  useEffect(() => {
    if (!selectedChapter || showArchived) return
    if (reorderingTaskIds.length > 0) return

    const chapterId = selectedChapter.id
    if (manualOrderChapterIds.has(chapterId)) return
    if (!shouldAutoOrderTasks(chapterTasks)) return

    const autoOrderedTasks = [...chapterTasks].sort(compareTasksNaturally)
    const unchanged = autoOrderedTasks.every((task, index) => task.id === chapterTasks[index]?.id)
    if (unchanged) return

    const orderedTaskIds = autoOrderedTasks.map((task) => task.id)
    setReorderingTaskIds(orderedTaskIds)
    setTasksByChapter((previous) => ({
      ...previous,
      [chapterId]: autoOrderedTasks,
    }))

    let alive = true

    void (async () => {
      const result = await reorderTasks({
        chapterId,
        taskIds: orderedTaskIds,
      })

      if (!alive) return

      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Failed to auto-order tasks.", "error")
        router.refresh()
      }

      setReorderingTaskIds([])
    })()

    return () => {
      alive = false
    }
  }, [addToast, chapterTasks, manualOrderChapterIds, reorderingTaskIds.length, router, selectedChapter, showArchived])


  async function handleSaveChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!chapterDialog.value.trim()) {
      addToast("Chapter name is required.", "error")
      return
    }

    const earliestStart = chapterDialog.earliestStart?.trim() || null
    const deadline = chapterDialog.deadline?.trim() || null
    const restAfterDays = Math.max(0, Number.parseInt(chapterDialog.restAfterDays || "0", 10) || 0)

    if (earliestStart && deadline && earliestStart > deadline) {
      addToast("Chapter start date must be on or before chapter deadline.", "error")
      return
    }

    setChapterDialogSaving(true)

    try {
      if (chapterDialog.mode === "create") {
        if (!selectedSubject) return

        const result = await addChapter(selectedSubject.id, chapterDialog.value)
        if (result.status === "SUCCESS") {
          setSelectedChapterId(result.chapterId)
          setChapterDialog(CLOSED_DIALOG_STATE)
          addToast("Chapter added.", "success")
          router.refresh()
          return
        }

        if (result.status === "UNAUTHORIZED") {
          addToast("Unauthorized", "error")
          return
        }

        addToast(result.message, "error")
        return
      }

      if (!chapterDialog.targetId) return
      const result = await updateChapter(chapterDialog.targetId, chapterDialog.value, {
        earliest_start: earliestStart,
        deadline,
        rest_after_days: restAfterDays,
      })

      if (result.status === "SUCCESS") {
        setChapterDialog(CLOSED_DIALOG_STATE)
        addToast("Chapter updated.", "success")
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setChapterDialogSaving(false)
    }
  }

  async function handleSaveCluster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!clusterDialog.value.trim()) {
      addToast("Cluster name is required.", "error")
      return
    }

    setClusterDialogSaving(true)

    try {
      if (clusterDialog.mode === "create") {
        if (!selectedChapter) return

        const result = await addSubtopic(selectedChapter.id, clusterDialog.value)
        if (result.status === "SUCCESS") {
          setClusterFilterValue(result.subtopic.id)
          setClusterDialog(CLOSED_DIALOG_STATE)
          addToast("Cluster created.", "success")
          router.refresh()
          return
        }

        if (result.status === "UNAUTHORIZED") {
          addToast("Unauthorized", "error")
          return
        }

        addToast(result.message, "error")
        return
      }

      if (!clusterDialog.targetId) return
      const result = await updateSubtopic(clusterDialog.targetId, clusterDialog.value)

      if (result.status === "SUCCESS") {
        setClusterDialog(CLOSED_DIALOG_STATE)
        addToast("Cluster updated.", "success")
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setClusterDialogSaving(false)
    }
  }

  async function handleSaveTaskTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!taskDialog.targetId) return
    if (!taskDialog.value.trim()) {
      addToast("Task title is required.", "error")
      return
    }

    setTaskDialogSaving(true)

    try {
      const result = await updateSubjectTaskTitle(taskDialog.targetId, taskDialog.value)

      if (result.status === "SUCCESS") {
        if (selectedChapter) {
          const chapterId = selectedChapter.id
          const nextTitle = taskDialog.value.trim()

          setTasksByChapter((previous) => ({
            ...previous,
            [chapterId]: (previous[chapterId] ?? []).map((task) =>
              task.id === taskDialog.targetId ? { ...task, title: nextTitle } : task
            ),
          }))
        }

        setTaskDialog(CLOSED_DIALOG_STATE)
        addToast("Task updated.", "success")
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setTaskDialogSaving(false)
    }
  }

  async function handleDeleteChapter(chapterId: string, chapterName: string) {
    if (!window.confirm(`Delete chapter "${chapterName}"? Tasks linked to it will be detached.`)) {
      return
    }

    const result = await deleteChapter(chapterId)
    if (result.status === "SUCCESS") {
      addToast("Chapter deleted.", "success")
      router.refresh()
      return
    }

    if (result.status === "UNAUTHORIZED") {
      addToast("Unauthorized", "error")
      return
    }

    addToast(result.message, "error")
  }

  async function handleDeleteCluster(clusterId: string, clusterName: string) {
    if (!window.confirm(`Delete cluster "${clusterName}"? Its tasks will become unclustered.`)) {
      return
    }

    const result = await deleteSubtopic(clusterId)
    if (result.status === "SUCCESS") {
      if (clusterFilterValue === clusterId) {
        setClusterFilterValue(ALL_CLUSTER_FILTER_VALUE)
      }
      addToast("Cluster deleted.", "success")
      router.refresh()
      return
    }

    if (result.status === "UNAUTHORIZED") {
      addToast("Unauthorized", "error")
      return
    }

    addToast(result.message, "error")
  }

  async function handleDeleteTask(taskId: string, taskTitle: string) {
    if (!window.confirm(`Delete task "${taskTitle}"?`)) {
      return
    }

    const result = await deleteSubjectTask(taskId)
    if (result.status === "SUCCESS") {
      addToast("Task deleted.", "success")
      router.refresh()
      return
    }

    if (result.status === "UNAUTHORIZED") {
      addToast("Unauthorized", "error")
      return
    }

    addToast(result.message, "error")
  }

  async function resolveComposerClusterId(): Promise<string | null | undefined> {
    if (composerClusterValue === NONE_CLUSTER_VALUE) {
      return null
    }

    if (composerClusterValue === NEW_CLUSTER_VALUE) {
      if (!selectedChapter) {
        addToast("Choose a chapter first.", "error")
        return undefined
      }

      if (!composerNewClusterName.trim()) {
        addToast("New cluster name is required.", "error")
        return undefined
      }

      const createClusterResult = await addSubtopic(selectedChapter.id, composerNewClusterName)
      if (createClusterResult.status === "SUCCESS") {
        addToast("Cluster created.", "success")
        return createClusterResult.subtopic.id
      }

      if (createClusterResult.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return undefined
      }

      addToast(createClusterResult.message, "error")
      return undefined
    }

    return composerClusterValue
  }

  async function handleCreateTasks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedChapter) {
      addToast("Select a chapter first.", "error")
      return
    }

    setTaskComposerSaving(true)

    try {
      const clusterId = await resolveComposerClusterId()
      if (clusterId === undefined) {
        return
      }

      if (taskCreateMode === "single") {
        const title = singleTaskTitle.trim()
        if (!title) {
          addToast("Task title is required.", "error")
          return
        }

        const result = await createSubjectTask({
          chapterId: selectedChapter.id,
          title,
          clusterId,
        })

        if (result.status === "SUCCESS") {
          addToast("Task added.", "success")
          setTaskComposerOpen(false)
          resetTaskComposerFields()
          router.refresh()
          return
        }

        if (result.status === "UNAUTHORIZED") {
          addToast("Unauthorized", "error")
          return
        }

        addToast(result.message, "error")
        return
      }

      const baseName = bulkBaseName.trim()
      if (!baseName) {
        addToast("Base name is required for bulk creation.", "error")
        return
      }

      const count = Number.parseInt(bulkCount, 10)
      const startAt = Number.parseInt(bulkStartAt, 10)
      const numberPadding = Number.parseInt(bulkNumberPadding, 10)

      if (!Number.isFinite(count) || count < 1) {
        addToast("Task count must be at least 1.", "error")
        return
      }

      if (!Number.isFinite(startAt) || startAt < 1) {
        addToast("Start number must be at least 1.", "error")
        return
      }

      if (!Number.isFinite(numberPadding) || numberPadding < 0) {
        addToast("Number padding must be 0 or more.", "error")
        return
      }

      const result = await bulkCreateSubjectTasks({
        chapterId: selectedChapter.id,
        clusterId,
        baseName,
        count,
        startAt,
        numberPadding,
        separator: bulkSeparator,
        placement: bulkPlacement,
      })

      if (result.status === "SUCCESS") {
        addToast(`Added ${result.createdCount} tasks.`, "success")
        setTaskComposerOpen(false)
        resetTaskComposerFields()
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setTaskComposerSaving(false)
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  function toggleSelectVisibleTasks() {
    setSelectedTaskIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        for (const task of visibleTasks) {
          next.delete(task.id)
        }
      } else {
        for (const task of visibleTasks) {
          next.add(task.id)
        }
      }
      return next
    })
  }

  async function handleAssignSelectedTasksToCluster() {
    if (!selectedChapter) return

    const taskIds = Array.from(selectedTaskIds)
    if (taskIds.length === 0) {
      addToast("Select tasks to assign.", "error")
      return
    }

    const clusterId = assignClusterValue === NONE_CLUSTER_VALUE ? null : assignClusterValue

    setAssigningCluster(true)
    try {
      const result = await assignTasksToCluster({
        chapterId: selectedChapter.id,
        taskIds,
        clusterId,
      })

      if (result.status === "SUCCESS") {
        setSelectedTaskIds(new Set())
        addToast(`Updated ${result.updatedCount} task${result.updatedCount === 1 ? "" : "s"}.`, "success")
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setAssigningCluster(false)
    }
  }

  async function handleDeleteSelectedTasks() {
    if (!selectedChapter) return

    const taskIds = Array.from(selectedTaskIds)
    if (taskIds.length === 0) {
      addToast("Select tasks to delete.", "error")
      return
    }

    if (!window.confirm(`Delete ${taskIds.length} selected task${taskIds.length === 1 ? "" : "s"}?`)) {
      return
    }

    setDeletingSelectedTasks(true)
    try {
      const result = await deleteSubjectTasks({
        chapterId: selectedChapter.id,
        taskIds,
      })

      if (result.status === "SUCCESS") {
        const selectedIdSet = new Set(taskIds)
        setTasksByChapter((previous) => ({
          ...previous,
          [selectedChapter.id]: (previous[selectedChapter.id] ?? []).filter(
            (task) => !selectedIdSet.has(task.id)
          ),
        }))
        setSelectedTaskIds(new Set())
        addToast(`Deleted ${result.deletedCount} task${result.deletedCount === 1 ? "" : "s"}.`, "success")
        router.refresh()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } finally {
      setDeletingSelectedTasks(false)
    }
  }

  async function handleToggleTask(taskId: string, nextCompleted: boolean) {
    if (!selectedChapter || showArchived) return
    if (pendingTaskIds.has(taskId)) return

    const chapterId = selectedChapter.id
    const currentTask = (tasksByChapter[chapterId] ?? []).find((task) => task.id === taskId)
    if (!currentTask) return

    setPendingTaskIds((current) => {
      const next = new Set(current)
      next.add(taskId)
      return next
    })

    setTasksByChapter((previous) => ({
      ...previous,
      [chapterId]: (previous[chapterId] ?? []).map((task) =>
        task.id === taskId ? { ...task, completed: nextCompleted } : task
      ),
    }))

    try {
      if (nextCompleted) {
        await completeTask(taskId)
      } else {
        await uncompleteTask(taskId)
      }
      router.refresh()
    } catch {
      setTasksByChapter((previous) => ({
        ...previous,
        [chapterId]: (previous[chapterId] ?? []).map((task) =>
          task.id === taskId ? { ...task, completed: currentTask.completed } : task
        ),
      }))
      addToast("Could not update task status.", "error")
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current)
        next.delete(taskId)
        return next
      })
    }
  }

  function setTaskDurationDraft(taskId: string, value: string) {
    setTaskDurationDrafts((previous) => ({
      ...previous,
      [taskId]: value,
    }))
  }

  async function handleSaveTaskDuration(taskId: string) {
    if (!selectedChapter || showArchived) return
    if (taskDurationSavingIds.has(taskId)) return

    const chapterId = selectedChapter.id
    const existingTask = (tasksByChapter[chapterId] ?? []).find((task) => task.id === taskId)
    if (!existingTask) return

    const rawValue = taskDurationDrafts[taskId] ?? String(existingTask.durationMinutes)
    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast(`Duration must be between ${MIN_SESSION_LENGTH_MINUTES} and ${MAX_SESSION_LENGTH_MINUTES} minutes.`, "error")
      return
    }

    const nextDuration = normalizeDurationMinutes(parsed)
    if (nextDuration === existingTask.durationMinutes) {
      setTaskDurationDrafts((previous) => {
        const next = { ...previous }
        delete next[taskId]
        return next
      })
      return
    }

    setTaskDurationSavingIds((previous) => {
      const next = new Set(previous)
      next.add(taskId)
      return next
    })

    setTasksByChapter((previous) => ({
      ...previous,
      [chapterId]: (previous[chapterId] ?? []).map((task) =>
        task.id === taskId ? { ...task, durationMinutes: nextDuration } : task
      ),
    }))

    const result = await updateSubjectTaskDuration({
      taskId,
      durationMinutes: nextDuration,
    })

    if (result.status !== "SUCCESS") {
      setTasksByChapter((previous) => ({
        ...previous,
        [chapterId]: (previous[chapterId] ?? []).map((task) =>
          task.id === taskId ? { ...task, durationMinutes: existingTask.durationMinutes } : task
        ),
      }))

      addToast(result.status === "ERROR" ? result.message : "Failed to update task duration.", "error")
    } else {
      addToast("Task duration updated.", "success")
      router.refresh()
    }

    setTaskDurationDrafts((previous) => {
      const next = { ...previous }
      delete next[taskId]
      return next
    })

    setTaskDurationSavingIds((previous) => {
      const next = new Set(previous)
      next.delete(taskId)
      return next
    })
  }

  async function handleApplySelectedTaskDuration() {
    if (!selectedChapter || showArchived) return

    const taskIds = Array.from(selectedTaskIds)
    if (taskIds.length === 0) {
      addToast("Select tasks to apply duration.", "error")
      return
    }

    const parsed = Number.parseInt(bulkDurationInput, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast(`Duration must be between ${MIN_SESSION_LENGTH_MINUTES} and ${MAX_SESSION_LENGTH_MINUTES} minutes.`, "error")
      return
    }

    const durationMinutes = normalizeDurationMinutes(parsed)
    const chapterId = selectedChapter.id
    const selectedTaskIdsSet = new Set(taskIds)
    const before = (tasksByChapter[chapterId] ?? []).filter((task) => selectedTaskIdsSet.has(task.id))

    setBulkDurationSaving(true)
    setTasksByChapter((previous) => ({
      ...previous,
      [chapterId]: (previous[chapterId] ?? []).map((task) =>
        selectedTaskIdsSet.has(task.id)
          ? { ...task, durationMinutes }
          : task
      ),
    }))

    const result = await bulkUpdateSubjectTaskDuration({
      chapterId,
      taskIds,
      durationMinutes,
    })

    if (result.status !== "SUCCESS") {
      const beforeMap = new Map(before.map((task) => [task.id, task.durationMinutes]))
      setTasksByChapter((previous) => ({
        ...previous,
        [chapterId]: (previous[chapterId] ?? []).map((task) =>
          beforeMap.has(task.id)
            ? { ...task, durationMinutes: beforeMap.get(task.id) ?? task.durationMinutes }
            : task
        ),
      }))
      addToast(result.status === "ERROR" ? result.message : "Failed to apply duration.", "error")
    } else {
      addToast(`Updated duration for ${result.updatedCount} task${result.updatedCount === 1 ? "" : "s"}.`, "success")
      router.refresh()
    }

    setBulkDurationSaving(false)
  }

  function updateDayOfWeekCapacity(index: number, rawValue: string) {
    setConstraintsDraft((previous) => {
      const next = [...previous.day_of_week_capacity]
      const trimmed = rawValue.trim()

      if (trimmed.length === 0) {
        next[index] = null
      } else {
        const parsed = Number.parseInt(trimmed, 10)
        next[index] = Number.isFinite(parsed) && parsed > 0 ? parsed : null
      }

      return {
        ...previous,
        day_of_week_capacity: next,
      }
    })
  }

  function handleAddCustomCapacityDate() {
    const date = customCapacityDateInput.trim()
    const parsed = Number.parseInt(customCapacityMinutesInput, 10)

    if (!date) {
      addToast("Choose a date for custom capacity.", "error")
      return
    }

    if (!Number.isFinite(parsed) || parsed < 0) {
      addToast("Custom capacity must be 0 or more minutes.", "error")
      return
    }

    setConstraintsDraft((previous) => ({
      ...previous,
      custom_day_capacity: {
        ...previous.custom_day_capacity,
        [date]: parsed,
      },
    }))

    setCustomCapacityDateInput("")
    setCustomCapacityMinutesInput("")
  }

  function handleRemoveCustomCapacityDate(date: string) {
    setConstraintsDraft((previous) => {
      const next = { ...previous.custom_day_capacity }
      delete next[date]
      return {
        ...previous,
        custom_day_capacity: next,
      }
    })
  }

  async function handleAddOffDay() {
    const date = offDayDateInput.trim()
    const reason = offDayReasonInput.trim()

    if (!date) {
      addToast("Select a date to mark off-day.", "error")
      return
    }

    if (offDays.some((offDay) => offDay.date === date)) {
      addToast("This date is already marked as off-day.", "info")
      return
    }

    setOffDaySaving(true)
    const result = await addOffDay({
      date,
      reason,
    })

    if (result.status === "SUCCESS") {
      setOffDays((previous) => [...previous, {
        id: result.id,
        date,
        reason: reason || null,
      }].sort((a, b) => a.date.localeCompare(b.date)))
      setOffDayDateInput("")
      setOffDayReasonInput("")
      addToast("Off-day added.", "success")
      router.refresh()
    } else {
      addToast(result.status === "ERROR" ? result.message : "Failed to add off-day.", "error")
    }

    setOffDaySaving(false)
  }

  async function handleDeleteOffDay(item: OffDayItem) {
    const result = await deleteOffDay(item.id)
    if (result.status === "SUCCESS") {
      setOffDays((previous) => previous.filter((offDay) => offDay.id !== item.id))
      addToast("Off-day removed.", "success")
      router.refresh()
      return
    }

    addToast(result.status === "ERROR" ? result.message : "Failed to remove off-day.", "error")
  }

  async function handleSaveConstraints() {
    if (!constraintsDraft.study_start_date || !constraintsDraft.exam_date) {
      addToast("Study start and exam date are required.", "error")
      return
    }

    if (constraintsDraft.study_start_date >= constraintsDraft.exam_date) {
      addToast("Exam date must be after study start date.", "error")
      return
    }

    setConstraintsSaving(true)

    const result = await savePlanConfig({
      study_start_date: constraintsDraft.study_start_date,
      exam_date: constraintsDraft.exam_date,
      weekday_capacity_minutes: Math.max(0, Math.trunc(constraintsDraft.weekday_capacity_minutes)),
      weekend_capacity_minutes: Math.max(0, Math.trunc(constraintsDraft.weekend_capacity_minutes)),
      max_active_subjects: Math.max(0, Math.trunc(constraintsDraft.max_active_subjects)),
      day_of_week_capacity: normalizeDayOfWeekCapacity(constraintsDraft.day_of_week_capacity),
      custom_day_capacity: constraintsDraft.custom_day_capacity,
      flexibility_minutes: Math.max(0, Math.trunc(constraintsDraft.flexibility_minutes)),
      max_daily_minutes: Math.max(30, Math.trunc(constraintsDraft.max_daily_minutes)),
    })

    if (result.status === "SUCCESS") {
      addToast("Step-2 constraints saved.", "success")
    } else {
      addToast(result.status === "ERROR" ? result.message : "Failed to save constraints.", "error")
    }

    setConstraintsSaving(false)
  }

  async function handleReorderSubjects(orderedIds: string[]) {
    if (showArchived || reorderingSubjects) return
    if (orderedIds.length <= 1) return

    const orderSet = new Set(orderedIds)
    const previousSubjects = subjects

    const reorderedActive = orderedIds
      .map((id) => previousSubjects.find((subject) => subject.id === id))
      .filter((subject): subject is SubjectNavItem => Boolean(subject))
    const remainingSubjects = previousSubjects.filter((subject) => !orderSet.has(subject.id))

    setSubjects([...reorderedActive, ...remainingSubjects])
    setReorderingSubjects(true)

    const result = await reorderSubjectsAction(
      orderedIds.map((id, sortOrder) => ({
        id,
        sort_order: sortOrder,
      }))
    )

    if (result.status !== "SUCCESS") {
      setSubjects(previousSubjects)
      addToast(result.status === "ERROR" ? result.message : "Failed to reorder subjects.", "error")
      router.refresh()
    }

    setReorderingSubjects(false)
  }

  async function handleReorderChapters(orderedIds: string[]) {
    if (showArchived || reorderingChapters || !selectedSubject) return
    if (orderedIds.length <= 1) return

    const previousSubjects = subjects
    const chapterLookup = new Map((selectedSubject.chapters ?? []).map((chapter) => [chapter.id, chapter]))
    const reorderedChapters = orderedIds
      .map((id) => chapterLookup.get(id))
      .filter((chapter): chapter is SubjectNavChapter => Boolean(chapter))

    setSubjects((current) =>
      current.map((subject) =>
        subject.id === selectedSubject.id
          ? { ...subject, chapters: reorderedChapters }
          : subject
      )
    )

    setReorderingChapters(true)
    const result = await reorderChaptersAction(
      selectedSubject.id,
      orderedIds.map((id, sortOrder) => ({
        id,
        sort_order: sortOrder,
      }))
    )

    if (result.status !== "SUCCESS") {
      setSubjects(previousSubjects)
      addToast(result.status === "ERROR" ? result.message : "Failed to reorder chapters.", "error")
      router.refresh()
    }

    setReorderingChapters(false)
  }

  function mapStructureToLocalState(
    structureSubjects: Array<{
      id: string
      name: string
      archived?: boolean
      topics: Array<{
        id: string
        name: string
        archived?: boolean
        subtopics: Array<{ id: string; name: string }>
        tasks: Array<{
          id: string
          topic_id: string | null
          subtopic_id: string | null
          title: string
          completed: boolean
          duration_minutes: number
        }>
      }>
    }>,
    topicMetaMap: Map<string, TopicMetaDraft>
  ) {
    const nextSubjects: SubjectNavItem[] = structureSubjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      archived: subject.archived ?? false,
      chapters: subject.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        archived: topic.archived ?? false,
        topics: topic.subtopics.map((subtopic) => ({
          id: subtopic.id,
          name: subtopic.name,
        })),
        earliestStart: topicMetaMap.get(topic.id)?.earliestStart ?? null,
        deadline: topicMetaMap.get(topic.id)?.deadline ?? null,
        restAfterDays: topicMetaMap.get(topic.id)?.restAfterDays ?? 0,
      })),
    }))

    const nextTasksByChapter: Record<string, TopicTaskItem[]> = {}
    for (const subject of structureSubjects) {
      for (const topic of subject.topics) {
        nextTasksByChapter[topic.id] = topic.tasks.map((task) => ({
          id: task.id,
          topicId: task.topic_id ?? topic.id,
          clusterId: task.subtopic_id,
          title: task.title,
          completed: task.completed,
          durationMinutes: normalizeDurationMinutes(task.duration_minutes),
        }))
      }
    }

    return { nextSubjects, nextTasksByChapter }
  }

  async function importStructureFromSubjects(onlyUndone: boolean) {
    if (onlyUndone) {
      setImportingUndone(true)
    } else {
      setImportingAll(true)
    }

    const [structureRes, paramsMap] = await Promise.all([
      getStructure({
        onlyUndoneTasks: onlyUndone,
        dropTopicsWithoutTasks: onlyUndone,
      }),
      loadTopicParamsSnapshot(false),
    ])

    if (structureRes.status !== "SUCCESS") {
      addToast("Please sign in to import from subjects.", "error")
      setImportingAll(false)
      setImportingUndone(false)
      return
    }

    const topicMetaMap = new Map<string, TopicMetaDraft>()
    for (const [topicId, param] of paramsMap.entries()) {
      topicMetaMap.set(topicId, {
        earliestStart: param.earliest_start,
        deadline: param.deadline,
        restAfterDays: Math.max(0, param.rest_after_days ?? 0),
      })
    }

    const { nextSubjects, nextTasksByChapter } = mapStructureToLocalState(
      structureRes.tree.subjects,
      topicMetaMap
    )

    setSubjects(nextSubjects)
    setTasksByChapter(nextTasksByChapter)
    setShowArchived(false)
    setSelectedTaskIds(new Set())
    setManageMode(false)

    if (nextSubjects.length > 0) {
      setSelectedSubjectId(nextSubjects[0].id)
      const firstChapter = nextSubjects[0].chapters[0]
      setSelectedChapterId(firstChapter?.id ?? null)
    } else {
      setSelectedSubjectId(null)
      setSelectedChapterId(null)
    }

    addToast(
      onlyUndone
        ? "Imported undone-only structure snapshot."
        : "Imported full structure snapshot.",
      "success"
    )

    setImportingAll(false)
    setImportingUndone(false)
  }

  async function handleResetIntakeView() {
    if (!window.confirm("Reset intake view to currently saved subjects, chapter metadata, and constraints?")) {
      return
    }

    setResettingIntake(true)
    await Promise.all([
      importStructureFromSubjects(false),
      loadStep2Snapshot(true),
      loadTopicParamsSnapshot(true),
    ])
    setResettingIntake(false)
  }

  async function openDependencyManager(scope: DependencyScope) {
    if (showArchived) return

    if (scope === "chapter" && !selectedChapter) {
      addToast("Select a chapter first.", "error")
      return
    }

    if (scope === "subject" && (!selectedSubject || selectedSubject.chapters.length === 0)) {
      addToast("Select a subject with at least one chapter.", "error")
      return
    }

    const targetId = scope === "chapter"
      ? selectedChapter?.id ?? ""
      : selectedSubject?.chapters[0]?.id ?? ""

    if (!targetId) {
      addToast("No chapter available for dependencies.", "error")
      return
    }

    setDependencyScope(scope)
    setDependencyTargetChapterId(targetId)
    setDependencySearch("")
    setDependencyModalOpen(true)

    setDependencyLoading(true)
    const map = await loadTopicParamsSnapshot(true)
    setDependencySelectedIds(new Set(map.get(targetId)?.depends_on ?? []))
    setDependencyLoading(false)
  }

  function toggleDependencySelection(chapterId: string) {
    setDependencySelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
      }
      return next
    })
  }

  async function handleSaveDependencies() {
    if (!dependencyTargetChapterId) {
      addToast("Select a chapter first.", "error")
      return
    }

    const chapter = chapterById.get(dependencyTargetChapterId)
    if (!chapter) {
      addToast("Selected chapter could not be found.", "error")
      return
    }

    const existing = topicParamsByTopic.get(dependencyTargetChapterId)
    const chapterTaskMinutes = (tasksByChapter[dependencyTargetChapterId] ?? []).reduce(
      (sum, task) => sum + Math.max(0, task.durationMinutes),
      0
    )
    const estimatedHours = existing?.estimated_hours
      ?? Math.max(0, Math.round((chapterTaskMinutes / 60) * 10) / 10)

    const dependsOn = Array.from(dependencySelectedIds)
      .filter((id) => id !== dependencyTargetChapterId)

    setDependencySaving(true)

    const result = await saveTopicParams([
      {
        topic_id: dependencyTargetChapterId,
        estimated_hours: estimatedHours,
        priority: 3,
        deadline: existing?.deadline ?? chapter.deadline ?? null,
        earliest_start: existing?.earliest_start ?? chapter.earliestStart ?? null,
        depends_on: dependsOn,
        session_length_minutes: existing?.session_length_minutes ?? 60,
        rest_after_days: existing?.rest_after_days ?? Math.max(0, chapter.restAfterDays ?? 0),
        max_sessions_per_day: existing?.max_sessions_per_day ?? 0,
        study_frequency: existing?.study_frequency ?? "daily",
      },
    ])

    if (result.status === "SUCCESS") {
      setTopicParamsByTopic((previous) => {
        const next = new Map(previous)
        next.set(dependencyTargetChapterId, {
          topic_id: dependencyTargetChapterId,
          estimated_hours: estimatedHours,
          deadline: existing?.deadline ?? chapter.deadline ?? null,
          earliest_start: existing?.earliest_start ?? chapter.earliestStart ?? null,
          depends_on: dependsOn,
          session_length_minutes: existing?.session_length_minutes ?? 60,
          rest_after_days: existing?.rest_after_days ?? Math.max(0, chapter.restAfterDays ?? 0),
          max_sessions_per_day: existing?.max_sessions_per_day ?? 0,
          study_frequency: existing?.study_frequency ?? "daily",
        })
        return next
      })

      addToast("Dependencies saved.", "success")
      setDependencyModalOpen(false)
    } else {
      addToast(result.status === "ERROR" ? result.message : "Failed to save dependencies.", "error")
    }

    setDependencySaving(false)
  }

  const customCapacityEntries = useMemo(
    () => Object.entries(constraintsDraft.custom_day_capacity).sort(([left], [right]) => left.localeCompare(right)),
    [constraintsDraft.custom_day_capacity]
  )

  const hasStep2DateError =
    !!constraintsDraft.study_start_date
    && !!constraintsDraft.exam_date
    && constraintsDraft.study_start_date >= constraintsDraft.exam_date

  const dependencyTargetOptions = useMemo(() => {
    if (dependencyScope === "chapter") {
      if (!selectedChapter) return []
      return [{
        id: selectedChapter.id,
        label: `${selectedSubject?.name ?? "Subject"} / ${selectedChapter.name}`,
      }]
    }

    if (!selectedSubject) return []
    return selectedSubject.chapters.map((chapter) => ({
      id: chapter.id,
      label: chapter.name,
    }))
  }, [dependencyScope, selectedChapter, selectedSubject])

  const dependencyCandidates = useMemo(() => {
    const query = dependencySearch.trim().toLowerCase()
    return allActiveChapters
      .filter((chapter) => chapter.id !== dependencyTargetChapterId)
      .filter((chapter) => {
        if (!query) return true
        const haystack = `${chapter.subjectName} ${chapter.name}`.toLowerCase()
        return haystack.includes(query)
      })
      .sort((left, right) => {
        const bySubject = left.subjectName.localeCompare(right.subjectName)
        if (bySubject !== 0) return bySubject
        return left.name.localeCompare(right.name)
      })
  }, [allActiveChapters, dependencySearch, dependencyTargetChapterId])

  return (
    <div
      className={`${embedded ? "" : "page-root "}fade-in max-w-none`}
      style={embedded ? undefined : { paddingTop: 12, paddingBottom: 16 }}
    >
      {showPageHeader && (
        <PageHeader
          title={pageHeaderTitle}
          eyebrow={pageHeaderEyebrow}
          subtitle={pageHeaderSubtitle}
        />
      )}

      {displaySubjects.length === 0 ? (
        <div className="empty-state">
          <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            {showArchived ? "No archived subjects." : "No subjects yet."}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--sh-text-muted)" }}>
            {showArchived
              ? "Archive a subject to see it in this view."
              : "Create your first subject to start building your structure."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {!showArchived && (
              <Button variant="primary" onClick={openCreateSubject}>
                Add first subject
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setShowArchived((value) => !value)}
              size="sm"
            >
              {showArchived ? "Show Active Subjects" : "Archived Subjects"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl border p-3 sm:p-4 overflow-hidden"
          style={{
            borderColor: "var(--sh-border)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            boxShadow: "var(--sh-shadow-sm)",
          }}
        >
          <p className="mb-3 text-xs font-medium sm:hidden" style={{ color: "var(--sh-text-muted)" }}>
            Swipe horizontally between Subjects, Chapters, and the overview panel.
          </p>

          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--sh-text-muted)" }}
          >
            Step-1
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void importStructureFromSubjects(false)
              }}
              disabled={importingAll || importingUndone || resettingIntake}
            >
              {importingAll ? "Importing..." : "Import All"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void importStructureFromSubjects(true)
              }}
              disabled={importingAll || importingUndone || resettingIntake}
            >
              {importingUndone ? "Importing..." : "Import Undone Only"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleResetIntakeView()
              }}
              disabled={resettingIntake || importingAll || importingUndone}
            >
              {resettingIntake ? "Resetting..." : "Reset Intake View"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void openDependencyManager("subject")
              }}
              disabled={showArchived || !selectedSubject || selectedSubject.chapters.length === 0}
            >
              Set Dependencies (Subject)
            </Button>
          </div>

          <div
            className="flex min-h-[520px] items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory"
            style={{
              height: "clamp(520px, calc(100dvh - var(--topbar-height) - 170px), 760px)",
            }}
          >
            <NavigationColumn
              title="Subjects"
              items={subjectColumnItems}
              activeId={selectedSubjectId}
              emptyMessage="No subjects available."
              onSelect={setSelectedSubjectId}
              reorderEnabled={!showArchived && !reorderingSubjects && !importingAll && !importingUndone}
              onReorder={(orderedIds) => {
                void handleReorderSubjects(orderedIds)
              }}
              footer={
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={openCreateSubject}
                    disabled={showArchived}
                  >
                    Add Subject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => setShowArchived((value) => !value)}
                  >
                    {showArchived
                      ? "Show Active Subjects"
                      : `Archived Subjects (${archivedSubjects.length})`}
                  </Button>
                </>
              }
            />

            <NavigationColumn
              title="Chapters"
              items={chapterColumnItems}
              activeId={selectedChapterId}
              emptyMessage="No chapters in this subject."
              onSelect={setSelectedChapterId}
              reorderEnabled={!showArchived && !!selectedSubject && !reorderingChapters}
              onReorder={(orderedIds) => {
                void handleReorderChapters(orderedIds)
              }}
              footer={
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={openCreateChapter}
                  disabled={!selectedSubject || showArchived}
                >
                  Add Chapter
                </Button>
              }
            />

            <section
              className="min-w-[340px] h-full flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start"
              style={{
                borderColor: "var(--sh-border)",
                background: "var(--sh-card)",
              }}
            >
              {selectedSubject && selectedChapter ? (
                <div className="flex h-full min-h-0 flex-col">
                  <nav
                    className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: "var(--sh-text-muted)" }}
                  >
                    <span>{selectedSubject.name}</span>
                    <span>{">"}</span>
                    <span>{selectedChapter.name}</span>
                    {clusterFilterValue !== ALL_CLUSTER_FILTER_VALUE && (
                      <>
                        <span>{">"}</span>
                        <span style={{ color: "var(--sh-text-secondary)" }}>{selectedDetailTitle}</span>
                      </>
                    )}
                  </nav>

                  <div className="mt-3 flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: "var(--sh-text-primary)" }}
                      >
                        {selectedDetailTitle}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor: "var(--sh-border)",
                            color: "var(--sh-text-secondary)",
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          {progressScopeLabel}
                        </span>
                        <span
                          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            borderColor: "var(--sh-border)",
                            color: "var(--sh-primary-light)",
                            background: "var(--sh-primary-muted)",
                          }}
                        >
                          {progressCompleted}/{progressTotal} completed
                        </span>
                      </div>
                    </div>

                    <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={openTaskComposer}
                        disabled={showArchived}
                      >
                        Add Task
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setManageMode((value) => !value)}
                        disabled={showArchived || chapterTasks.length === 0}
                      >
                        {manageMode ? "Done" : "Manage"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void openDependencyManager("chapter")
                        }}
                        disabled={showArchived || !selectedChapter}
                      >
                        Set Dependencies (Chapter)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectedChapter.archived ? handleUnarchiveChapter : handleArchiveChapter}
                        disabled={pendingChapterId === selectedChapter.id}
                      >
                        {selectedChapter.archived ? "Restore Chapter" : "Archive Chapter"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleArchiveSelected}
                        disabled={pendingSubjectId === selectedSubject.id}
                      >
                        {selectedSubject.archived ? "Restore Subject" : "Archive Subject"}
                      </Button>
                    </div>
                  </div>

                  <section
                    className={`mt-3 rounded-lg border p-2.5 ${sidebarExpanded ? "overflow-visible" : "overflow-hidden"}`}
                    style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                        Clusters
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={openCreateCluster}
                          disabled={showArchived}
                        >
                          New Cluster
                        </Button>

                        {chapterClusters.length > 0 && !showArchived && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setClusterManagerExpanded((value) => !value)}
                          >
                            {clusterManagerExpanded ? "Hide Manager" : "Manage Clusters"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                      <FilterChip
                        label={`All (${chapterTasks.length})`}
                        active={clusterFilterValue === ALL_CLUSTER_FILTER_VALUE}
                        compact={sidebarExpanded}
                        onClick={() => setClusterFilterValue(ALL_CLUSTER_FILTER_VALUE)}
                      />
                      <FilterChip
                        label={`Unclustered (${unclusteredTaskCount})`}
                        active={clusterFilterValue === UNCLUSTERED_FILTER_VALUE}
                        compact={sidebarExpanded}
                        onClick={() => setClusterFilterValue(UNCLUSTERED_FILTER_VALUE)}
                      />
                      {chapterClusters.map((cluster) => (
                        <FilterChip
                          key={cluster.id}
                          label={`${cluster.name} (${clusterTaskCounts.get(cluster.id) ?? 0})`}
                          active={clusterFilterValue === cluster.id}
                          compact={sidebarExpanded}
                          onClick={() => setClusterFilterValue(cluster.id)}
                        />
                      ))}
                    </div>

                    {clusterManagerExpanded && chapterClusters.length > 0 && !showArchived && (
                      <div className="mt-2 grid max-h-28 gap-1.5 overflow-y-auto pr-1">
                        {chapterClusters.map((cluster) => (
                          <div
                            key={`cluster-manage-${cluster.id}`}
                            className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
                            style={{ borderColor: "var(--sh-border)" }}
                          >
                            <p className="min-w-0 truncate text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                              {cluster.name} · {clusterTaskCounts.get(cluster.id) ?? 0} task
                              {(clusterTaskCounts.get(cluster.id) ?? 0) === 1 ? "" : "s"}
                            </p>
                            <div className="flex items-center gap-1">
                              <RowActionButton
                                label={`Edit cluster ${cluster.name}`}
                                onClick={() => openEditCluster(cluster.id, cluster.name)}
                              />
                              <RowActionButton
                                label={`Delete cluster ${cluster.name}`}
                                onClick={() => {
                                  void handleDeleteCluster(cluster.id, cluster.name)
                                }}
                                danger
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {manageMode && (
                    <section
                      className="mt-2 rounded-lg border p-2.5"
                      style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.015)" }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                          {selectedTaskIds.size} selected in current view
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleSelectVisibleTasks}
                            disabled={visibleTasks.length === 0}
                          >
                            {allVisibleSelected ? "Unselect Visible" : "Select Visible"}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTaskIds(new Set())}
                            disabled={selectedTaskIds.size === 0}
                          >
                            Clear
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              void handleDeleteSelectedTasks()
                            }}
                            disabled={selectedTaskIds.size === 0 || deletingSelectedTasks}
                          >
                            {deletingSelectedTasks ? "Deleting..." : "Delete Selected"}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={assignClusterValue}
                            onChange={(event) => setAssignClusterValue(event.target.value)}
                            className="ui-input h-9 min-w-[180px]"
                          >
                            <option value={NONE_CLUSTER_VALUE}>Unclustered</option>
                            {chapterClusters.map((cluster) => (
                              <option key={`assign-${cluster.id}`} value={cluster.id}>
                                {cluster.name}
                              </option>
                            ))}
                          </select>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              void handleAssignSelectedTasksToCluster()
                            }}
                            disabled={selectedTaskIds.size === 0 || assigningCluster}
                          >
                            {assigningCluster ? "Applying..." : "Apply Cluster"}
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                          <span className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                            Duration (min)
                          </span>
                          <input
                            type="number"
                            min={MIN_SESSION_LENGTH_MINUTES}
                            max={MAX_SESSION_LENGTH_MINUTES}
                            value={bulkDurationInput}
                            onChange={(event) => setBulkDurationInput(event.target.value)}
                            className="ui-input h-9 w-[110px]"
                            placeholder="Duration"
                          />

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void handleApplySelectedTaskDuration()
                            }}
                            disabled={selectedTaskIds.size === 0 || bulkDurationSaving}
                          >
                            {bulkDurationSaving ? "Applying..." : "Apply Duration"}
                          </Button>
                        </div>
                      </div>
                    </section>
                  )}

                  <section
                    className="mt-3 min-h-0 flex-1 rounded-lg border p-2"
                    style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.01)" }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                        Tasks Overview
                      </p>
                      <div className="text-right">
                        <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                          Showing {visibleTasks.length} task{visibleTasks.length === 1 ? "" : "s"}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                          {progressCompleted}/{progressTotal} completed
                        </p>
                      </div>
                    </div>

                    <div className="h-full min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-2">
                      {visibleTasks.length === 0 && (
                        <div
                          className="rounded-lg border border-dashed px-4 py-6 text-center text-sm"
                          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                        >
                          No tasks in this view yet.
                        </div>
                      )}

                      {visibleTasks.length > 0 && !manageMode && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleTasksDragEnd}
                        >
                          <SortableContext
                            items={visibleTasks.map((task) => task.id)}
                            strategy={rectSortingStrategy}
                          >
                            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                              {visibleTasks.map((task) => (
                                <DraggableTaskRow
                                  key={task.id}
                                  task={task}
                                  isPending={pendingTaskIds.has(task.id)}
                                  isDurationSaving={taskDurationSavingIds.has(task.id)}
                                  isReordering={reorderingTaskIds.includes(task.id)}
                                  clusterName={task.clusterId ? clusterNameById.get(task.clusterId) ?? null : null}
                                  showClusterBadge={clusterFilterValue === ALL_CLUSTER_FILTER_VALUE}
                                  showFullTitle={sidebarExpanded}
                                  canEdit={!showArchived}
                                  durationDraft={taskDurationDrafts[task.id] ?? String(task.durationMinutes)}
                                  onToggle={(nextCompleted) => handleToggleTask(task.id, nextCompleted)}
                                  onDurationDraftChange={(value) => setTaskDurationDraft(task.id, value)}
                                  onDurationSave={() => {
                                    void handleSaveTaskDuration(task.id)
                                  }}
                                  onEdit={() => openEditTask(task.id, task.title)}
                                  onDelete={() => void handleDeleteTask(task.id, task.title)}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}

                      {visibleTasks.length > 0 && manageMode && (
                        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                          {visibleTasks.map((task) => {
                            const isPending = pendingTaskIds.has(task.id)
                            const isDurationSaving = taskDurationSavingIds.has(task.id)
                            const clusterName = task.clusterId ? clusterNameById.get(task.clusterId) ?? null : null

                            return (
                              <div
                                key={task.id}
                                className="group rounded-lg border px-2.5 py-1.5 transition-colors"
                                style={{
                                  borderColor: "var(--sh-border)",
                                  background: task.completed
                                    ? "rgba(52, 211, 153, 0.08)"
                                    : "rgba(255, 255, 255, 0.02)",
                                }}
                              >
                                <div className="flex items-start gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedTaskIds.has(task.id)}
                                    onChange={() => toggleTaskSelection(task.id)}
                                    className="h-4 w-4 rounded border"
                                    aria-label="Select task"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleToggleTask(task.id, !task.completed)}
                                    disabled={isPending || showArchived}
                                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50"
                                    style={{
                                      borderColor: task.completed
                                        ? "var(--sh-success)"
                                        : "var(--sh-border)",
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

                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-[13px] font-medium ${task.completed ? "line-through opacity-60" : ""} ${sidebarExpanded ? "whitespace-normal break-words leading-[1.25]" : "truncate"}`}
                                      style={{ color: "var(--sh-text-primary)" }}
                                      title={task.title}
                                    >
                                      {task.title}
                                    </p>

                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      {clusterFilterValue === ALL_CLUSTER_FILTER_VALUE && (
                                        <span
                                          className="max-w-[120px] truncate rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                          style={{
                                            color: "var(--sh-text-secondary)",
                                            background: "rgba(255,255,255,0.06)",
                                          }}
                                          title={clusterName ?? "Unclustered"}
                                        >
                                          {clusterName ?? "Unclustered"}
                                        </span>
                                      )}

                                      <span className="text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
                                        Duration
                                      </span>

                                      <input
                                        type="number"
                                        min={MIN_SESSION_LENGTH_MINUTES}
                                        max={MAX_SESSION_LENGTH_MINUTES}
                                        value={taskDurationDrafts[task.id] ?? String(task.durationMinutes)}
                                        onChange={(event) => setTaskDurationDraft(task.id, event.target.value)}
                                        onBlur={() => {
                                          void handleSaveTaskDuration(task.id)
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.preventDefault()
                                            void handleSaveTaskDuration(task.id)
                                          }
                                        }}
                                        disabled={isDurationSaving || showArchived}
                                        className="ui-input h-7 w-[80px] text-xs"
                                        title="Task duration (minutes)"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                    <RowActionButton
                                      label="Edit task title"
                                      onClick={() => openEditTask(task.id, task.title)}
                                      disabled={isPending || isDurationSaving || showArchived}
                                    />
                                    <RowActionButton
                                      label="Delete task"
                                      onClick={() => {
                                        void handleDeleteTask(task.id, task.title)
                                      }}
                                      danger
                                      disabled={isPending || isDurationSaving || showArchived}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div
                  className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed text-sm"
                  style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                >
                  Select a subject and chapter to view details.
                </div>
              )}
            </section>
          </div>

          <p
            className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--sh-text-muted)" }}
          >
            Step-2
          </p>

          <div
            className="flex min-h-[520px] items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory"
            style={{
              height: "clamp(520px, calc(100dvh - var(--topbar-height) - 170px), 760px)",
            }}
          >
            <section
              className="min-w-[320px] h-full flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start flex flex-col"
              style={{
                borderColor: "var(--sh-border)",
                background: "var(--sh-card)",
              }}
            >
              <div className="pb-2">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--sh-text-muted)" }}
                >
                  Block-1
                </p>
              </div>
              {constraintsLoading ? (
                <div
                  className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm"
                  style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                >
                  Loading constraints...
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="date"
                      label="Study Start"
                      value={constraintsDraft.study_start_date}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          study_start_date: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      label="Exam Date"
                      value={constraintsDraft.exam_date}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          exam_date: event.target.value,
                        }))
                      }
                    />

                    <Input
                      type="number"
                      min={0}
                      label="Weekday Capacity (min)"
                      value={String(constraintsDraft.weekday_capacity_minutes)}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          weekday_capacity_minutes: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      label="Weekend Capacity (min)"
                      value={String(constraintsDraft.weekend_capacity_minutes)}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          weekend_capacity_minutes: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                        }))
                      }
                    />
                  </div>

                  {hasStep2DateError && (
                    <p className="text-xs text-red-400/90">
                      Exam date must be after study start date.
                    </p>
                  )}

                  <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                      Day-of-Week Capacity Overrides
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--sh-text-secondary)" }}>
                      Leave blank to use weekday/weekend defaults.
                    </p>
                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                      {WEEKDAY_LABELS.map((label, index) => (
                        <div key={label} className="space-y-1">
                          <p className="text-[10px] text-center" style={{ color: "var(--sh-text-muted)" }}>
                            {label}
                          </p>
                          <input
                            type="number"
                            min={0}
                            value={constraintsDraft.day_of_week_capacity[index] ?? ""}
                            onChange={(event) => updateDayOfWeekCapacity(index, event.target.value)}
                            className="ui-input h-8 px-1 text-center text-xs"
                            placeholder="-"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                      Custom Date Capacity
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <Input
                        type="date"
                        label="Date"
                        value={customCapacityDateInput}
                        onChange={(event) => setCustomCapacityDateInput(event.target.value)}
                        className="w-[170px]"
                      />
                      <Input
                        type="number"
                        min={0}
                        label="Minutes"
                        value={customCapacityMinutesInput}
                        onChange={(event) => setCustomCapacityMinutesInput(event.target.value)}
                        className="w-[120px]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddCustomCapacityDate}
                      >
                        Add Override
                      </Button>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {customCapacityEntries.length === 0 && (
                        <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
                          No custom date overrides yet.
                        </p>
                      )}

                      {customCapacityEntries.map(([date, minutes]) => (
                        <div
                          key={date}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                          style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.01)" }}
                        >
                          <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                            {date} - {minutes} min
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveCustomCapacityDate(date)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                      Off Days
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <Input
                        type="date"
                        label="Date"
                        value={offDayDateInput}
                        onChange={(event) => setOffDayDateInput(event.target.value)}
                        className="w-[170px]"
                      />
                      <Input
                        label="Reason"
                        value={offDayReasonInput}
                        onChange={(event) => setOffDayReasonInput(event.target.value)}
                        placeholder="Optional"
                        className="w-[180px]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void handleAddOffDay()
                        }}
                        disabled={offDaySaving}
                      >
                        {offDaySaving ? "Adding..." : "Add Off Day"}
                      </Button>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {offDaysLoading && (
                        <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
                          Loading off-days...
                        </p>
                      )}

                      {!offDaysLoading && offDays.length === 0 && (
                        <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
                          No off-days added.
                        </p>
                      )}

                      {offDays.map((offDay) => (
                        <div
                          key={offDay.id}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                          style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.01)" }}
                        >
                          <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                            {offDay.date}
                            {offDay.reason ? ` - ${offDay.reason}` : ""}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void handleDeleteOffDay(offDay)
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section
              className="min-w-[320px] h-full flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start flex flex-col"
              style={{
                borderColor: "var(--sh-border)",
                background: "var(--sh-card)",
              }}
            >
              <div className="pb-2">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--sh-text-muted)" }}
                >
                  Block-2
                </p>
              </div>
              {constraintsLoading ? (
                <div
                  className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm"
                  style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                >
                  Loading controls...
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
                  <div className="space-y-3">
                    <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                      Fine-tune scheduling flexibility and hard caps used in plan generation.
                    </p>

                    <Input
                      type="number"
                      min={0}
                      max={120}
                      label="Flexibility Minutes"
                      value={String(constraintsDraft.flexibility_minutes)}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          flexibility_minutes: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                        }))
                      }
                    />

                    <Input
                      type="number"
                      min={30}
                      max={720}
                      label="Max Daily Minutes"
                      value={String(constraintsDraft.max_daily_minutes)}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          max_daily_minutes: clampInteger(Number.parseInt(event.target.value || "480", 10) || 480, 30, 720),
                        }))
                      }
                    />

                    <Input
                      type="number"
                      min={0}
                      max={12}
                      label="Max Active Subjects / Day"
                      value={String(constraintsDraft.max_active_subjects)}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          max_active_subjects: Math.max(0, Number.parseInt(event.target.value || "0", 10) || 0),
                        }))
                      }
                      hint="Use 0 for no hard cap."
                    />
                  </div>

                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                      Save Step-2 constraints before generating Phase-2 preview.
                    </p>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          void handleSaveConstraints()
                        }}
                        disabled={constraintsSaving || hasStep2DateError}
                      >
                        {constraintsSaving ? "Saving..." : "Save Step-2 Constraints"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <SubjectDrawer
        open={drawerOpen}
        mode={drawerMode}
        subjectId={selectedSubjectIdForDrawer}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false)
          router.refresh()
        }}
      />

      <Modal
        open={chapterDialog.open}
        onClose={() => setChapterDialog(CLOSED_DIALOG_STATE)}
        title={chapterDialog.mode === "create" ? "Add Chapter" : "Edit Chapter"}
        size="md"
      >
        <form id="chapter-form" className="space-y-4" onSubmit={handleSaveChapter}>
          <Input
            autoFocus
            required
            label="Chapter Name"
            value={chapterDialog.value}
            onChange={(event) =>
              setChapterDialog((previous) => ({
                ...previous,
                value: event.target.value,
              }))
            }
            placeholder="e.g. Limits and Continuity"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              label="Start Date"
              value={chapterDialog.earliestStart ?? ""}
              onChange={(event) =>
                setChapterDialog((previous) => ({
                  ...previous,
                  earliestStart: event.target.value,
                }))
              }
            />
            <Input
              type="date"
              label="Deadline"
              value={chapterDialog.deadline ?? ""}
              onChange={(event) =>
                setChapterDialog((previous) => ({
                  ...previous,
                  deadline: event.target.value,
                }))
              }
            />
          </div>

          <Input
            type="number"
            min={0}
            label="Rest After Days"
            value={chapterDialog.restAfterDays ?? "0"}
            onChange={(event) =>
              setChapterDialog((previous) => ({
                ...previous,
                restAfterDays: event.target.value,
              }))
            }
          />

          {chapterDialog.mode === "edit" && chapterDialog.targetId && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: "rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.08)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Danger Zone</p>
              <p className="mt-1 text-xs text-red-200/80">
                Delete chapter and detach related tasks from this chapter.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const targetId = chapterDialog.targetId
                  if (!targetId) return
                  const targetName = chapterDialog.value.trim() || "Untitled chapter"
                  setChapterDialog(CLOSED_DIALOG_STATE)
                  void handleDeleteChapter(targetId, targetName)
                }}
                disabled={chapterDialogSaving}
              >
                Delete Chapter
              </Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChapterDialog(CLOSED_DIALOG_STATE)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={chapterDialogSaving}>
              {chapterDialogSaving
                ? "Saving..."
                : chapterDialog.mode === "create"
                  ? "Add Chapter"
                  : "Save Chapter"}
            </Button>
          </div>
        </form>
      </Modal>

      <NameModal
        open={clusterDialog.open}
        title={clusterDialog.mode === "create" ? "Add Cluster" : "Edit Cluster"}
        fieldLabel="Cluster Name"
        value={clusterDialog.value}
        placeholder="e.g. Lecture Set A"
        submitLabel={clusterDialog.mode === "create" ? "Add Cluster" : "Save Cluster"}
        loading={clusterDialogSaving}
        onChange={(value) => setClusterDialog((previous) => ({ ...previous, value }))}
        onClose={() => setClusterDialog(CLOSED_DIALOG_STATE)}
        onSubmit={handleSaveCluster}
      />

      <NameModal
        open={taskDialog.open}
        title="Edit Task"
        fieldLabel="Task Title"
        value={taskDialog.value}
        placeholder="e.g. Solve past-paper set 1"
        submitLabel="Save Task"
        loading={taskDialogSaving}
        onChange={(value) => setTaskDialog((previous) => ({ ...previous, value }))}
        onClose={() => setTaskDialog(CLOSED_DIALOG_STATE)}
        onSubmit={handleSaveTaskTitle}
      />

      <Modal
        open={dependencyModalOpen}
        onClose={() => {
          if (dependencySaving) return
          setDependencyModalOpen(false)
        }}
        title={dependencyScope === "subject" ? "Set Dependencies (Subject)" : "Set Dependencies (Chapter)"}
        size="md"
      >
        <div className="space-y-4">
          {dependencyScope === "subject" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                Target Chapter
              </label>
              <select
                value={dependencyTargetChapterId}
                onChange={(event) => setDependencyTargetChapterId(event.target.value)}
                className="ui-input"
                disabled={dependencyLoading || dependencySaving}
              >
                {dependencyTargetOptions.map((option) => (
                  <option key={`dependency-target-${option.id}`} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : dependencyTargetOptions[0] ? (
            <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
              Target: {dependencyTargetOptions[0].label}
            </p>
          ) : null}

          <Input
            label="Search Chapters"
            value={dependencySearch}
            onChange={(event) => setDependencySearch(event.target.value)}
            placeholder="Filter by subject or chapter"
          />

          <div
            className="max-h-[280px] space-y-1.5 overflow-y-auto rounded-lg border p-2"
            style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
          >
            {dependencyLoading ? (
              <p className="px-1 py-2 text-xs" style={{ color: "var(--sh-text-muted)" }}>
                Loading chapter parameters...
              </p>
            ) : dependencyCandidates.length === 0 ? (
              <p className="px-1 py-2 text-xs" style={{ color: "var(--sh-text-muted)" }}>
                No candidate chapters found.
              </p>
            ) : (
              dependencyCandidates.map((candidate) => {
                const selected = dependencySelectedIds.has(candidate.id)

                return (
                  <button
                    key={`dependency-candidate-${candidate.id}`}
                    type="button"
                    onClick={() => toggleDependencySelection(candidate.id)}
                    className="w-full rounded-md border px-2 py-1.5 text-left transition-colors"
                    style={{
                      borderColor: selected ? "var(--sh-primary-glow)" : "var(--sh-border)",
                      background: selected ? "var(--sh-primary-muted)" : "transparent",
                    }}
                    disabled={dependencySaving}
                  >
                    <p
                      className="text-sm font-semibold"
                      style={{ color: selected ? "var(--sh-primary-light)" : "var(--sh-text-primary)" }}
                    >
                      {candidate.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                      {candidate.subjectName}
                    </p>
                  </button>
                )
              })
            )}
          </div>

          <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
            Selected prerequisites: {dependencySelectedIds.size}
          </p>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDependencySelectedIds(new Set())}
              disabled={dependencySaving || dependencySelectedIds.size === 0}
            >
              Clear
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDependencyModalOpen(false)}
                disabled={dependencySaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  void handleSaveDependencies()
                }}
                disabled={dependencySaving || dependencyLoading || !dependencyTargetChapterId}
              >
                {dependencySaving ? "Saving..." : "Save Dependencies"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={taskComposerOpen}
        onClose={() => {
          setTaskComposerOpen(false)
          resetTaskComposerFields()
        }}
        title="Add Tasks"
        size="md"
      >
        <form className="space-y-4" onSubmit={handleCreateTasks}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTaskCreateMode("single")}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                borderColor:
                  taskCreateMode === "single" ? "var(--sh-primary-glow)" : "var(--sh-border)",
                color:
                  taskCreateMode === "single" ? "var(--sh-primary-light)" : "var(--sh-text-secondary)",
                background:
                  taskCreateMode === "single" ? "var(--sh-primary-muted)" : "transparent",
              }}
            >
              Single Task
            </button>

            <button
              type="button"
              onClick={() => setTaskCreateMode("bulk")}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                borderColor:
                  taskCreateMode === "bulk" ? "var(--sh-primary-glow)" : "var(--sh-border)",
                color:
                  taskCreateMode === "bulk" ? "var(--sh-primary-light)" : "var(--sh-text-secondary)",
                background:
                  taskCreateMode === "bulk" ? "var(--sh-primary-muted)" : "transparent",
              }}
            >
              Bulk Series
            </button>
          </div>

          {taskCreateMode === "single" ? (
            <Input
              required
              label="Task Title"
              value={singleTaskTitle}
              onChange={(event) => setSingleTaskTitle(event.target.value)}
              placeholder="e.g. Lecture review"
            />
          ) : (
            <div className="space-y-3">
              <Input
                required
                label="Base Name"
                value={bulkBaseName}
                onChange={(event) => setBulkBaseName(event.target.value)}
                placeholder="e.g. Lecture"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  required
                  label="Count"
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(event) => setBulkCount(event.target.value)}
                />
                <Input
                  required
                  label="Start Number"
                  type="number"
                  min={1}
                  max={10000}
                  value={bulkStartAt}
                  onChange={(event) => setBulkStartAt(event.target.value)}
                />
                <Input
                  required
                  label="Number Padding"
                  type="number"
                  min={0}
                  max={6}
                  value={bulkNumberPadding}
                  onChange={(event) => setBulkNumberPadding(event.target.value)}
                  hint="Adds leading zeros: 0 → Lecture-1, 1 → Lecture-01, 2 → Lecture-001"
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                    Number Placement
                  </label>
                  <select
                    value={bulkPlacement}
                    onChange={(event) =>
                      setBulkPlacement(event.target.value === "prefix" ? "prefix" : "suffix")
                    }
                    className="ui-input"
                  >
                    <option value="suffix">Lecture-1</option>
                    <option value="prefix">1-Lecture</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                    Separator (what goes between name and number)
                  </label>
                  <select
                    value={bulkSeparator}
                    onChange={(event) => setBulkSeparator(event.target.value)}
                    className="ui-input"
                  >
                    <option value="-">Hyphen: Lecture-1</option>
                    <option value=" ">Space: Lecture 1</option>
                    <option value="_">Underscore: Lecture_1</option>
                    <option value="">None: Lecture1</option>
                    <option value="·">Dot: Lecture·1</option>
                  </select>
                </div>
              </div>

              {bulkPreview.length > 0 && (
                <div
                  className="rounded-md border p-2.5"
                  style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.015)" }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                    Preview
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                    {bulkPreview.join("  |  ")}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
              Cluster
            </label>
            <select
              value={composerClusterValue}
              onChange={(event) => setComposerClusterValue(event.target.value)}
              className="ui-input"
            >
              <option value={NONE_CLUSTER_VALUE}>Unclustered</option>
              {chapterClusters.map((cluster) => (
                <option key={`composer-${cluster.id}`} value={cluster.id}>
                  {cluster.name}
                </option>
              ))}
              <option value={NEW_CLUSTER_VALUE}>Create new cluster...</option>
            </select>

            {composerClusterValue === NEW_CLUSTER_VALUE && (
              <Input
                required
                label="New Cluster Name"
                value={composerNewClusterName}
                onChange={(event) => setComposerNewClusterName(event.target.value)}
                placeholder="e.g. Lecture Set A"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTaskComposerOpen(false)
                resetTaskComposerFields()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={taskComposerSaving}>
              {taskComposerSaving
                ? "Saving..."
                : taskCreateMode === "single"
                  ? "Add Task"
                  : "Create Series"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

interface DraggableTaskRowProps {
  task: TopicTaskItem
  isPending: boolean
  isDurationSaving: boolean
  isReordering: boolean
  clusterName: string | null
  showClusterBadge: boolean
  showFullTitle: boolean
  canEdit: boolean
  durationDraft: string
  onToggle: (completed: boolean) => void
  onDurationDraftChange: (value: string) => void
  onDurationSave: () => void
  onEdit: () => void
  onDelete: () => void
}

function DraggableTaskRow({
  task,
  isPending,
  isDurationSaving,
  isReordering,
  clusterName,
  showClusterBadge,
  showFullTitle,
  canEdit,
  durationDraft,
  onToggle,
  onDurationDraftChange,
  onDurationSave,
  onEdit,
  onDelete,
}: DraggableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging || isReordering ? 0.7 : 1,
        borderColor: isDragging ? "var(--sh-primary-glow)" : "var(--sh-border)",
        background: task.completed
          ? "rgba(52, 211, 153, 0.08)"
          : isDragging
            ? "rgba(124, 108, 255, 0.1)"
            : "rgba(255, 255, 255, 0.02)",
        cursor: isDragging ? "grabbing" : "default",
      }}
      className="group rounded-lg border px-2.5 py-2 transition-colors"
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs transition-colors hover:bg-white/5 disabled:opacity-50"
          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)", touchAction: "none" }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M2 5h7v1H2V5zm0 3h7v1H2V8zm0 3h7v1H2v-1z" />
            <path d="M10 5h4v1h-4V5zm0 3h4v1h-4V8zm0 3h4v1h-4v-1z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onToggle(!task.completed)}
          disabled={isPending || !canEdit}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50"
          style={{
            borderColor: task.completed
              ? "var(--sh-success)"
              : "var(--sh-border)",
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

        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] font-medium ${task.completed ? "line-through opacity-60" : ""} ${showFullTitle ? "whitespace-normal break-words leading-[1.25]" : "truncate"}`}
            style={{ color: "var(--sh-text-primary)" }}
            title={task.title}
          >
            {task.title}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {showClusterBadge && (
              <span
                className="max-w-[120px] truncate rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  color: "var(--sh-text-secondary)",
                  background: "rgba(255,255,255,0.06)",
                }}
                title={clusterName ?? "Unclustered"}
              >
                {clusterName ?? "Unclustered"}
              </span>
            )}

            <span className="text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
              Duration
            </span>

            <input
              type="number"
              min={MIN_SESSION_LENGTH_MINUTES}
              max={MAX_SESSION_LENGTH_MINUTES}
              value={durationDraft}
              onChange={(event) => onDurationDraftChange(event.target.value)}
              onBlur={onDurationSave}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  onDurationSave()
                }
              }}
              disabled={isDurationSaving || !canEdit}
              className="ui-input h-7 w-[80px] text-xs"
              title="Task duration (minutes)"
            />

            {isDurationSaving && (
              <span className="text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
                Saving...
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <RowActionButton
            label="Edit task title"
            onClick={onEdit}
            disabled={isPending || isDurationSaving || !canEdit}
          />
          <RowActionButton
            label="Delete task"
            onClick={onDelete}
            danger
            disabled={isPending || isDurationSaving || !canEdit}
          />
        </div>
      </div>
    </div>
  )
}

interface NavigationColumnProps {
  title: string
  items: ColumnItem[]
  activeId: string | null
  emptyMessage: string
  onSelect: (id: string) => void
  reorderEnabled?: boolean
  onReorder?: (orderedIds: string[]) => void
  footer?: ReactNode
}

function NavigationColumn({
  title,
  items,
  activeId,
  emptyMessage,
  onSelect,
  reorderEnabled = false,
  onReorder,
  footer,
}: NavigationColumnProps) {
  const canReorder = reorderEnabled && Boolean(onReorder) && items.length > 1
  const itemIds = useMemo(() => items.map((item) => item.id), [items])

  const localSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleColumnDragEnd(event: DragEndEvent) {
    if (!canReorder || !onReorder) return

    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const oldIndex = itemIds.indexOf(activeId)
    const newIndex = itemIds.indexOf(overId)
    if (oldIndex === -1 || newIndex === -1) return

    onReorder(arrayMove(itemIds, oldIndex, newIndex))
  }

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

        {canReorder ? (
          <DndContext
            sensors={localSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <DraggableNavigationItem
                    key={item.id}
                    item={item}
                    isActive={item.id === activeId}
                    onSelect={onSelect}
                    reorderEnabled={canReorder}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          items.map((item) => (
            <NavigationItemCard
              key={item.id}
              item={item}
              isActive={item.id === activeId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {footer && (
        <div
          className="mt-2 space-y-1.5 border-t px-1 pt-2"
          style={{ borderColor: "var(--sh-border)" }}
        >
          {footer}
        </div>
      )}
    </section>
  )
}

interface NavigationItemCardProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  dragHandle?: ReactNode
  isDragging?: boolean
}

function NavigationItemCard({
  item,
  isActive,
  onSelect,
  dragHandle,
  isDragging = false,
}: NavigationItemCardProps) {
  return (
    <div
      className="rounded-lg border p-1.5 transition-colors"
      style={{
        borderColor: isDragging
          ? "var(--sh-primary-glow)"
          : isActive
            ? "var(--sh-primary-glow)"
            : "transparent",
        background: isDragging
          ? "rgba(124,108,255,0.16)"
          : isActive
            ? "var(--sh-primary-muted)"
            : "transparent",
        opacity: isDragging ? 0.88 : 1,
      }}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[rgba(124,108,255,0.08)]"
        >
          <p
            className="truncate text-sm font-semibold"
            style={{
              color: isActive ? "var(--sh-primary-light)" : "var(--sh-text-primary)",
            }}
          >
            {item.label}
          </p>
          {item.hint && (
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
              {item.hint}
            </p>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1 pt-1">
          {dragHandle}
          {item.onEdit && (
            <RowActionButton
              label={`Edit ${item.label}`}
              onClick={item.onEdit}
            />
          )}
          {item.onDelete && (
            <RowActionButton
              label={`Delete ${item.label}`}
              onClick={item.onDelete}
              danger
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface DraggableNavigationItemProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  reorderEnabled: boolean
}

function DraggableNavigationItem({
  item,
  isActive,
  onSelect,
  reorderEnabled,
}: DraggableNavigationItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !reorderEnabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <NavigationItemCard
        item={item}
        isActive={isActive}
        onSelect={onSelect}
        isDragging={isDragging}
        dragHandle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded border p-0.5 transition-colors hover:bg-white/5 disabled:opacity-50"
            style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)", touchAction: "none" }}
            aria-label={`Reorder ${item.label}`}
            title={`Reorder ${item.label}`}
            disabled={!reorderEnabled}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M2 5h12v1H2V5zm0 3h12v1H2V8zm0 3h12v1H2v-1z" />
            </svg>
          </button>
        }
      />
    </div>
  )
}

interface NameModalProps {
  open: boolean
  title: string
  fieldLabel: string
  value: string
  placeholder: string
  submitLabel: string
  loading: boolean
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function NameModal({
  open,
  title,
  fieldLabel,
  value,
  placeholder,
  submitLabel,
  loading,
  onChange,
  onClose,
  onSubmit,
}: NameModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          autoFocus
          required
          label={fieldLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface FilterChipProps {
  label: string
  active: boolean
  compact?: boolean
  onClick: () => void
}

function FilterChip({ label, active, compact = false, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition-colors ${compact ? "px-2 py-0.5 text-[10px] leading-tight" : "px-2 py-1 text-[11px]"}`}
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

interface RowActionButtonProps {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

function RowActionButton({ label, onClick, danger = false, disabled = false }: RowActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border p-1 transition-colors hover:bg-white/5 disabled:opacity-50"
      style={{ borderColor: "var(--sh-border)", color: danger ? "#f87171" : "var(--sh-text-muted)" }}
      aria-label={label}
      title={label}
    >
      {danger ? (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
