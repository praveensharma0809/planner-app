"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
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
import { Button } from "@/app/components/ui"
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
} from "@/app/components/subjects-data-table/helpers"
import {
  RowActionButton,
  type ColumnItem,
  NameModal,
} from "@/app/components/subjects-data-table/shared"
import { Step2ConstraintsSection } from "./subjects-data-table.step2"
import { ChapterEditorModal, ArchivedChaptersModal } from "./subjects-data-table.modals"
import { DependencyManagerModal } from "./subjects-data-table.dependencies"
import { TaskComposerModal } from "./subjects-data-table.taskComposer"
import { DraggableTaskRow } from "./subjects-data-table.taskRows"
import { NavigationColumn } from "./subjects-data-table.navigation"

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

// ColumnItem and RowActionButton are shared across the planner + dashboard
// subjects tables — see app/components/subjects-data-table/shared.tsx.

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
  const { mode } = useSidebar()
  const sidebarExpanded = mode === "locked-open"
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
  const [reorderBusy, setReorderBusy] = useState<{ type: "tasks"; ids: string[] } | { type: "subjects" } | { type: "chapters" } | null>(null)

  const [mobilePane, setMobilePane] = useState<"subjects" | "chapters" | "tasks">("subjects")

  const handleSelectSubject = useCallback((id: string) => {
    setSelectedSubjectId(id)
    setMobilePane("chapters")
  }, [])

  const handleSelectChapter = useCallback((id: string) => {
    setSelectedChapterId(id)
    setMobilePane("tasks")
  }, [])

  const [importBusy, setImportBusy] = useState<"all" | "undone" | "reset" | null>(null)
  const [intakeImportMode, setIntakeImportMode] = useState<IntakeImportMode>(initialImportMode)

  const [dependencyModalOpen, setDependencyModalOpen] = useState(false)
  const [dependencyScope, setDependencyScope] = useState<DependencyScope>("chapter")
  const [dependencyTargetChapterId, setDependencyTargetChapterId] = useState("")
  const [dependencySelectedIds, setDependencySelectedIds] = useState<Set<string>>(new Set())
  const [dependencySearch, setDependencySearch] = useState("")
  const [dependencyBusy, setDependencyBusy] = useState<"loading" | "saving" | null>(null)
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
  // Memoize so the reference is stable across renders that don't actually
  // change the underlying list — the selection-sync effects below use this
  // as a dep, and a fresh array every render would loop them indefinitely.
  const displaySubjects = useMemo(
    () => (showArchived ? archivedSubjects : activeSubjects),
    [showArchived, archivedSubjects, activeSubjects]
  )

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

  const selectedSubject = useMemo(
    () => displaySubjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [displaySubjects, selectedSubjectId]
  )

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

  const selectedChapter = useMemo(
    () =>
      selectedSubject?.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [selectedSubject, selectedChapterId]
  )

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
    setReorderBusy(null)
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

      setReorderBusy({ type: "tasks", ids: orderedChapterTaskIds })

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
      setReorderBusy(null)
      endMutation()
    }
  }

  useEffect(() => {
    if (!selectedChapter || showArchived) return
    if ((reorderBusy?.type === "tasks" ? reorderBusy.ids.length : 0) > 0) return
    if (mutationLockRef.current) return

    const chapterId = selectedChapter.id
    if (manualOrderChapterIds.has(chapterId)) return
    if (!shouldAutoOrderTasks(chapterTasks)) return

    const autoOrderedTasks = [...chapterTasks].sort(compareTasksNaturally)
    const unchanged = autoOrderedTasks.every((task, index) => task.id === chapterTasks[index]?.id)
    if (unchanged) return

    const orderedTaskIds = autoOrderedTasks.map((task) => task.id)
    setReorderBusy({ type: "tasks", ids: orderedTaskIds })

    let alive = true

    void (async () => {
      if (!beginMutation()) {
        if (alive) {
          setReorderBusy(null)
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
          setReorderBusy(null)
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
  }, [chapterTasks, manualOrderChapterIds, reorderBusy, selectedChapter, showArchived, showMutationError])


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
    if (showArchived || reorderBusy?.type === "subjects") return
    if (orderedIds.length <= 1) return

    if (!beginMutation()) return
    setReorderBusy({ type: "subjects" })

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
      setReorderBusy(null)
      endMutation()
    }
  }

  async function handleReorderChapters(orderedIds: string[]) {
    if (showArchived || reorderBusy?.type === "chapters" || !selectedSubject) return
    if (orderedIds.length <= 1) return

    if (!beginMutation()) return

    setReorderBusy({ type: "chapters" })
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
      setReorderBusy(null)
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
      setImportBusy(mode === "undone" ? "undone" : "all")
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
      setReorderBusy(null)
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
        setImportBusy(null)
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

    setImportBusy("reset")
    try {
      resetTransientIntakeState()

      const imported = await refetchFromDbState(true)

      if (imported) {
        addToast("Reloaded saved intake data.", "success")
      }
    } catch (error) {
      showMutationError(error, "Could not reset intake view.")
    } finally {
      setImportBusy(null)
      endMutation()
    }
  }

  function openDependencyManager(scope: DependencyScope) {
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
    setDependencySelectedIds(new Set())
    setDependencyModalOpen(true)
  }

  useEffect(() => {
    if (!dependencyModalOpen || !dependencyTargetChapterId) return

    let alive = true
    setDependencyBusy("loading")
    void (async () => {
      try {
        const map = await loadTopicParamsSnapshot(true)
        if (!alive) return
        const rawDependsOn = map.get(dependencyTargetChapterId)?.depends_on ?? []

        if (dependencyScope === "subject") {
          // Subject-scope deps are persisted as fan-out across chapters: the anchor
          // chapter's depends_on contains chapter IDs from other subjects. Reduce
          // those back to the unique set of source subject IDs for the picker.
          const subjectIds = new Set<string>()
          for (const chapterId of rawDependsOn) {
            const chapter = chapterById.get(chapterId)
            if (chapter) subjectIds.add(chapter.subjectId)
          }
          setDependencySelectedIds(subjectIds)
        } else {
          setDependencySelectedIds(new Set(rawDependsOn))
        }
      } catch (error) {
        if (alive) showMutationError(error, "Could not load dependencies.")
      } finally {
        if (alive) setDependencyBusy(null)
      }
    })()

    return () => {
      alive = false
    }
  }, [chapterById, dependencyModalOpen, dependencyScope, dependencyTargetChapterId, loadTopicParamsSnapshot, showMutationError])

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

  function buildTopicParamPayload(
    targetChapter: SubjectNavChapter & { subjectId: string; subjectName: string },
    dependsOn: string[],
  ) {
    const existing = topicParamsByTopic.get(targetChapter.id)
    const chapterTasks = tasksByChapter[targetChapter.id] ?? []
    const chapterTaskMinutes = chapterTasks.reduce(
      (sum, task) => sum + Math.max(0, task.durationMinutes),
      0,
    )
    const chapterTaskDurations = chapterTasks.map((task) => Math.max(0, task.durationMinutes))
    const derivedHours = Math.max(0, Math.round((chapterTaskMinutes / 60) * 10) / 10)
    const estimatedHours = existing?.estimated_hours
      ? existing.estimated_hours
      : derivedHours > 0 ? derivedHours : 1

    return {
      topic_id: targetChapter.id,
      estimated_hours: estimatedHours,
      deadline: existing?.deadline ?? null,
      earliest_start: existing?.earliest_start ?? targetChapter.earliestStart ?? null,
      depends_on: dependsOn,
      session_length_minutes: inferSessionLengthMinutes(
        chapterTaskDurations,
        existing?.session_length_minutes,
      ),
      rest_after_days: existing?.rest_after_days ?? Math.max(0, targetChapter.restAfterDays ?? 0),
      max_sessions_per_day: existing?.max_sessions_per_day ?? 0,
      study_frequency: existing?.study_frequency ?? "daily",
    }
  }

  async function handleSaveDependencies() {
    if (!dependencyTargetChapterId) {
      addToast("Select a chapter first.", "error")
      return
    }

    if (!beginMutation()) return
    setDependencyBusy("saving")

    try {
      let payload: ReturnType<typeof buildTopicParamPayload>[]

      if (dependencyScope === "subject") {
        if (!selectedSubject || selectedSubject.chapters.length === 0) {
          addToast("Select a subject with at least one chapter.", "error")
          return
        }

        // Resolve each selected dep subject to its anchor chapter (the last chapter
        // of that subject acts as the prerequisite — its completion implies the
        // whole subject is done).
        const anchorChapterIds: string[] = []
        for (const subjectId of dependencySelectedIds) {
          if (subjectId === selectedSubject.id) continue
          const depSubject = activeSubjects.find((subject) => subject.id === subjectId)
          if (!depSubject || depSubject.chapters.length === 0) continue
          const anchor = depSubject.chapters[depSubject.chapters.length - 1]
          if (anchor) anchorChapterIds.push(anchor.id)
        }

        // Fan-out: every chapter in the target subject takes the same set of
        // anchor prerequisites so the dependency holds at the subject level.
        payload = selectedSubject.chapters.map((chapter) => {
          const enriched = { ...chapter, subjectId: selectedSubject.id, subjectName: selectedSubject.name }
          const dependsOn = anchorChapterIds.filter((id) => id !== chapter.id)
          return buildTopicParamPayload(enriched, dependsOn)
        })
      } else {
        const chapter = chapterById.get(dependencyTargetChapterId)
        if (!chapter) {
          addToast("Selected chapter could not be found.", "error")
          return
        }

        const dependsOn = Array.from(dependencySelectedIds).filter(
          (id) => id !== dependencyTargetChapterId,
        )
        payload = [buildTopicParamPayload(chapter, dependsOn)]
      }

      const result = await saveTopicParams(payload)

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
      setDependencyBusy(null)
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
    // Subject scope: surface the subject as a single read-only target. Per-chapter
    // selection inside a subject is handled by fan-out at save time.
    return [{
      id: selectedSubject.id,
      label: selectedSubject.name,
    }]
  }, [dependencyScope, selectedChapter, selectedSubject])

  const dependencyCandidates = useMemo(() => {
    const query = dependencySearch.trim().toLowerCase()
    const targetSubjectId = selectedSubject?.id ?? null

    if (dependencyScope === "subject") {
      return activeSubjects
        .filter((subject) => subject.id !== targetSubjectId)
        .filter((subject) => {
          if (!query) return true
          return subject.name.toLowerCase().includes(query)
        })
        .map((subject) => ({
          id: subject.id,
          name: subject.name,
          subjectName: "",
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    }

    return allActiveChapters
      .filter((chapter) => chapter.id !== dependencyTargetChapterId)
      .filter((chapter) => {
        if (!targetSubjectId) return true
        return chapter.subjectId === targetSubjectId
      })
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
  }, [activeSubjects, allActiveChapters, dependencyScope, dependencySearch, dependencyTargetChapterId, selectedSubject])

  const onStudyStartDateChange = useCallback((value: string) => {
    setConstraintsDraft((previous) => ({ ...previous, study_start_date: value }))
  }, [])

  const onExamDateChange = useCallback((value: string) => {
    setConstraintsDraft((previous) => ({ ...previous, exam_date: value }))
  }, [])

  const onWeekdayCapacityChange = useCallback((value: string) => {
    setConstraintsDraft((previous) => ({
      ...previous,
      weekday_capacity_minutes: Math.max(0, Number.parseInt(value || "0", 10) || 0),
    }))
  }, [])

  const onWeekendCapacityChange = useCallback((value: string) => {
    setConstraintsDraft((previous) => ({
      ...previous,
      weekend_capacity_minutes: Math.max(0, Number.parseInt(value || "0", 10) || 0),
    }))
  }, [])

  const onFlexibilityMinutesChange = useCallback((value: string) => {
    setConstraintsDraft((previous) => ({
      ...previous,
      flexibility_minutes: Math.max(0, Number.parseInt(value || "0", 10) || 0),
    }))
  }, [])

  const onMaxActiveSubjectsChange = useCallback((value: string) => {
    setConstraintsDraft((previous) => ({
      ...previous,
      max_active_subjects: Math.max(0, Number.parseInt(value || "0", 10) || 0),
    }))
  }, [])

  const onPreviousCalendarMonth = useCallback(() => {
    setCalendarMonthCursor((previous) => shiftMonthCursor(previous, -1))
  }, [])

  const onNextCalendarMonth = useCallback(() => {
    setCalendarMonthCursor((previous) => shiftMonthCursor(previous, 1))
  }, [])

  const onToggleCustomDate = useCallback((isoDate: string) => {
    setSelectedCustomDates((previous) => {
      const next = new Set(previous)
      if (next.has(isoDate)) next.delete(isoDate)
      else next.add(isoDate)
      return next
    })
  }, [])

  const onCustomCapacityMinutesInputChange = useCallback((value: string) => {
    setCustomCapacityMinutesInput(value)
  }, [])

  const onClearCustomDateSelection = useCallback(() => {
    setSelectedCustomDates(new Set())
  }, [])

  return (
    <div
      className={`${embedded ? "flex min-h-0 flex-1 flex-col" : "page-root "}fade-in max-w-none`}
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
          <div className="mb-3 rounded-xl border border-border-hairline bg-surface-panel-muted p-4">
            <p className="text-base font-medium text-text-primary">
              {showArchived ? "No archived subjects." : "No active subjects."}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {showArchived
                ? "Archive a subject to see it in this view."
                : "Create your first subject to start building your structure."}
            </p>
          </div>
        )}

          {/* Mobile pane tabs */}
          <div className="mb-3 md:hidden">
            <div className="flex rounded-full bg-surface-page p-1 gap-1">
              {(["subjects", "chapters", "tasks"] as const).map((pane) => (
                <button
                  key={pane}
                  type="button"
                  onClick={() => setMobilePane(pane)}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors min-h-[44px] ${
                    mobilePane === pane
                      ? "bg-surface-card shadow-[var(--shadow-card)] text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {pane.charAt(0).toUpperCase() + pane.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2 overflow-x-auto">
            <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
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
                disabled={isMutating || importBusy !== null}
              >
                {importBusy === "all" ? "Importing..." : "Import All"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  void handleImportModeClick("undone")
                }}
                disabled={isMutating || importBusy !== null}
              >
                {importBusy === "undone" ? "Importing..." : "Import Undone Only"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  void handleResetIntakeView()
                }}
                disabled={isMutating || importBusy !== null}
              >
                {importBusy === "reset" ? "Resetting..." : "Reload Saved Intake Data"}
              </Button>
            </div>
          </div>

          <div className="flex h-full min-h-0 flex-1 flex-col gap-[var(--gap-card)] md:gap-[var(--gap-card-md)] md:flex-row overflow-hidden">
            {/* Subjects pane */}
            <div className={`${mobilePane === "subjects" ? "flex" : "hidden"} md:flex md:w-[45%] lg:w-[220px] flex-col min-h-0 overflow-y-auto`}>
              <NavigationColumn
                title="Subjects"
                items={subjectColumnItems}
                activeId={selectedSubjectId}
                emptyMessage="No subjects available."
                onSelect={handleSelectSubject}
                reorderEnabled={!showArchived && reorderBusy?.type !== "subjects" && importBusy === null}
                onReorder={(orderedIds) => {
                  void handleReorderSubjects(orderedIds)
                }}
                footer={
                  <>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full justify-center min-h-[44px] md:min-h-0"
                      onClick={openCreateSubject}
                      disabled={isMutating || showArchived}
                    >
                      Add Subject
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center min-h-[44px] md:min-h-0"
                      onClick={() => {
                        openDependencyManager("subject")
                      }}
                      disabled={isMutating || showArchived || !selectedSubject || selectedSubject.chapters.length === 0}
                    >
                      Set Dependencies
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center min-h-[44px] md:min-h-0"
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
            </div>

            {/* Chapters pane */}
            <div className={`${mobilePane === "chapters" ? "flex" : "hidden"} md:flex md:w-[45%] lg:w-[220px] flex-col min-h-0 overflow-y-auto`}>
              <NavigationColumn
                title="Chapters"
                items={chapterColumnItems}
                activeId={selectedChapterId}
                emptyMessage="No chapters in this subject."
                onSelect={handleSelectChapter}
                reorderEnabled={!showArchived && !!selectedSubject && reorderBusy?.type !== "chapters"}
                onReorder={(orderedIds) => {
                  void handleReorderChapters(orderedIds)
                }}
                footer={
                  <>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full justify-center min-h-[44px] md:min-h-0"
                      onClick={openCreateChapter}
                      disabled={isMutating || !selectedSubject || showArchived}
                    >
                      Add Chapter
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center min-h-[44px] md:min-h-0"
                      onClick={() => {
                        openDependencyManager("chapter")
                      }}
                      disabled={isMutating || showArchived || !selectedChapter}
                    >
                      Set Dependencies
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center min-h-[44px] md:min-h-0"
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
            </div>

            {/* Tasks pane */}
            <div className={`${mobilePane === "tasks" ? "flex" : "hidden"} md:flex flex-col min-h-0 flex-1`}>
              <section
                className="h-full flex-1 surface-card px-4 py-4 sm:px-5 sm:py-5 overflow-hidden flex flex-col"
              >
                {selectedSubject && selectedChapter ? (
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="mt-3 flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-2xl font-medium tracking-tight text-text-primary">
                          {selectedDetailTitle}
                        </h2>
                      </div>

                      <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="primary"
                          size="md"
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
                      <section className="mt-2 h-[64px] rounded-xl border border-border-hairline bg-surface-panel-muted p-2 flex flex-col overflow-hidden">
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

                    <section className="mt-3 min-h-0 flex-1 rounded-xl border border-border-hairline bg-surface-card p-2 flex flex-col">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Tasks Overview
                        </p>
                        <div className="flex items-center gap-4 text-sm text-text-secondary">
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
                          <div className="rounded-xl border border-dashed border-border-hairline px-4 py-6 text-center text-sm text-text-muted">
                            No tasks available.
                          </div>
                        )}

                        {visibleTasks.length > 0 && completedCount === chapterTasks.length && (
                          <div className="rounded-xl border border-dashed border-border-hairline px-4 py-3 text-center text-xs text-text-muted">
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
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Duration
                                  </span>
                                </div>
                                <div className="hidden xl:flex justify-end pr-[76px]">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Duration
                                  </span>
                                </div>
                              </div>
                              <div className="mb-1 grid grid-cols-1 gap-2 xl:grid-cols-2">
                                <div className="flex justify-end pr-[76px]">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Duration
                                  </span>
                                </div>
                                <div className="hidden xl:flex justify-end pr-[76px]">
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
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
                                    isReordering={reorderBusy?.type === "tasks" && reorderBusy.ids.includes(task.id)}
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
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                  Duration
                                </span>
                              </div>
                              <div className="hidden xl:flex justify-end pr-[76px]">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
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
                                  className={`group rounded-xl px-2 py-2 transition-colors ${task.completed ? "bg-pastel-mint/40" : "hover:bg-surface-hover"}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedTaskIds.has(task.id)}
                                      onChange={() => toggleTaskSelection(task.id)}
                                      className="h-4 w-4 rounded border border-border-subtle"
                                      aria-label="Select task"
                                      disabled={isMutating}
                                    />

                                    <button
                                      type="button"
                                      onClick={() => handleToggleTask(task.id, !task.completed)}
                                      disabled={isMutating || isPending || showArchived || isManageOpen}
                                      className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[5px] transition-colors disabled:opacity-50 md:min-h-0 md:min-w-0 ${task.completed ? "border-2 border-black bg-black" : "border-2 border-border-subtle hover:border-text-primary bg-transparent"}`}
                                      aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                                    >
                                      <span className="flex h-[18px] w-[18px] items-center justify-center">
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
                                      </span>
                                    </button>

                                    <div className="min-w-0 flex-1 flex items-center gap-2">
                                      <p
                                        className={`min-w-0 flex-1 text-[13px] font-medium ${task.completed ? "line-through text-text-muted" : "text-text-primary"} truncate`}
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
                  <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border-hairline text-sm text-text-muted">
                    Select a subject and chapter to view details.
                  </div>
                )}
              </section>
            </div>
          </div>

          <Step2ConstraintsSection
            constraintsLoading={constraintsLoading}
            constraintsDraft={constraintsDraft}
            hasStep2DateError={hasStep2DateError}
            step2CalendarLabel={step2CalendarLabel}
            step2CalendarWeeks={step2CalendarWeeks}
            selectedCustomDates={selectedCustomDates}
            customCapacityMinutesInput={customCapacityMinutesInput}
            customCapacityEntries={customCapacityEntries}
            isMutating={isMutating}
            constraintsSaving={constraintsSaving}
            onStudyStartDateChange={onStudyStartDateChange}
            onExamDateChange={onExamDateChange}
            onWeekdayCapacityChange={onWeekdayCapacityChange}
            onWeekendCapacityChange={onWeekendCapacityChange}
            onDayOfWeekCapacityChange={updateDayOfWeekCapacity}
            onPreviousCalendarMonth={onPreviousCalendarMonth}
            onNextCalendarMonth={onNextCalendarMonth}
            onToggleCustomDate={onToggleCustomDate}
            onCustomCapacityMinutesInputChange={onCustomCapacityMinutesInputChange}
            onApplyCustomCapacity={handleAddCustomCapacityDate}
            onClearCustomDateSelection={onClearCustomDateSelection}
            onRemoveCustomCapacityDate={handleRemoveCustomCapacityDate}
            onFlexibilityMinutesChange={onFlexibilityMinutesChange}
            onMaxActiveSubjectsChange={onMaxActiveSubjectsChange}
            onSaveConstraints={() => { void handleSaveConstraints() }}
          />
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

      <ChapterEditorModal
        open={chapterDialog.open}
        isMutating={isMutating}
        chapterDialogSaving={chapterDialogSaving}
        chapterArchiveSaving={chapterArchiveSaving}
        mode={chapterDialog.mode}
        targetId={chapterDialog.targetId}
        value={chapterDialog.value}
        earliestStart={chapterDialog.earliestStart ?? ""}
        deadline={chapterDialog.deadline ?? ""}
        restAfterDays={chapterDialog.restAfterDays ?? "0"}
        onClose={() => setChapterDialog(CLOSED_DIALOG_STATE)}
        onValueChange={(value) => setChapterDialog((previous) => ({ ...previous, value }))}
        onEarliestStartChange={(value) => setChapterDialog((previous) => ({ ...previous, earliestStart: value }))}
        onDeadlineChange={(value) => setChapterDialog((previous) => ({ ...previous, deadline: value }))}
        onRestAfterDaysChange={(value) => setChapterDialog((previous) => ({ ...previous, restAfterDays: value }))}
        onSubmit={(event) => handleSaveChapter(event)}
        onArchive={() => { void handleArchiveChapterFromDialog() }}
        onDelete={(targetId, targetName) => { void handleDeleteChapter(targetId, targetName) }}
      />

      <ArchivedChaptersModal
        open={archivedChapterModalOpen}
        isMutating={isMutating}
        loading={archivedChapterLoading}
        pendingId={archivedChapterPendingId}
        subjectTitle={selectedSubject?.name ?? null}
        rows={archivedChapterRows}
        onClose={() => setArchivedChapterModalOpen(false)}
        onRestore={(chapterId) => { void handleRestoreArchivedChapter(chapterId) }}
        onDelete={(chapterId, chapterName) => { void handleDeleteArchivedChapter(chapterId, chapterName) }}
      />

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

      <DependencyManagerModal
        dependencyModalOpen={dependencyModalOpen}
        dependencyScope={dependencyScope}
        dependencyTargetOptions={dependencyTargetOptions}
        dependencySearch={dependencySearch}
        dependencyCandidates={dependencyCandidates}
        dependencySelectedIds={dependencySelectedIds}
        dependencyBusy={dependencyBusy}
        isMutating={isMutating}
        dependencyTargetChapterId={dependencyTargetChapterId}
        setDependencyModalOpen={setDependencyModalOpen}
        setDependencySearch={setDependencySearch}
        toggleDependencySelection={toggleDependencySelection}
        setDependencySelectedIds={setDependencySelectedIds}
        handleSaveDependencies={() => { void handleSaveDependencies() }}
      />

      <TaskComposerModal
        open={taskComposerOpen}
        isMutating={isMutating}
        saving={taskComposerSaving}
        taskCreateMode={taskCreateMode}
        singleTaskTitle={singleTaskTitle}
        bulkBaseName={bulkBaseName}
        bulkCount={bulkCount}
        bulkPreview={bulkPreview}
        onClose={() => {
          setTaskComposerOpen(false)
          resetTaskComposerFields()
        }}
        onSubmit={(event) => handleCreateTasks(event)}
        onTaskCreateModeChange={setTaskCreateMode}
        onSingleTaskTitleChange={setSingleTaskTitle}
        onBulkBaseNameChange={setBulkBaseName}
        onBulkCountChange={setBulkCount}
      />
    </div>
  )
}

