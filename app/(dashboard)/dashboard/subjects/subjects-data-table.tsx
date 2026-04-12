"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  addChapter,
  archiveChapter,
  deleteChapter,
  unarchiveChapter,
  updateChapter,
} from "@/app/actions/subjects/chapters"
import {
  bulkCreateSubjectTasks,
  createSubjectTask,
  deleteSubjectTasks,
  deleteSubjectTask,
  reorderTasks,
  updateSubjectTaskTitle,
} from "@/app/actions/subjects/tasks"
import { setSubjectTaskCompletion } from "@/app/actions/subjects/setSubjectTaskCompletion"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
import { useSidebar } from "@/app/components/layout/AppShell"
import { PageHeader } from "@/app/components/layout/PageHeader"
import { useToast } from "@/app/components/Toast"
import { Button, Input, Modal } from "@/app/components/ui"
import { SubjectDrawer } from "./SubjectDrawer"

export interface SubjectNavTopic {
  id: string
  name: string
}

export interface SubjectNavChapter {
  id: string
  name: string
  archived?: boolean
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
}

interface Props {
  initialSubjects: SubjectNavItem[]
  initialTasksByChapter: Record<string, TopicTaskItem[]>
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
}

type TaskCreateMode = "single" | "bulk"
type NumberPlacement = "suffix" | "prefix"

const CLOSED_DIALOG_STATE: NameDialogState = {
  open: false,
  mode: "create",
  targetId: null,
  value: "",
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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

export function SubjectsDataTable({ initialSubjects, initialTasksByChapter }: Props) {
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

  const [taskDialog, setTaskDialog] = useState<NameDialogState>(CLOSED_DIALOG_STATE)
  const [taskDialogSaving, setTaskDialogSaving] = useState(false)

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

  const [manageMode, setManageMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [deletingSelectedTasks, setDeletingSelectedTasks] = useState(false)

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [manualOrderChapterIds, setManualOrderChapterIds] = useState<Set<string>>(new Set())
  const [reorderingTaskIds, setReorderingTaskIds] = useState<string[]>([])

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

  useEffect(() => {
    setSelectedTaskIds(new Set())
    setManageMode(false)
  }, [selectedChapter?.id, showArchived])

  const chapterTasks = useMemo(
    () => (selectedChapter ? tasksByChapter[selectedChapter.id] ?? [] : []),
    [selectedChapter, tasksByChapter]
  )
  const completedCount = chapterTasks.filter((task) => task.completed).length
  const visibleTasks = chapterTasks

  const subjectColumnItems: ColumnItem[] = displaySubjects.map((subject) => ({
    id: subject.id,
    label: subject.name,
    hint: `${subject.chapters.length} chapter${subject.chapters.length === 1 ? "" : "s"}`,
    onEdit: showArchived ? undefined : () => openEditSubject(subject.id),
    onDelete:
      showArchived
        ? undefined
        : () => {
            void handleDeleteSubject(subject.id, subject.name)
          },
  }))

  const chapterColumnItems: ColumnItem[] = (selectedSubject?.chapters ?? []).map((chapter) => ({
    id: chapter.id,
    label: chapter.name,
    hint: `${(tasksByChapter[chapter.id] ?? []).length} task${(tasksByChapter[chapter.id] ?? []).length === 1 ? "" : "s"}`,
    onEdit: showArchived ? undefined : () => openEditChapter(chapter.id, chapter.name),
    onDelete:
      showArchived
        ? undefined
        : () => {
            void handleDeleteChapter(chapter.id, chapter.name)
          },
  }))

  const allVisibleSelected =
    visibleTasks.length > 0 && visibleTasks.every((task) => selectedTaskIds.has(task.id))

  const selectedDetailTitle = selectedChapter?.name ?? "Overview"
  const editingChapterArchived =
    chapterDialog.mode === "edit"
    && !!chapterDialog.targetId
    && !!selectedSubject?.chapters.find((chapter) => chapter.id === chapterDialog.targetId)?.archived

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
    })
  }

  function openEditChapter(chapterId: string, chapterName: string) {
    setSelectedChapterId(chapterId)
    setChapterDialog({
      open: true,
      mode: "edit",
      targetId: chapterId,
      value: chapterName,
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

    await handleToggleChapterArchive(selectedChapterId, false)
  }

  async function handleUnarchiveChapter() {
    if (!selectedChapterId || pendingChapterId) return

    await handleToggleChapterArchive(selectedChapterId, true)
  }

  async function handleToggleChapterArchive(chapterId: string, archived: boolean) {
    if (pendingChapterId) return

    setPendingChapterId(chapterId)

    try {
      const result = archived ? await unarchiveChapter(chapterId) : await archiveChapter(chapterId)

      if (result.status === "SUCCESS") {
        addToast(archived ? "Chapter restored." : "Chapter archived.", "success")
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

    const reorderedChapterTasks = arrayMove(visibleTasks, fromIndex, toIndex)

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
      const result = await updateChapter(chapterDialog.targetId, chapterDialog.value)

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

  async function handleDeleteSubject(subjectId: string, subjectName: string) {
    if (!window.confirm(`Delete subject "${subjectName}"? This cannot be undone.`)) {
      return
    }

    const result = await deleteSubject(subjectId)
    if (result.status === "SUCCESS") {
      addToast("Subject deleted.", "success")
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

  async function handleCreateTasks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedChapter) {
      addToast("Select a chapter first.", "error")
      return
    }

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
    if (!(tasksByChapter[chapterId] ?? []).some((task) => task.id === taskId)) return

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

      router.refresh()
    } catch {
      addToast("Could not update task status.", "error")
    } finally {
      setPendingTaskIds((current) => {
        const next = new Set(current)
        next.delete(taskId)
        return next
      })
    }
  }

  return (
    <div className="page-root fade-in flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden" style={{ paddingTop: 12, paddingBottom: 16 }}>
      <PageHeader title="Subjects" />

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-3 sm:p-4"
        style={{
          borderColor: "var(--sh-border)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
          boxShadow: "var(--sh-shadow-sm)",
        }}
      >
        {displaySubjects.length === 0 && (
          <div
            className="mb-3 rounded-xl border p-4"
            style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
              {showArchived ? "No archived subjects." : "No subjects yet."}
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

          <div
            className="flex h-full min-h-0 flex-1 items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory"
          >
            <NavigationColumn
              title="Subjects"
              items={subjectColumnItems}
              activeId={selectedSubjectId}
              emptyMessage="No subjects available."
              onSelect={setSelectedSubjectId}
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
                    onClick={handleArchiveSelected}
                    disabled={!selectedSubject || pendingSubjectId === selectedSubject.id}
                  >
                    {selectedSubject?.archived ? "Restore Subject" : "Archive Subject"}
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
              footer={
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={openCreateChapter}
                    disabled={!selectedSubject || showArchived}
                  >
                    Add Chapter
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={selectedChapter?.archived ? handleUnarchiveChapter : handleArchiveChapter}
                    disabled={!selectedChapter || pendingChapterId === selectedChapter.id}
                  >
                    {selectedChapter?.archived ? "Restore Chapter" : "Archive Chapter"}
                  </Button>
                </>
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
                  </nav>

                  <div className="mt-3 flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2
                        className="text-2xl font-bold tracking-tight"
                        style={{ color: "var(--sh-text-primary)" }}
                      >
                        {selectedDetailTitle}
                      </h2>
                      <p className="mt-1 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                        {completedCount}/{chapterTasks.length} tasks completed
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--sh-text-muted)" }}>
                        Add tasks and bulk-create series from this overview panel.
                      </p>
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
                    </div>
                  </div>

                  {manageMode && (
                    <section
                      className="mt-2 rounded-lg border p-2.5"
                      style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.015)" }}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                            {selectedTaskIds.size} selected
                          </span>

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
                    </section>
                  )}

                  <div className="mt-3 min-h-[55%] flex-1 overflow-y-auto pr-1">
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
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {visibleTasks.map((task) => (
                                <DraggableTaskRow
                                  key={task.id}
                                  task={task}
                                  isPending={pendingTaskIds.has(task.id)}
                                  isReordering={reorderingTaskIds.includes(task.id)}
                                  showFullTitle={sidebarExpanded}
                                  canEdit={!showArchived}
                                  onToggle={(nextCompleted) => handleToggleTask(task.id, nextCompleted)}
                                  onEdit={() => openEditTask(task.id, task.title)}
                                  onDelete={() => void handleDeleteTask(task.id, task.title)}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}

                      {visibleTasks.length > 0 && manageMode && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {visibleTasks.map((task) => {
                            const isPending = pendingTaskIds.has(task.id)

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
                                <div className={`flex gap-1.5 ${sidebarExpanded ? "items-start" : "items-center"}`}>
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

                                  <p
                                    className={`min-w-0 flex-1 text-[13px] font-medium ${task.completed ? "line-through opacity-60" : ""} ${sidebarExpanded ? "whitespace-normal break-words leading-[1.25]" : "truncate"}`}
                                    style={{ color: "var(--sh-text-primary)" }}
                                    title={task.title}
                                  >
                                    {task.title}
                                  </p>

                                  <RowActionButton
                                    label="Edit task title"
                                    onClick={() => openEditTask(task.id, task.title)}
                                    disabled={isPending || showArchived}
                                  />
                                  <RowActionButton
                                    label="Delete task"
                                    onClick={() => {
                                      void handleDeleteTask(task.id, task.title)
                                    }}
                                    danger
                                    disabled={isPending || showArchived}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
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
        </div>

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

      <NameModal
        open={chapterDialog.open}
        title={chapterDialog.mode === "create" ? "Add Chapter" : "Edit Chapter"}
        fieldLabel="Chapter Name"
        value={chapterDialog.value}
        placeholder="e.g. Limits and Continuity"
        submitLabel={chapterDialog.mode === "create" ? "Add Chapter" : "Save Chapter"}
        loading={chapterDialogSaving}
        onChange={(value) => setChapterDialog((previous) => ({ ...previous, value }))}
        onClose={() => setChapterDialog(CLOSED_DIALOG_STATE)}
        onSubmit={handleSaveChapter}
        destructiveActionLabel={chapterDialog.mode === "edit"
          ? (editingChapterArchived ? "Restore Chapter" : "Archive Chapter")
          : undefined}
        onDestructiveAction={chapterDialog.mode === "edit" && chapterDialog.targetId
          ? () => {
              void handleToggleChapterArchive(chapterDialog.targetId as string, editingChapterArchived)
            }
          : undefined}
        destructiveDisabled={chapterDialog.mode !== "edit"
          || !chapterDialog.targetId
          || chapterDialogSaving
          || pendingChapterId === chapterDialog.targetId}
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
                  hint="Adds leading zeros: 0 â†’ Lecture-1, 1 â†’ Lecture-01, 2 â†’ Lecture-001"
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
                    <option value="Â·">Dot: LectureÂ·1</option>
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
  isReordering: boolean
  showFullTitle: boolean
  canEdit: boolean
  onToggle: (completed: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

function DraggableTaskRow({
  task,
  isPending,
  isReordering,
  showFullTitle,
  canEdit,
  onToggle,
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
        cursor: isDragging ? "grabbing" : "grab",
      }}
      className="group rounded-lg border px-2.5 py-1.5 transition-colors"
    >
      <div className={`flex gap-1.5 ${showFullTitle ? "items-start" : "items-center"}`}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition-colors hover:bg-white/5 disabled:opacity-50"
          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <svg
            className="h-3 w-3"
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

        <p
          className={`min-w-0 flex-1 text-[13px] font-medium ${task.completed ? "line-through opacity-60" : ""} ${showFullTitle ? "whitespace-normal break-words leading-[1.25]" : "truncate"}`}
          style={{ color: "var(--sh-text-primary)" }}
          title={task.title}
        >
          {task.title}
        </p>

        <RowActionButton
          label="Edit task title"
          onClick={onEdit}
          disabled={isPending || !canEdit}
        />
        <RowActionButton
          label="Delete task"
          onClick={onDelete}
          danger
          disabled={isPending || !canEdit}
        />
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
  footer?: ReactNode
}

function NavigationColumn({
  title,
  items,
  activeId,
  emptyMessage,
  onSelect,
  footer,
}: NavigationColumnProps) {
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

        {items.map((item) => {
          const isActive = item.id === activeId

          return (
            <div
              key={item.id}
              className="rounded-lg border p-1.5 transition-colors"
              style={{
                borderColor: isActive ? "var(--sh-primary-glow)" : "transparent",
                background: isActive ? "var(--sh-primary-muted)" : "transparent",
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
        })}
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
  destructiveActionLabel?: string
  onDestructiveAction?: () => void
  destructiveDisabled?: boolean
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
  destructiveActionLabel,
  onDestructiveAction,
  destructiveDisabled = false,
}: NameModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form className="flex max-h-[calc(100vh-13rem)] flex-col" onSubmit={onSubmit}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Input
            autoFocus
            required
            label={fieldLabel}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border)" }}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {destructiveActionLabel && onDestructiveAction && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onDestructiveAction}
              disabled={destructiveDisabled}
            >
              {destructiveActionLabel}
            </Button>
          )}
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
