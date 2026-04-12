"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  getPlanConfig,
  getIntakeImportMode,
  getStructure,
  getTopicParams,
  saveIntakeImportMode,
  savePlanConfig,
  saveTopicParams,
  type IntakeImportMode,
} from "@/app/actions/planner/setup"
import {
  addChapter,
  archiveChapter,
  deleteChapter,
  getArchivedChapters,
  type ArchivedChapterListItem,
  unarchiveChapter,
  updateChapter,
} from "@/app/actions/subjects/chapters"
import {
  bulkUpdateSubjectTaskDuration,
  bulkCreateSubjectTasks,
  createSubjectTask,
  deleteSubjectTasks,
  deleteSubjectTask,
  reorderTasks,
  updateSubjectTaskDuration,
  updateSubjectTaskTitle,
} from "@/app/actions/subjects/tasks"
import { setSubjectTaskCompletion } from "@/app/actions/subjects/setSubjectTaskCompletion"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
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
  inferSessionLengthMinutes,
} from "@/lib/planner/draft"
import {
  buildMonthGrid,
  clampInteger,
  compareTasksNaturally,
  composeSeriesName,
  defaultIntakeConstraints,
  formatMonthLabel,
  isLikelyNetworkError,
  normalizeDayOfWeekCapacity,
  normalizeDurationMinutes,
  shiftMonthCursor,
  shouldAutoOrderTasks,
  toMonthCursor,
} from "./subjects-data-table.helpers"

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
  max_active_subjects: number
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
  initialImportMode: IntakeImportMode
  embedded?: boolean
  showPageHeader?: boolean
  pageHeaderTitle?: string
  pageHeaderEyebrow?: string
  pageHeaderSubtitle?: string
  onSelectedTaskIdsChange?: (taskIds: string[]) => void
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

const BULK_SERIES_DEFAULTS = {
  startAt: 1,
  numberPadding: 0,
  separator: "-",
  placement: "suffix" as const,
}

export function SubjectsDataTable({
  initialSubjects,
  initialTasksByChapter,
  initialImportMode,
  embedded = false,
  showPageHeader = true,
  pageHeaderTitle = "Subjects",
  pageHeaderEyebrow,
  pageHeaderSubtitle,
  onSelectedTaskIdsChange,
}: Props) {
  const { addToast } = useToast()
  const { collapsed } = useSidebar()
  const sidebarExpanded = !collapsed
  const [subjects, setSubjects] = useState<SubjectNavItem[]>(initialSubjects)
  const [tasksByChapter, setTasksByChapter] =
    useState<Record<string, TopicTaskItem[]>>(initialTasksByChapter)
  const [showArchived, setShowArchived] = useState(false)
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set())

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [selectedSubjectIdForDrawer, setSelectedSubjectIdForDrawer] = useState<string | null>(null)

  const [chapterDialog, setChapterDialog] = useState<NameDialogState>(CLOSED_DIALOG_STATE)
  const [chapterDialogSaving, setChapterDialogSaving] = useState(false)
  const [chapterArchiveSaving, setChapterArchiveSaving] = useState(false)

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

  const [isManageOpen, setIsManageOpen] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [deletingSelectedTasks, setDeletingSelectedTasks] = useState(false)

  const [archivedChapterModalOpen, setArchivedChapterModalOpen] = useState(false)
  const [archivedChapterRows, setArchivedChapterRows] = useState<ArchivedChapterListItem[]>([])
  const [archivedChapterLoading, setArchivedChapterLoading] = useState(false)
  const [archivedChapterPendingId, setArchivedChapterPendingId] = useState<string | null>(null)

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [manualOrderChapterIds, setManualOrderChapterIds] = useState<Set<string>>(new Set())
  const [reorderingTaskIds, setReorderingTaskIds] = useState<string[]>([])
  const [reorderingSubjects, setReorderingSubjects] = useState(false)
  const [reorderingChapters, setReorderingChapters] = useState(false)

  const [importingAll, setImportingAll] = useState(false)
  const [importingUndone, setImportingUndone] = useState(false)
  const [resettingIntake, setResettingIntake] = useState(false)
  const [intakeImportMode, setIntakeImportMode] = useState<IntakeImportMode>(initialImportMode)

  const [dependencyModalOpen, setDependencyModalOpen] = useState(false)
  const [dependencyScope, setDependencyScope] = useState<DependencyScope>("chapter")
  const [dependencyTargetChapterId, setDependencyTargetChapterId] = useState("")
  const [dependencySelectedIds, setDependencySelectedIds] = useState<Set<string>>(new Set())
  const [dependencySearch, setDependencySearch] = useState("")
  const [dependencyLoading, setDependencyLoading] = useState(false)
  const [dependencySaving, setDependencySaving] = useState(false)
  const [topicParamsByTopic, setTopicParamsByTopic] = useState<Map<string, TopicParamDraft>>(new Map())
  const [subjectSnapshotForDrawer, setSubjectSnapshotForDrawer] = useState<{
    name: string
    startDate: string
    deadline: string
    restAfterDays: string
  } | null>(null)

  const [constraintsDraft, setConstraintsDraft] = useState<IntakeConstraintsDraft>(
    defaultIntakeConstraints()
  )
  const [constraintsLoading, setConstraintsLoading] = useState(true)
  const [constraintsSaving, setConstraintsSaving] = useState(false)

  const [customCapacityMinutesInput, setCustomCapacityMinutesInput] = useState("")
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => toMonthCursor(new Date()))
  const [selectedCustomDates, setSelectedCustomDates] = useState<Set<string>>(new Set())

  const mutationLockRef = useRef(false)
  const [isMutating, setIsMutating] = useState(false)

  const beginMutation = useCallback(() => {
    if (mutationLockRef.current) return false
    mutationLockRef.current = true
    setIsMutating(true)
    return true
  }, [])

  const endMutation = useCallback(() => {
    mutationLockRef.current = false
    setIsMutating(false)
  }, [])

  const showMutationError = useCallback((error: unknown, fallbackMessage: string) => {
    addToast(
      isLikelyNetworkError(error)
        ? "Network issue. Check connection."
        : fallbackMessage,
      "error"
    )
  }, [addToast])

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
  }>, sourceTasksByChapter: Record<string, TopicTaskItem[]> = tasksByChapter) => {
    const map = new Map<string, TopicParamDraft>()
    for (const row of rows) {
      const chapterTaskDurations = (sourceTasksByChapter[row.topic_id] ?? []).map((task) =>
        Math.max(0, task.durationMinutes)
      )
      map.set(row.topic_id, {
        topic_id: row.topic_id,
        estimated_hours: Math.max(0, row.estimated_hours ?? 0),
        deadline: row.deadline ?? null,
        earliest_start: row.earliest_start ?? null,
        depends_on: row.depends_on ?? [],
        session_length_minutes: inferSessionLengthMinutes(
          chapterTaskDurations,
          row.session_length_minutes
        ),
        rest_after_days: Math.max(0, row.rest_after_days ?? 0),
        max_sessions_per_day: Math.max(0, row.max_sessions_per_day ?? 0),
        study_frequency: row.study_frequency === "spaced" ? "spaced" : "daily",
      })
    }
    return map
  }, [tasksByChapter])

  const loadTopicParamsSnapshot = useCallback(async (showErrorToast = false) => {
    try {
      const paramsRes = await getTopicParams()
      if (paramsRes.status !== "SUCCESS") {
        if (showErrorToast) {
          addToast("Failed to load chapter dependency data.", "error")
        }
        return new Map<string, TopicParamDraft>()
      }

      const map = mapTopicParamsToDraftMap(paramsRes.params)
      setTopicParamsByTopic(map)
      setSubjects((previous) =>
        previous.map((subject) => ({
          ...subject,
          chapters: subject.chapters.map((chapter) => {
            const param = map.get(chapter.id)
            if (!param) return chapter
            return {
              ...chapter,
              earliestStart: param.earliest_start ?? null,
              deadline: param.deadline ?? null,
              restAfterDays: Math.max(0, param.rest_after_days ?? 0),
            }
          }),
        }))
      )
      return map
    } catch (error) {
      if (showErrorToast) {
        showMutationError(error, "Failed to load chapter dependency data.")
      }
      return new Map<string, TopicParamDraft>()
    }
  }, [addToast, mapTopicParamsToDraftMap, showMutationError])

  const loadStep2Snapshot = useCallback(async (showErrorToast = false) => {
    setConstraintsLoading(true)

    try {
      const configRes = await getPlanConfig()

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
          max_active_subjects: Math.max(0, cfg.max_active_subjects ?? 0),
        })
      } else if (configRes.status === "ERROR") {
        if (showErrorToast) {
          addToast(configRes.message, "error")
        }
      } else if (showErrorToast) {
        addToast("Step-2 config missing. Save Step-2 constraints first.", "error")
      }

    } catch (error) {
      if (showErrorToast) {
        showMutationError(error, "Could not load saved planner data.")
      }
    } finally {
      setConstraintsLoading(false)
    }
  }, [addToast, showMutationError])

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

  const resetManageModeState = useCallback(() => {
    setSelectedTaskIds(new Set())
    setBulkDurationInput("60")
  }, [])

  const closeManageMode = useCallback(() => {
    setIsManageOpen(false)
    resetManageModeState()
  }, [resetManageModeState])

  const resetTransientIntakeState = useCallback(() => {
    closeManageMode()
    setShowArchived(false)
    setSubjects([])
    setTasksByChapter({})
    setSelectedSubjectId(null)
    setSelectedChapterId(null)
    setManualOrderChapterIds(new Set())
    setReorderingTaskIds([])
    setReorderingSubjects(false)
    setReorderingChapters(false)
    setPendingTaskIds(new Set())
    setTaskDurationDrafts({})
    setTaskDurationSavingIds(new Set())
    setTaskDialog(CLOSED_DIALOG_STATE)
    setChapterDialog(CLOSED_DIALOG_STATE)
    setDrawerOpen(false)
    setTaskComposerOpen(false)
    setDependencyModalOpen(false)
    setDependencySelectedIds(new Set())
    setDependencySearch("")
    setDependencyTargetChapterId("")
    setArchivedChapterRows([])
    setArchivedChapterModalOpen(false)
    setArchivedChapterPendingId(null)
    setSelectedCustomDates(new Set())
    setCustomCapacityMinutesInput("")
    setTopicParamsByTopic(new Map())
    setConstraintsDraft(defaultIntakeConstraints())
  }, [closeManageMode])

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
    closeManageMode()
  }, [closeManageMode, selectedChapter?.id, showArchived])

  useEffect(() => {
    if (!onSelectedTaskIdsChange) return
    onSelectedTaskIdsChange(Array.from(selectedTaskIds).sort())
  }, [onSelectedTaskIdsChange, selectedTaskIds])

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
  const visibleTasks = chapterTasks

  const selectedVisibleTaskIds = useMemo(
    () => visibleTasks.filter((task) => selectedTaskIds.has(task.id)).map((task) => task.id),
    [selectedTaskIds, visibleTasks]
  )

  const loadArchivedChaptersForSubject = useCallback(async (
    subjectId: string,
    showErrorToast = false
  ) => {
    setArchivedChapterLoading(true)
    try {
      const result = await getArchivedChapters(subjectId)
      if (result.status === "SUCCESS") {
        setArchivedChapterRows(result.chapters)
        return
      }

      setArchivedChapterRows([])
      if (showErrorToast) {
        addToast(
          result.status === "ERROR" ? result.message : "Please sign in to view archived chapters.",
          "error"
        )
      }
    } catch (error) {
      setArchivedChapterRows([])
      if (showErrorToast) {
        showMutationError(error, "Failed to load archived chapters.")
      }
    } finally {
      setArchivedChapterLoading(false)
    }
  }, [addToast, showMutationError])

  useEffect(() => {
    if (!selectedSubject?.id) {
      setArchivedChapterRows([])
      return
    }

    void loadArchivedChaptersForSubject(selectedSubject.id, false)
  }, [loadArchivedChaptersForSubject, selectedSubject?.id])

  const subjectColumnItems: ColumnItem[] = displaySubjects.map((subject) => ({
    id: subject.id,
    label: subject.name,
    hint: `${subject.chapters.length} chapter${subject.chapters.length === 1 ? "" : "s"}`,
    onEdit: showArchived || isMutating ? undefined : () => openEditSubject(subject.id),
    onDelete: isMutating
      ? undefined
      : () => {
        void handleDeleteSubject(subject.id, subject.name)
      },
  }))

  const chapterColumnItems: ColumnItem[] = (selectedSubject?.chapters ?? []).map((chapter) => ({
    id: chapter.id,
    label: chapter.name,
    hint: `${(tasksByChapter[chapter.id] ?? []).length} task${(tasksByChapter[chapter.id] ?? []).length === 1 ? "" : "s"}`,
    onEdit: showArchived || isMutating ? undefined : () => openEditChapter(chapter.id, chapter.name),
    onDelete: isMutating
      ? undefined
      : () => {
        void handleDeleteChapter(chapter.id, chapter.name)
      },
  }))

  const selectedDetailTitle = selectedChapter?.name ?? "Overview"

  const bulkPreview = useMemo(() => {
    const baseName = bulkBaseName.trim()
    if (!baseName) return []

    const count = clampInteger(Number.parseInt(bulkCount, 10) || 0, 1, 4)

    return Array.from({ length: count }, (_, index) =>
      composeSeriesName(
        baseName,
        BULK_SERIES_DEFAULTS.startAt + index,
        BULK_SERIES_DEFAULTS.placement,
        BULK_SERIES_DEFAULTS.separator,
        BULK_SERIES_DEFAULTS.numberPadding
      )
    )
  }, [bulkBaseName, bulkCount])

  function resetTaskComposerFields() {
    setTaskCreateMode("single")
    setSingleTaskTitle("")
    setBulkBaseName("")
    setBulkCount("5")
  }

  function openCreateSubject() {
    if (showArchived || mutationLockRef.current) return
    setDrawerMode("create")
    setSelectedSubjectIdForDrawer(null)
    setSubjectSnapshotForDrawer(null)
    setDrawerOpen(true)
  }

  function openEditSubject(subjectId: string) {
    if (mutationLockRef.current) return
    const target = subjects.find((subject) => subject.id === subjectId)
    setDrawerMode("edit")
    setSelectedSubjectIdForDrawer(subjectId)
    setSubjectSnapshotForDrawer(
      target
        ? {
          name: target.name,
          startDate: "",
          deadline: "",
          restAfterDays: "0",
        }
        : null
    )
    setDrawerOpen(true)
  }

  function openCreateChapter() {
    if (!selectedSubject || showArchived || mutationLockRef.current) return
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
    if (mutationLockRef.current) return
    const chapter = selectedSubject?.chapters.find((item) => item.id === chapterId)
    const param = topicParamsByTopic.get(chapterId)
    setChapterDialog({
      open: true,
      mode: "edit",
      targetId: chapterId,
      value: chapterName,
      earliestStart: param?.earliest_start ?? chapter?.earliestStart ?? "",
      deadline: param?.deadline ?? "",
      restAfterDays: String(Math.max(0, param?.rest_after_days ?? chapter?.restAfterDays ?? 0)),
    })
  }

  function openEditTask(taskId: string, taskTitle: string) {
    if (mutationLockRef.current) return
    setTaskDialog({
      open: true,
      mode: "edit",
      targetId: taskId,
      value: taskTitle,
    })
  }

  function openTaskComposer() {
    if (!selectedChapter || showArchived || mutationLockRef.current) return
    resetTaskComposerFields()
    setTaskComposerOpen(true)
  }

  async function handleTasksDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id || !selectedChapter) {
      return
    }

    if (!beginMutation()) return

    try {
      const activeTaskId = String(active.id)
      const overTaskId = String(over.id)
      const fromIndex = visibleTasks.findIndex((task) => task.id === activeTaskId)
      const toIndex = visibleTasks.findIndex((task) => task.id === overTaskId)

      if (fromIndex < 0 || toIndex < 0) {
        return
      }

      const chapterId = selectedChapter.id
      const reorderedChapterTasks = arrayMove(visibleTasks, fromIndex, toIndex)
      const orderedChapterTaskIds = reorderedChapterTasks.map((task) => task.id)

      setReorderingTaskIds(orderedChapterTaskIds)

      const result = await reorderTasks({
        chapterId,
        taskIds: orderedChapterTaskIds,
      })

      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Failed to reorder tasks.", "error")
        return
      }

      setManualOrderChapterIds((current) => {
        const next = new Set(current)
        next.add(chapterId)
        return next
      })
      await refetchFromDbState(true)
    } catch (error) {
      showMutationError(error, "Could not reorder tasks right now.")
    } finally {
      setReorderingTaskIds([])
      endMutation()
    }
  }

  useEffect(() => {
    if (!selectedChapter || showArchived) return
    if (reorderingTaskIds.length > 0) return
    if (mutationLockRef.current) return

    const chapterId = selectedChapter.id
    if (manualOrderChapterIds.has(chapterId)) return
    if (!shouldAutoOrderTasks(chapterTasks)) return

    const autoOrderedTasks = [...chapterTasks].sort(compareTasksNaturally)
    const unchanged = autoOrderedTasks.every((task, index) => task.id === chapterTasks[index]?.id)
    if (unchanged) return

    const orderedTaskIds = autoOrderedTasks.map((task) => task.id)
    setReorderingTaskIds(orderedTaskIds)

    let alive = true

    void (async () => {
      if (!beginMutation()) {
        if (alive) {
          setReorderingTaskIds([])
        }
        return
      }

      try {
        const result = await reorderTasks({
          chapterId,
          taskIds: orderedTaskIds,
        })

        if (!alive) return

        if (result.status !== "SUCCESS") {
          addToast(result.status === "ERROR" ? result.message : "Failed to auto-order tasks.", "error")
          return
        }

        await refetchFromDbState(false)
      } catch (error) {
        if (!alive) return
        showMutationError(error, "Could not auto-order tasks.")
      } finally {
        if (alive) {
          setReorderingTaskIds([])
        }
        endMutation()
      }
    })()

    return () => {
      alive = false
    }
  // Intentionally scoped to ordering state inputs so auto-order does not rerun
  // on helper closure churn from unrelated renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterTasks, manualOrderChapterIds, reorderingTaskIds.length, selectedChapter, showArchived, showMutationError])


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

    if (!beginMutation()) return

    setChapterDialogSaving(true)

    try {
      if (chapterDialog.mode === "create") {
        if (!selectedSubject) return

        const result = await addChapter(selectedSubject.id, chapterDialog.value)
        if (result.status === "SUCCESS") {
          setChapterDialog(CLOSED_DIALOG_STATE)
          addToast("Chapter added.", "success")
          await refetchFromDbState(true)
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
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to save chapter.")
    } finally {
      setChapterDialogSaving(false)
      endMutation()
    }
  }

  async function handleSaveTaskTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!taskDialog.targetId) return
    if (!taskDialog.value.trim()) {
      addToast("Task title is required.", "error")
      return
    }

    if (!beginMutation()) return

    setTaskDialogSaving(true)

    try {
      const result = await updateSubjectTaskTitle(taskDialog.targetId, taskDialog.value)

      if (result.status === "SUCCESS") {
        setTaskDialog(CLOSED_DIALOG_STATE)
        addToast("Task updated.", "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to update task title.")
    } finally {
      setTaskDialogSaving(false)
      endMutation()
    }
  }

  async function handleDeleteChapter(chapterId: string, chapterName: string) {
    if (!window.confirm(`Delete chapter "${chapterName}"? All tasks in this chapter will also be deleted.`)) {
      return
    }

    if (!beginMutation()) return

    try {
      const result = await deleteChapter(chapterId)
      if (result.status === "SUCCESS") {
        closeManageMode()
        addToast("Chapter and its tasks deleted.", "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to delete chapter.")
    } finally {
      endMutation()
    }
  }

  async function handleArchiveChapterFromDialog() {
    if (chapterDialog.mode !== "edit" || !chapterDialog.targetId) return

    if (!window.confirm("Archive this chapter? It will be removed from active intake and planning.")) {
      return
    }

    if (!beginMutation()) return

    setChapterArchiveSaving(true)
    try {
      const result = await archiveChapter(chapterDialog.targetId)
      if (result.status === "SUCCESS") {
        setChapterDialog(CLOSED_DIALOG_STATE)
        closeManageMode()
        addToast("Chapter archived.", "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to archive chapter.")
    } finally {
      setChapterArchiveSaving(false)
      endMutation()
    }
  }

  async function handleOpenArchivedChaptersModal() {
    if (mutationLockRef.current) return
    if (!selectedSubject?.id) {
      addToast("Select a subject first.", "error")
      return
    }

    setArchivedChapterModalOpen(true)
    await loadArchivedChaptersForSubject(selectedSubject.id, true)
  }

  async function handleRestoreArchivedChapter(chapterId: string) {
    if (!selectedSubject?.id) return

    if (!beginMutation()) return

    setArchivedChapterPendingId(chapterId)
    try {
      const result = await unarchiveChapter(chapterId)
      if (result.status === "SUCCESS") {
        addToast("Chapter restored.", "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to restore chapter.")
    } finally {
      setArchivedChapterPendingId(null)
      endMutation()
    }
  }

  async function handleDeleteArchivedChapter(chapterId: string, chapterName: string) {
    if (!selectedSubject?.id) return

    if (!window.confirm(`Permanently delete archived chapter "${chapterName}"?`)) {
      return
    }

    if (!beginMutation()) return

    setArchivedChapterPendingId(chapterId)
    try {
      const result = await deleteChapter(chapterId)
      if (result.status === "SUCCESS") {
        addToast("Archived chapter deleted.", "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to delete archived chapter.")
    } finally {
      setArchivedChapterPendingId(null)
      endMutation()
    }
  }

  async function handleDeleteSubject(subjectId: string, subjectName: string) {
    if (!window.confirm(`Delete subject "${subjectName}"? This cannot be undone.`)) {
      return
    }

    if (!beginMutation()) return

    try {
      const result = await deleteSubject(subjectId)
      if (result.status === "SUCCESS") {
        closeManageMode()
        addToast("Subject deleted.", "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to delete subject.")
    } finally {
      endMutation()
    }
  }

  async function handleDeleteTask(taskId: string, taskTitle: string) {
    if (!window.confirm(`Delete task "${taskTitle}"?`)) {
      return
    }

    if (!beginMutation()) return

    try {
      const result = await deleteSubjectTask(taskId)
      if (result.status === "SUCCESS") {
        addToast("Task deleted.", "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to delete task.")
    } finally {
      endMutation()
    }
  }

  async function handleCreateTasks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedChapter) {
      addToast("Select a chapter first.", "error")
      return
    }

    if (!beginMutation()) return

    setTaskComposerSaving(true)

    try {
      if (taskCreateMode === "single") {
        const title = singleTaskTitle.trim()
        if (!title) {
          addToast("Task title is required.", "error")
          return
        }

        const result = await createSubjectTask({
          chapterId: selectedChapter.id,
          title,
        })

        if (result.status === "SUCCESS") {
          addToast("Task added.", "success")
          setTaskComposerOpen(false)
          resetTaskComposerFields()
          await refetchFromDbState(true)
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

      if (!Number.isFinite(count) || count < 1) {
        addToast("Task count must be at least 1.", "error")
        return
      }

      const result = await bulkCreateSubjectTasks({
        chapterId: selectedChapter.id,
        baseName,
        count,
        startAt: BULK_SERIES_DEFAULTS.startAt,
        numberPadding: BULK_SERIES_DEFAULTS.numberPadding,
        separator: BULK_SERIES_DEFAULTS.separator,
        placement: BULK_SERIES_DEFAULTS.placement,
      })

      if (result.status === "SUCCESS") {
        addToast(`Added ${result.createdCount} tasks.`, "success")
        setTaskComposerOpen(false)
        resetTaskComposerFields()
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to create task.")
    } finally {
      setTaskComposerSaving(false)
      endMutation()
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

  function selectAllVisibleTasks() {
    setSelectedTaskIds((current) => {
      const next = new Set(current)

      for (const task of visibleTasks) {
        next.add(task.id)
      }

      return next
    })
  }

  async function handleDeleteSelectedTasks() {
    if (!selectedChapter) return

    const taskIds = selectedVisibleTaskIds
    if (taskIds.length === 0) {
      addToast("Select visible tasks to delete.", "error")
      return
    }

    if (!window.confirm(`Delete ${taskIds.length} selected task${taskIds.length === 1 ? "" : "s"}?`)) {
      return
    }

    if (!beginMutation()) return

    setDeletingSelectedTasks(true)
    try {
      const result = await deleteSubjectTasks({
        chapterId: selectedChapter.id,
        taskIds,
      })

      if (result.status === "SUCCESS") {
        closeManageMode()
        addToast(`Deleted ${result.deletedCount} task${result.deletedCount === 1 ? "" : "s"}.`, "success")
        await refetchFromDbState(true)
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Unauthorized", "error")
        return
      }

      addToast(result.message, "error")
    } catch (error) {
      showMutationError(error, "Failed to delete selected tasks.")
    } finally {
      setDeletingSelectedTasks(false)
      endMutation()
    }
  }

  async function handleToggleTask(taskId: string, nextCompleted: boolean) {
    if (!selectedChapter || showArchived) return
    if (pendingTaskIds.has(taskId)) return

    const chapterId = selectedChapter.id
    if (!(tasksByChapter[chapterId] ?? []).some((task) => task.id === taskId)) return
    if (!beginMutation()) return

    setPendingTaskIds((current) => {
      const next = new Set(current)
      next.add(taskId)
      return next
    })

    try {
      const result = await setSubjectTaskCompletion(taskId, nextCompleted)
      if (result.status !== "SUCCESS") {
        if (result.status === "UNAUTHORIZED") {
          addToast("Unauthorized", "error")
        } else if (result.status === "NOT_FOUND") {
          addToast("Task not found.", "error")
        } else {
          addToast(result.message || "Could not update task status.", "error")
        }
        return
      }

      await refetchFromDbState(true)
    } catch (error) {
      showMutationError(error, "Could not update task status.")
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current)
        next.delete(taskId)
        return next
      })
      endMutation()
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

    if (!beginMutation()) return

    setTaskDurationSavingIds((previous) => {
      const next = new Set(previous)
      next.add(taskId)
      return next
    })

    try {
      const result = await updateSubjectTaskDuration({
        taskId,
        durationMinutes: nextDuration,
      })

      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Failed to update task duration.", "error")
      } else {
        addToast("Task duration updated.", "success")
        await refetchFromDbState(true)
      }
    } catch (error) {
      showMutationError(error, "Could not update task duration.")
    } finally {
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
      endMutation()
    }
  }

  async function handleApplySelectedTaskDuration() {
    if (!selectedChapter || showArchived) return

    const taskIds = selectedVisibleTaskIds
    if (taskIds.length === 0) {
      addToast("Select visible tasks to apply duration.", "error")
      return
    }

    const parsed = Number.parseInt(bulkDurationInput, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast(`Duration must be between ${MIN_SESSION_LENGTH_MINUTES} and ${MAX_SESSION_LENGTH_MINUTES} minutes.`, "error")
      return
    }

    const durationMinutes = normalizeDurationMinutes(parsed)
    const chapterId = selectedChapter.id
    if (!beginMutation()) return

    setBulkDurationSaving(true)

    try {
      const result = await bulkUpdateSubjectTaskDuration({
        chapterId,
        taskIds,
        durationMinutes,
      })

      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Failed to apply duration.", "error")
      } else {
        addToast(`Updated duration for ${result.updatedCount} task${result.updatedCount === 1 ? "" : "s"}.`, "success")
        await refetchFromDbState(true)
      }
    } catch (error) {
      showMutationError(error, "Could not apply duration update.")
    } finally {
      setBulkDurationSaving(false)
      endMutation()
    }
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
    const parsed = Number.parseInt(customCapacityMinutesInput, 10)
    const selectedDates = Array.from(selectedCustomDates)
    const targetDates = selectedDates.length > 0 ? selectedDates : []

    if (targetDates.length === 0) {
      addToast("Select one or more dates for custom capacity.", "error")
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
        ...Object.fromEntries(targetDates.map((date) => [date, parsed])),
      },
    }))

    setCustomCapacityMinutesInput("")
    setSelectedCustomDates(new Set())
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

  async function handleSaveConstraints() {
    if (!constraintsDraft.study_start_date || !constraintsDraft.exam_date) {
      addToast("Start date and final deadline are required.", "error")
      return
    }

    if (constraintsDraft.study_start_date >= constraintsDraft.exam_date) {
      addToast("Final deadline must be after start date.", "error")
      return
    }

    if (!beginMutation()) return

    setConstraintsSaving(true)
    try {
      const payload = {
        study_start_date: constraintsDraft.study_start_date,
        exam_date: constraintsDraft.exam_date,
        weekday_capacity_minutes: Math.max(0, Math.trunc(constraintsDraft.weekday_capacity_minutes)),
        weekend_capacity_minutes: Math.max(0, Math.trunc(constraintsDraft.weekend_capacity_minutes)),
        max_active_subjects: Math.max(0, Math.trunc(constraintsDraft.max_active_subjects)),
        day_of_week_capacity: normalizeDayOfWeekCapacity(constraintsDraft.day_of_week_capacity),
        custom_day_capacity: constraintsDraft.custom_day_capacity,
        flexibility_minutes: Math.max(0, Math.trunc(constraintsDraft.flexibility_minutes)),
      }

      const result = await savePlanConfig(payload)

      if (result.status === "SUCCESS") {
        addToast("Step-2 constraints saved.", "success")
        await refetchFromDbState(false)
      } else {
        addToast(result.status === "ERROR" ? result.message : "Failed to save constraints.", "error")
      }
    } catch (error) {
      showMutationError(error, "Could not save constraints.")
    } finally {
      setConstraintsSaving(false)
      endMutation()
    }
  }

  async function handleReorderSubjects(orderedIds: string[]) {
    if (showArchived || reorderingSubjects) return
    if (orderedIds.length <= 1) return

    if (!beginMutation()) return
    setReorderingSubjects(true)

    try {
      const result = await reorderSubjectsAction(
        orderedIds.map((id, sortOrder) => ({
          id,
          sort_order: sortOrder,
        }))
      )

      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Failed to reorder subjects.", "error")
        return
      }

      addToast("Subjects reordered.", "success")
      await refetchFromDbState(true)
    } catch (error) {
      showMutationError(error, "Could not reorder subjects.")
    } finally {
      setReorderingSubjects(false)
      endMutation()
    }
  }

  async function handleReorderChapters(orderedIds: string[]) {
    if (showArchived || reorderingChapters || !selectedSubject) return
    if (orderedIds.length <= 1) return

    if (!beginMutation()) return

    setReorderingChapters(true)
    try {
      const result = await reorderChaptersAction(
        selectedSubject.id,
        orderedIds.map((id, sortOrder) => ({
          id,
          sort_order: sortOrder,
        }))
      )

      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Failed to reorder chapters.", "error")
        return
      }

      addToast("Chapters reordered.", "success")
      await refetchFromDbState(true)
    } catch (error) {
      showMutationError(error, "Could not reorder chapters.")
    } finally {
      setReorderingChapters(false)
      endMutation()
    }
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
        tasks: Array<{
          id: string
          topic_id: string | null
          title: string
          completed: boolean
          duration_minutes: number
        }>
      }>
    }>,
    topicMetaMap: Map<string, TopicMetaDraft>
  ) {
    const nextSubjects: SubjectNavItem[] = structureSubjects.map((subject) => {
      const activeTopics = subject.topics.filter((topic) => topic.archived !== true)

      return {
        id: subject.id,
        name: subject.name,
        archived: subject.archived ?? false,
        chapters: activeTopics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          archived: topic.archived ?? false,
          topics: [],
          earliestStart: topicMetaMap.get(topic.id)?.earliestStart ?? null,
          deadline: topicMetaMap.get(topic.id)?.deadline ?? null,
          restAfterDays: topicMetaMap.get(topic.id)?.restAfterDays ?? 0,
        })),
      }
    })

    const nextTasksByChapter: Record<string, TopicTaskItem[]> = {}
    for (const subject of structureSubjects) {
      for (const topic of subject.topics) {
        if (topic.archived === true) continue

        nextTasksByChapter[topic.id] = topic.tasks.map((task) => ({
          id: task.id,
          topicId: task.topic_id ?? topic.id,
          title: task.title,
          completed: task.completed,
          durationMinutes: normalizeDurationMinutes(task.duration_minutes),
        }))
      }
    }

    return { nextSubjects, nextTasksByChapter }
  }

  async function importStructureFromSubjects(
    mode: IntakeImportMode,
    options?: { persistMode?: boolean; showSuccessToast?: boolean; trackLoading?: boolean }
  ): Promise<boolean> {
    const trackLoading = options?.trackLoading !== false

    if (trackLoading) {
      if (mode === "undone") {
        setImportingUndone(true)
      } else {
        setImportingAll(true)
      }
    }

    try {
      if (options?.persistMode !== false) {
        const saveModeRes = await saveIntakeImportMode(mode)
        if (saveModeRes.status !== "SUCCESS") {
          addToast(
            saveModeRes.status === "ERROR"
              ? saveModeRes.message
              : "Please sign in to persist import mode.",
            "error"
          )
          return false
        }
      }

      const [structureRes, paramsRes] = await Promise.all([
        getStructure({
          onlyUndoneTasks: mode === "undone",
          dropTopicsWithoutTasks: mode === "undone",
        }),
        getTopicParams(),
      ])

      if (structureRes.status !== "SUCCESS") {
        addToast(
          structureRes.status === "ERROR"
            ? structureRes.message
            : "Please sign in to import from subjects.",
          "error"
        )
        return false
      }

      const paramsRows = paramsRes.status === "SUCCESS" ? paramsRes.params : []
      if (paramsRes.status !== "SUCCESS") {
        addToast("Failed to load chapter dependency data.", "error")
      }

      const topicMetaMap = new Map<string, TopicMetaDraft>()
      for (const row of paramsRows) {
        topicMetaMap.set(row.topic_id, {
          earliestStart: row.earliest_start ?? null,
          deadline: row.deadline ?? null,
          restAfterDays: Math.max(0, row.rest_after_days ?? 0),
        })
      }

      const { nextSubjects, nextTasksByChapter } = mapStructureToLocalState(
        structureRes.tree.subjects,
        topicMetaMap
      )

      const nextTopicParamsMap = mapTopicParamsToDraftMap(paramsRows, nextTasksByChapter)

      setSubjects(nextSubjects)
      setTasksByChapter(nextTasksByChapter)
      setTopicParamsByTopic(nextTopicParamsMap)
      setShowArchived(false)
      closeManageMode()
      setTaskDurationDrafts({})
      setTaskDurationSavingIds(new Set())
      setPendingTaskIds(new Set())
      setManualOrderChapterIds(new Set())
      setReorderingTaskIds([])
      setIntakeImportMode(mode)

      if (nextSubjects.length > 0) {
        setSelectedSubjectId(nextSubjects[0].id)
        const firstChapter = nextSubjects[0].chapters[0]
        setSelectedChapterId(firstChapter?.id ?? null)
      } else {
        setSelectedSubjectId(null)
        setSelectedChapterId(null)
      }

      if (options?.showSuccessToast !== false) {
        addToast(
          mode === "undone"
            ? "Imported undone-only structure snapshot."
            : "Imported full structure snapshot.",
          "success"
        )
      }

      return true
    } catch (error) {
      showMutationError(error, "Could not import structure from subjects.")
      return false
    } finally {
      if (trackLoading) {
        setImportingAll(false)
        setImportingUndone(false)
      }
    }
  }

  async function refetchFromDbState(showErrorToast = true): Promise<boolean> {
    try {
      const modeRes = await getIntakeImportMode()
      const reloadMode = modeRes.status === "SUCCESS" ? modeRes.mode : intakeImportMode

      if (modeRes.status === "ERROR" && showErrorToast) {
        addToast(modeRes.message, "error")
      }

      const imported = await importStructureFromSubjects(reloadMode, {
        persistMode: false,
        showSuccessToast: false,
        trackLoading: false,
      })

      await loadStep2Snapshot(showErrorToast)
      return imported
    } catch (error) {
      if (showErrorToast) {
        showMutationError(error, "Failed to reload saved intake data.")
      }
      return false
    }
  }

  async function handleImportModeClick(mode: IntakeImportMode) {
    if (!beginMutation()) return

    try {
      const imported = await importStructureFromSubjects(mode)
      if (!imported) {
        addToast("Import failed. Please try again.", "error")
      }
    } catch (error) {
      showMutationError(error, "Import failed. Please try again.")
    } finally {
      endMutation()
    }
  }

  async function handleResetIntakeView() {
    if (!window.confirm("Reset intake view to currently saved subjects, chapter metadata, and constraints?")) {
      return
    }

    if (!beginMutation()) return

    setResettingIntake(true)
    try {
      resetTransientIntakeState()

      const imported = await refetchFromDbState(true)

      if (imported) {
        addToast("Reloaded saved intake data.", "success")
      }
    } catch (error) {
      showMutationError(error, "Could not reset intake view.")
    } finally {
      setResettingIntake(false)
      endMutation()
    }
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
    try {
      const map = await loadTopicParamsSnapshot(true)
      setDependencySelectedIds(new Set(map.get(targetId)?.depends_on ?? []))
    } catch (error) {
      showMutationError(error, "Could not load dependencies.")
    } finally {
      setDependencyLoading(false)
    }
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
    const chapterTaskDurations = (tasksByChapter[dependencyTargetChapterId] ?? []).map((task) =>
      Math.max(0, task.durationMinutes)
    )
const derivedHours = Math.max(0, Math.round((chapterTaskMinutes / 60) * 10) / 10)
      const estimatedHours = existing?.estimated_hours
        ? existing.estimated_hours
        : derivedHours > 0 ? derivedHours : 1

    const dependsOn = Array.from(dependencySelectedIds)
      .filter((id) => id !== dependencyTargetChapterId)

    if (!beginMutation()) return

    setDependencySaving(true)

    try {
      const result = await saveTopicParams([
        {
          topic_id: dependencyTargetChapterId,
          estimated_hours: estimatedHours,
          deadline: existing?.deadline ?? null,
          earliest_start: existing?.earliest_start ?? chapter.earliestStart ?? null,
          depends_on: dependsOn,
          session_length_minutes: inferSessionLengthMinutes(
            chapterTaskDurations,
            existing?.session_length_minutes
          ),
          rest_after_days: existing?.rest_after_days ?? Math.max(0, chapter.restAfterDays ?? 0),
          max_sessions_per_day: existing?.max_sessions_per_day ?? 0,
          study_frequency: existing?.study_frequency ?? "daily",
        },
      ])

      if (result.status === "SUCCESS") {
        addToast("Dependencies saved.", "success")
        setDependencyModalOpen(false)
        await refetchFromDbState(false)
      } else {
        addToast(result.status === "ERROR" ? result.message : "Failed to save dependencies.", "error")
      }
    } catch (error) {
      showMutationError(error, "Could not save dependencies.")
    } finally {
      setDependencySaving(false)
      endMutation()
    }
  }

  const customCapacityEntries = useMemo(
    () => Object.entries(constraintsDraft.custom_day_capacity).sort(([left], [right]) => left.localeCompare(right)),
    [constraintsDraft.custom_day_capacity]
  )

  const step2CalendarWeeks = useMemo(
    () => buildMonthGrid(calendarMonthCursor),
    [calendarMonthCursor]
  )

  const step2CalendarLabel = useMemo(
    () => formatMonthLabel(calendarMonthCursor),
    [calendarMonthCursor]
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

      <div className="px-0.5 sm:px-0">
        {displaySubjects.length === 0 && (
          <div
            className="mb-3 rounded-xl border p-4"
            style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
              {showArchived ? "No archived subjects." : "No active subjects."}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--sh-text-muted)" }}>
              {showArchived
                ? "Archive a subject to see it in this view."
                : "Create your first subject to start building your structure."}
            </p>
          </div>
        )}

          <p className="mb-3 text-xs font-medium sm:hidden" style={{ color: "var(--sh-text-muted)" }}>
            Swipe horizontally between Subjects, Chapters, and the overview panel.
          </p>

          <div className="mb-3 flex items-center gap-2 overflow-x-auto">
            <p
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--sh-text-muted)" }}
            >
              STEP-1
            </p>

            <div className="ml-auto flex min-w-max flex-nowrap items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  void handleImportModeClick("all")
                }}
                disabled={isMutating || importingAll || importingUndone || resettingIntake}
              >
                {importingAll ? "Importing..." : "Import All"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  void handleImportModeClick("undone")
                }}
                disabled={isMutating || importingAll || importingUndone || resettingIntake}
              >
                {importingUndone ? "Importing..." : "Import Undone Only"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  void handleResetIntakeView()
                }}
                disabled={isMutating || resettingIntake || importingAll || importingUndone}
              >
                {resettingIntake ? "Resetting..." : "Reload Saved Intake Data"}
              </Button>
            </div>
          </div>

          <div className="flex h-[520px] min-h-[520px] items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
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
                    disabled={isMutating || showArchived}
                  >
                    Add Subject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      void openDependencyManager("subject")
                    }}
                    disabled={isMutating || showArchived || !selectedSubject || selectedSubject.chapters.length === 0}
                  >
                    Set Dependencies
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => setShowArchived((value) => !value)}
                    disabled={isMutating}
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
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={openCreateChapter}
                    disabled={isMutating || !selectedSubject || showArchived}
                  >
                    Add Chapter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      void openDependencyManager("chapter")
                    }}
                    disabled={isMutating || showArchived || !selectedChapter}
                  >
                    Set Dependencies
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      void handleOpenArchivedChaptersModal()
                    }}
                    disabled={isMutating || showArchived || !selectedSubject || archivedChapterLoading}
                  >
                    {archivedChapterLoading
                      ? "Loading Archived Chapters..."
                      : `Archived Chapters (${archivedChapterRows.length})`}
                  </Button>
                </>
              }
            />

            <section
              className="min-w-[340px] h-full flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start flex flex-col overflow-hidden"
              style={{
                borderColor: "var(--sh-border)",
                background: "var(--sh-card)",
              }}
            >
              {selectedSubject && selectedChapter ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="mt-3 flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: "var(--sh-text-primary)" }}
                      >
                        {selectedDetailTitle}
                      </h2>
                    </div>

                    <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={openTaskComposer}
                        disabled={isMutating || showArchived}
                      >
                        Add Task
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (isManageOpen) {
                            closeManageMode()
                          } else {
                            setIsManageOpen(true)
                          }
                        }}
                        disabled={isMutating || showArchived || chapterTasks.length === 0}
                      >
                        {isManageOpen ? "Done" : "Manage"}
                      </Button>
                    </div>
                  </div>

                  {isManageOpen ? (
                    <section
                      className="mt-2 h-[64px] rounded-lg border p-2 flex flex-col overflow-hidden"
                      style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
                    >
                      <div className="min-h-0 flex flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={selectAllVisibleTasks}
                          disabled={isMutating || visibleTasks.length === 0}
                        >
                          Select All
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setSelectedTaskIds(new Set())}
                          disabled={isMutating || selectedTaskIds.size === 0}
                        >
                          Clear
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            void handleDeleteSelectedTasks()
                          }}
                          disabled={isMutating || selectedVisibleTaskIds.length === 0 || deletingSelectedTasks}
                        >
                          {deletingSelectedTasks ? "Deleting..." : "Delete Selected"}
                        </Button>

                        <div className="ml-2 flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={MIN_SESSION_LENGTH_MINUTES}
                            max={MAX_SESSION_LENGTH_MINUTES}
                            value={bulkDurationInput}
                            onChange={(event) => setBulkDurationInput(event.target.value)}
                            className="ui-input h-8 w-[90px]"
                            placeholder="Time"
                          />

                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              void handleApplySelectedTaskDuration()
                            }}
                            disabled={isMutating || selectedVisibleTaskIds.length === 0 || bulkDurationSaving}
                          >
                            {bulkDurationSaving ? "Applying..." : "Apply"}
                          </Button>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <section
                    className="mt-3 min-h-0 flex-1 rounded-lg border p-2 flex flex-col"
                    style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.01)" }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                        Tasks Overview
                      </p>
                      <div className="flex items-center gap-4 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                        <span>
                          Showing {visibleTasks.length} task{visibleTasks.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          {completedCount}/{chapterTasks.length} completed
                        </span>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      <div className="space-y-2">
                      {visibleTasks.length === 0 && (
                        <div
                          className="rounded-lg border border-dashed px-4 py-6 text-center text-sm"
                          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                        >
                          No tasks available.
                        </div>
                      )}

                      {visibleTasks.length > 0 && completedCount === chapterTasks.length && (
                        <div
                          className="rounded-lg border border-dashed px-4 py-3 text-center text-xs"
                          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                        >
                          All tasks completed.
                        </div>
                      )}

                      {visibleTasks.length > 0 && !isManageOpen && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleTasksDragEnd}
                        >
                          <SortableContext
                            items={visibleTasks.map((task) => task.id)}
                            strategy={rectSortingStrategy}
                          >
                            <div className="mb-1 grid grid-cols-1 gap-2 xl:grid-cols-2">
                              <div className="flex justify-end pr-[76px]">
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wide"
                                  style={{ color: "var(--sh-text-muted)" }}
                                >
                                  Duration
                                </span>
                              </div>
                              <div className="hidden xl:flex justify-end pr-[76px]">
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wide"
                                  style={{ color: "var(--sh-text-muted)" }}
                                >
                                  Duration
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                              {visibleTasks.map((task) => (
                                <DraggableTaskRow
                                  key={task.id}
                                  task={task}
                                  isPending={pendingTaskIds.has(task.id)}
                                  isDurationSaving={taskDurationSavingIds.has(task.id)}
                                  isReordering={reorderingTaskIds.includes(task.id)}
                                  canEdit={!showArchived && !isMutating}
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

                      {visibleTasks.length > 0 && isManageOpen && (
                        <>
                          <div className="mb-1 grid grid-cols-1 gap-2 xl:grid-cols-2">
                            <div className="flex justify-end pr-[76px]">
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wide"
                                style={{ color: "var(--sh-text-muted)" }}
                              >
                                Duration
                              </span>
                            </div>
                            <div className="hidden xl:flex justify-end pr-[76px]">
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wide"
                                style={{ color: "var(--sh-text-muted)" }}
                              >
                                Duration
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                          {visibleTasks.map((task) => {
                            const isPending = pendingTaskIds.has(task.id)
                            const isDurationSaving = taskDurationSavingIds.has(task.id)

                            return (
                              <div
                                key={task.id}
                                className="group rounded-lg border px-2 py-1.5 transition-colors"
                                style={{
                                  borderColor: "var(--sh-border)",
                                  background: task.completed
                                    ? "rgba(52, 211, 153, 0.08)"
                                    : "rgba(255, 255, 255, 0.02)",
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={selectedTaskIds.has(task.id)}
                                    onChange={() => toggleTaskSelection(task.id)}
                                    className="h-4 w-4 rounded border"
                                    aria-label="Select task"
                                    disabled={isMutating}
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleToggleTask(task.id, !task.completed)}
                                    disabled={isMutating || isPending || showArchived || isManageOpen}
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

                                  <div className="min-w-0 flex-1 flex items-center gap-2">
                                    <p
                                      className={`min-w-0 flex-1 text-[13px] font-medium ${task.completed ? "line-through opacity-60" : ""} ${sidebarExpanded ? "truncate" : "truncate"}`}
                                      style={{ color: "var(--sh-text-primary)" }}
                                      title={task.title}
                                    >
                                      {task.title}
                                    </p>

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
                                      disabled={isMutating || isDurationSaving || showArchived}
                                      className="ui-input h-7 text-xs text-center"
                                      style={{ width: "3.8rem" }}
                                      title="Task duration (minutes)"
                                    />
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1">
                                    <RowActionButton
                                      label="Edit task title"
                                      onClick={() => openEditTask(task.id, task.title)}
                                      disabled={isMutating || isPending || isDurationSaving || showArchived}
                                    />
                                    <RowActionButton
                                      label="Delete task"
                                      onClick={() => {
                                        void handleDeleteTask(task.id, task.title)
                                      }}
                                      danger
                                      disabled={isMutating || isPending || isDurationSaving || showArchived}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          </div>
                        </>
                      )}
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div
                  className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed text-sm"
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

          <div className="flex min-h-[520px] items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
            <section
              className="min-w-[320px] flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start flex flex-col"
              style={{
                borderColor: "var(--sh-border)",
                background: "var(--sh-card)",
              }}
            >
              {constraintsLoading ? (
                <div
                  className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm"
                  style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                >
                  Loading constraints...
                </div>
              ) : (
                <div className="flex flex-col gap-3 pr-1">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="date"
                      label="Start Date"
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
                      label="Final Deadline"
                      value={constraintsDraft.exam_date}
                      onChange={(event) =>
                        setConstraintsDraft((previous) => ({
                          ...previous,
                          exam_date: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
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
                      Final deadline must be after start date.
                    </p>
                  )}

                  <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                      Set Particular Day Capacity
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
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                        Calendar (Custom Capacity)
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCalendarMonthCursor((previous) => shiftMonthCursor(previous, -1))}
                        >
                          Prev
                        </Button>
                        <span className="text-[11px] font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                          {step2CalendarLabel}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCalendarMonthCursor((previous) => shiftMonthCursor(previous, 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <p className="text-[11px]" style={{ color: "var(--sh-text-secondary)" }}>
                        Click days to select date-specific capacity overrides.
                      </p>

                      <div className="grid grid-cols-7 gap-1">
                        {WEEKDAY_LABELS.map((label) => (
                          <div key={`custom-cal-head-${label}`} className="text-center text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
                            {label}
                          </div>
                        ))}
                      </div>

                      {step2CalendarWeeks.map((week, weekIndex) => (
                        <div key={`custom-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                          {week.map((isoDate, dayIndex) => {
                            if (!isoDate) {
                              return <div key={`custom-empty-${weekIndex}-${dayIndex}`} className="h-8 rounded-md" />
                            }

                            const selectedCustom = selectedCustomDates.has(isoDate)
                            const selected = selectedCustom
                            const hasCustom = isoDate in constraintsDraft.custom_day_capacity

                            return (
                              <button
                                key={`custom-day-${isoDate}`}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomDates((previous) => {
                                    const next = new Set(previous)
                                    if (next.has(isoDate)) next.delete(isoDate)
                                    else next.add(isoDate)
                                    return next
                                  })
                                }}
                                className="h-8 rounded-md border text-[11px] font-medium transition-colors"
                                style={{
                                  borderColor: selected
                                    ? "rgba(56, 189, 248, 0.6)"
                                    : hasCustom
                                      ? "rgba(56, 189, 248, 0.35)"
                                      : "var(--sh-border)",
                                  background: selected
                                    ? "rgba(56, 189, 248, 0.18)"
                                    : hasCustom
                                      ? "rgba(56, 189, 248, 0.1)"
                                      : "rgba(255,255,255,0.01)",
                                  color: selected
                                    ? "#bae6fd"
                                    : "var(--sh-text-secondary)",
                                }}
                                title={[
                                  hasCustom ? `${constraintsDraft.custom_day_capacity[isoDate]} min capacity` : "No custom capacity",
                                ].join(" Gï¿½ï¿½ ")}
                              >
                                {isoDate.slice(-2)}
                              </button>
                            )
                          })}
                        </div>
                      ))}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-2 py-1 text-[10px]" style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-secondary)" }}>
                          Capacity selected: {selectedCustomDates.size}
                        </span>
                      </div>

                      <div className="mt-2 space-y-2 rounded-md border p-2" style={{ borderColor: "rgba(56, 189, 248, 0.35)", background: "rgba(56, 189, 248, 0.06)" }}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#bae6fd" }}>
                          Custom Capacity Actions
                        </p>

                        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] items-end">
                          <Input
                            type="number"
                            min={0}
                            label="Minutes for selected dates"
                            value={customCapacityMinutesInput}
                            onChange={(event) => setCustomCapacityMinutesInput(event.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleAddCustomCapacityDate}
                          >
                            Apply to Selected
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCustomDates(new Set())}
                            disabled={selectedCustomDates.size === 0}
                          >
                            Clear Selection
                          </Button>
                        </div>

                        {customCapacityEntries.length === 0 ? (
                          <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
                            No custom date overrides yet.
                          </p>
                        ) : (
                          customCapacityEntries.map(([date, minutes]) => (
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
                          ))
                        )}
                      </div>
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
                        disabled={isMutating || constraintsSaving || hasStep2DateError}
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

      <SubjectDrawer
        open={drawerOpen}
        mode={drawerMode}
        subjectId={selectedSubjectIdForDrawer}
        initialSubject={subjectSnapshotForDrawer}
        onClose={() => {
          if (isMutating) return
          setDrawerOpen(false)
        }}
        onSaved={() => {
          setDrawerOpen(false)
          void refetchFromDbState(true)
        }}
      />

      <Modal
        open={chapterDialog.open}
        onClose={() => {
          if (isMutating || chapterDialogSaving || chapterArchiveSaving) return
          setChapterDialog(CLOSED_DIALOG_STATE)
        }}
        title={chapterDialog.mode === "create" ? "Add Chapter" : "Edit Chapter"}
        size="md"
      >
        <form id="chapter-form" className="flex max-h-[calc(100vh-13rem)] flex-col" onSubmit={handleSaveChapter}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
                  disabled={isMutating || chapterDialogSaving}
                >
                  Delete Chapter
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border)" }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChapterDialog(CLOSED_DIALOG_STATE)}
              disabled={isMutating || chapterDialogSaving || chapterArchiveSaving}
            >
              Cancel
            </Button>
            {chapterDialog.mode === "edit" && chapterDialog.targetId && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  void handleArchiveChapterFromDialog()
                }}
                disabled={isMutating || chapterDialogSaving || chapterArchiveSaving}
              >
                {chapterArchiveSaving ? "Archiving..." : "Archive Chapter"}
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isMutating || chapterDialogSaving || chapterArchiveSaving}
            >
              {chapterDialogSaving
                ? "Saving..."
                : chapterDialog.mode === "create"
                  ? "Add Chapter"
                  : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={archivedChapterModalOpen}
        onClose={() => {
          if (isMutating || archivedChapterLoading || archivedChapterPendingId) return
          setArchivedChapterModalOpen(false)
        }}
        title={selectedSubject
          ? `Archived Chapters (${archivedChapterRows.length})`
          : "Archived Chapters"}
        size="md"
      >
        <div className="space-y-3">
          {archivedChapterLoading ? (
            <div
              className="rounded-lg border border-dashed px-3 py-4 text-sm"
              style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
            >
              Loading archived chapters...
            </div>
          ) : archivedChapterRows.length === 0 ? (
            <div
              className="rounded-lg border border-dashed px-3 py-4 text-sm"
              style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
            >
              No archived chapters for this subject.
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {archivedChapterRows.map((chapter) => {
                const isPending = archivedChapterPendingId === chapter.id

                return (
                  <div
                    key={chapter.id}
                    className="rounded-lg border p-2"
                    style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex items-center gap-2">
                      <p
                        className="min-w-0 flex-1 truncate text-sm font-medium"
                        style={{ color: "var(--sh-text-primary)" }}
                        title={chapter.name}
                      >
                        {chapter.name}
                      </p>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isMutating || isPending || archivedChapterLoading}
                        onClick={() => {
                          void handleRestoreArchivedChapter(chapter.id)
                        }}
                      >
                        Restore
                      </Button>

                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={isMutating || isPending || archivedChapterLoading}
                        onClick={() => {
                          void handleDeleteArchivedChapter(chapter.id, chapter.name)
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setArchivedChapterModalOpen(false)}
              disabled={isMutating || !!archivedChapterPendingId}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <NameModal
        open={taskDialog.open}
        title="Edit Task"
        fieldLabel="Task Title"
        value={taskDialog.value}
        placeholder="e.g. Solve past-paper set 1"
        submitLabel="Save Task"
        loading={taskDialogSaving || isMutating}
        onChange={(value) => setTaskDialog((previous) => ({ ...previous, value }))}
        onClose={() => {
          if (isMutating || taskDialogSaving) return
          setTaskDialog(CLOSED_DIALOG_STATE)
        }}
        onSubmit={handleSaveTaskTitle}
      />

      <Modal
        open={dependencyModalOpen}
        onClose={() => {
          if (isMutating || dependencySaving) return
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
                disabled={isMutating || dependencyLoading || dependencySaving}
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
                    disabled={isMutating || dependencySaving}
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
              disabled={isMutating || dependencySaving || dependencySelectedIds.size === 0}
            >
              Clear
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDependencyModalOpen(false)}
                disabled={isMutating || dependencySaving}
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
                disabled={isMutating || dependencySaving || dependencyLoading || !dependencyTargetChapterId}
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
          if (taskComposerSaving || isMutating) return
          setTaskComposerOpen(false)
          resetTaskComposerFields()
        }}
        title="Add Tasks"
        size="md"
      >
        <form className="flex max-h-[calc(100vh-13rem)] flex-col" onSubmit={handleCreateTasks}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
                disabled={isMutating || taskComposerSaving}
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
                disabled={isMutating || taskComposerSaving}
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

                <Input
                  required
                  label="Count"
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(event) => setBulkCount(event.target.value)}
                />

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
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border)" }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setTaskComposerOpen(false)
                resetTaskComposerFields()
              }}
              disabled={isMutating || taskComposerSaving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isMutating || taskComposerSaving}>
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
      className="group rounded-lg border px-2 py-1.5 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={!canEdit}
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

        <div className="min-w-0 flex-1 flex items-center gap-2">
          <p
            className={`min-w-0 flex-1 text-[13px] font-medium ${task.completed ? "line-through opacity-60" : ""} truncate`}
            style={{ color: "var(--sh-text-primary)" }}
            title={task.title}
          >
            {task.title}
          </p>

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
            className="ui-input h-7 text-xs text-center"
            style={{ width: "4.2rem" }}
            title="Task duration (minutes)"
          />

          {isDurationSaving && (
            <span className="text-[10px] shrink-0" style={{ color: "var(--sh-text-muted)" }}>
              Saving...
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
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
      className="w-[208px] min-w-[196px] h-full shrink-0 rounded-xl border px-2 py-2 snap-start flex flex-col overflow-hidden"
      style={{
        borderColor: "var(--sh-border)",
        background: "color-mix(in srgb, var(--sh-card) 94%, var(--foreground) 6%)",
      }}
    >
      <div className="px-1.5 pb-2 shrink-0">
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
          className="mt-2 space-y-1.5 border-t px-1 pt-2 shrink-0"
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
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  dragEnabled?: boolean
  isDragging?: boolean
}

function NavigationItemCard({
  item,
  isActive,
  onSelect,
  dragAttributes,
  dragListeners,
  dragEnabled = false,
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
          {...(dragEnabled ? (dragAttributes as object) : {})}
          {...(dragEnabled ? (dragListeners as object) : {})}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[rgba(124,108,255,0.08)]"
          style={dragEnabled ? { touchAction: "none", cursor: isDragging ? "grabbing" : "grab" } : undefined}
          title={dragEnabled ? `Drag to reorder ${item.label}` : undefined}
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
        dragEnabled={reorderEnabled}
        dragAttributes={attributes}
        dragListeners={listeners}
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
