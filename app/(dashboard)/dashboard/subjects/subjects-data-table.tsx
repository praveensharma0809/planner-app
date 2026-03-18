"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"
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
  bulkCreateSubjectTasks,
  createSubjectTask,
  deleteSubjectTasks,
  deleteSubjectTask,
  reorderTasks,
  updateSubjectTaskTitle,
} from "@/app/actions/subjects/tasks"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
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
  clusterId: string | null
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

const NONE_CLUSTER_VALUE = "__none__"
const NEW_CLUSTER_VALUE = "__new__"
const ALL_CLUSTER_FILTER_VALUE = "__all__"
const UNCLUSTERED_FILTER_VALUE = "__unclustered__"

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

export function SubjectsDataTable({ initialSubjects, initialTasksByChapter }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
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
    setClusterFilterValue(ALL_CLUSTER_FILTER_VALUE)
    setSelectedTaskIds(new Set())
    setManageMode(false)
    setAssignClusterValue(NONE_CLUSTER_VALUE)
    setComposerClusterValue(NONE_CLUSTER_VALUE)
    setComposerNewClusterName("")
  }, [selectedChapter?.id, showArchived])

  const chapterTasks = selectedChapter ? tasksByChapter[selectedChapter.id] ?? [] : []
  const completedCount = chapterTasks.filter((task) => task.completed).length
  const chapterClusters = selectedChapter?.topics ?? []

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
    onDelete:
      showArchived
        ? undefined
        : () => {
            void handleDeleteChapter(chapter.id, chapter.name)
          },
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
    })
  }

  function openEditChapter(chapterId: string, chapterName: string) {
    setChapterDialog({
      open: true,
      mode: "edit",
      targetId: chapterId,
      value: chapterName,
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
      [selectedChapter.id]: reorderedChapterTasks,
    }))

    const result = await reorderTasks({
      chapterId: selectedChapter.id,
      taskIds: orderedChapterTaskIds,
    })

    if (result.status !== "SUCCESS") {
      addToast(result.status === "ERROR" ? result.message : "Failed to reorder tasks.", "error")
      router.refresh()
    }

    setReorderingTaskIds([])
  }


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

  return (
    <div className="page-root fade-in max-w-none" style={{ paddingTop: 12, paddingBottom: 16 }}>
      <PageHeader title="Subjects" />

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

                  <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
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
                        Add tasks, bulk-create series, and cluster tasks from this overview panel.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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

                    <div className="flex flex-wrap items-center gap-2">
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
                    className="mt-4 rounded-lg border p-3"
                    style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                        Clusters
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={openCreateCluster}
                        disabled={showArchived}
                      >
                        New Cluster
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <FilterChip
                        label={`All (${chapterTasks.length})`}
                        active={clusterFilterValue === ALL_CLUSTER_FILTER_VALUE}
                        onClick={() => setClusterFilterValue(ALL_CLUSTER_FILTER_VALUE)}
                      />
                      <FilterChip
                        label={`Unclustered (${unclusteredTaskCount})`}
                        active={clusterFilterValue === UNCLUSTERED_FILTER_VALUE}
                        onClick={() => setClusterFilterValue(UNCLUSTERED_FILTER_VALUE)}
                      />
                      {chapterClusters.map((cluster) => (
                        <FilterChip
                          key={cluster.id}
                          label={`${cluster.name} (${clusterTaskCounts.get(cluster.id) ?? 0})`}
                          active={clusterFilterValue === cluster.id}
                          onClick={() => setClusterFilterValue(cluster.id)}
                        />
                      ))}
                    </div>

                    {chapterClusters.length > 0 && !showArchived && (
                      <div className="mt-3 space-y-1.5">
                        {chapterClusters.map((cluster) => (
                          <div
                            key={`cluster-manage-${cluster.id}`}
                            className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
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
                      className="mt-3 rounded-lg border p-3"
                      style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.015)" }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                          {selectedTaskIds.size} selected
                        </span>

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

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
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
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {visibleTasks.map((task) => (
                                <DraggableTaskRow
                                  key={task.id}
                                  task={task}
                                  isPending={pendingTaskIds.has(task.id)}
                                  isReordering={reorderingTaskIds.includes(task.id)}
                                  clusterName={task.clusterId ? clusterNameById.get(task.clusterId) ?? null : null}
                                  showClusterBadge={clusterFilterValue === ALL_CLUSTER_FILTER_VALUE}
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
                        <div className="space-y-2">
                          {visibleTasks.map((task) => {
                            const isPending = pendingTaskIds.has(task.id)
                            const clusterName = task.clusterId ? clusterNameById.get(task.clusterId) ?? null : null

                            return (
                              <div
                                key={task.id}
                                className="group rounded-lg border px-3 py-2 transition-colors"
                                style={{
                                  borderColor: "var(--sh-border)",
                                  background: task.completed
                                    ? "rgba(52, 211, 153, 0.08)"
                                    : "rgba(255, 255, 255, 0.02)",
                                }}
                              >
                                <div className="flex items-center gap-2">
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
                                    className={`min-w-0 flex-1 truncate text-sm font-medium ${task.completed ? "line-through opacity-60" : ""}`}
                                    style={{ color: "var(--sh-text-primary)" }}
                                    title={task.title}
                                  >
                                    {task.title}
                                  </p>

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
      />

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
  isReordering: boolean
  clusterName: string | null
  showClusterBadge: boolean
  canEdit: boolean
  onToggle: (completed: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

function DraggableTaskRow({
  task,
  isPending,
  isReordering,
  clusterName,
  showClusterBadge,
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
      className="group rounded-lg border px-3 py-2 transition-colors"
    >
      <div className="flex items-center gap-2">
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
          className={`min-w-0 flex-1 truncate text-sm font-medium ${task.completed ? "line-through opacity-60" : ""}`}
          style={{ color: "var(--sh-text-primary)" }}
          title={task.title}
        >
          {task.title}
        </p>

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
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
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
