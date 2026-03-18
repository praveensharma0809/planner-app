"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { completeTask } from "@/app/actions/plan/completeTask"
import { uncompleteTask } from "@/app/actions/plan/uncompleteTask"
import { useToast } from "@/app/components/Toast"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
import { SubjectDrawer } from "./SubjectDrawer"
import { Badge, Button } from "@/app/components/ui"
import { PageHeader } from "@/app/components/layout/PageHeader"

export interface SubjectNavTopic {
  id: string
  name: string
}

export interface SubjectNavChapter {
  id: string
  name: string
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
  sessionType: "core" | "revision" | "practice"
  scheduledDate: string
}

interface Props {
  initialSubjects: SubjectNavItem[]
  initialTasksByChapter: Record<string, TopicTaskItem[]>
}

interface ColumnItem {
  id: string
  label: string
  hint?: string
}

const SESSION_META: Record<
  TopicTaskItem["sessionType"],
  { label: string; variant: "default" | "success" | "warning" }
> = {
  core: { label: "Study", variant: "default" },
  practice: { label: "Exercise", variant: "success" },
  revision: { label: "Revision", variant: "warning" },
}

function formatDateLabel(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function SubjectsDataTable({ initialSubjects, initialTasksByChapter }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const [subjects, setSubjects] = useState<SubjectNavItem[]>(initialSubjects)
  const [tasksByChapter, setTasksByChapter] =
    useState<Record<string, TopicTaskItem[]>>(initialTasksByChapter)
  const [showArchived, setShowArchived] = useState(false)
  const [pendingSubjectId, setPendingSubjectId] = useState<string | null>(null)
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set())

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [selectedSubjectIdForDrawer, setSelectedSubjectIdForDrawer] = useState<string | null>(null)

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  useEffect(() => { setSubjects(initialSubjects) }, [initialSubjects])
  useEffect(() => { setTasksByChapter(initialTasksByChapter) }, [initialTasksByChapter])

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
    const topics = selectedChapter?.topics ?? []
    if (topics.length === 0) {
      setSelectedTopicId(null)
      return
    }

    setSelectedTopicId((current) => {
      if (current && topics.some((topic) => topic.id === current)) return current
      return topics[0].id
    })
  }, [selectedChapter])

  const selectedTopic =
    selectedChapter?.topics.find((topic) => topic.id === selectedTopicId) ?? null

  const chapterTasks = selectedChapter ? tasksByChapter[selectedChapter.id] ?? [] : []
  const completedCount = chapterTasks.filter((task) => task.completed).length

  const subjectColumnItems: ColumnItem[] = displaySubjects.map((subject) => ({
    id: subject.id,
    label: subject.name,
    hint: `${subject.chapters.length} chapter${subject.chapters.length === 1 ? "" : "s"}`,
  }))

  const chapterColumnItems: ColumnItem[] = (selectedSubject?.chapters ?? []).map((chapter) => {
    const taskCount = (tasksByChapter[chapter.id] ?? []).length
    return {
      id: chapter.id,
      label: chapter.name,
      hint: `${taskCount} task${taskCount === 1 ? "" : "s"}`,
    }
  })

  const topicColumnItems: ColumnItem[] = (selectedChapter?.topics ?? []).map((topic) => ({
    id: topic.id,
    label: topic.name,
  }))

  function openCreate() {
    setDrawerMode("create")
    setSelectedSubjectIdForDrawer(null)
    setDrawerOpen(true)
  }

  function openEditSelected() {
    if (!selectedSubjectId) return
    setDrawerMode("edit")
    setSelectedSubjectIdForDrawer(selectedSubjectId)
    setDrawerOpen(true)
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

  async function handleToggleTask(taskId: string, nextCompleted: boolean) {
    if (!selectedChapter) return
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
    <div className="page-root fade-in max-w-none">
      <PageHeader
        eyebrow="Curriculum"
        title="Subjects"
        subtitle="Navigate your syllabus with a left-to-right subject flow that keeps structure and execution in one place."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? "Show Active" : "Show Archived"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openEditSelected}
              disabled={!selectedSubject}
            >
              Edit Subject
            </Button>
            <Button variant="primary" size="sm" onClick={openCreate}>
              Add Subject
            </Button>
          </div>
        }
      />

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
          {!showArchived && (
            <div className="mt-5">
              <Button variant="primary" onClick={openCreate}>
                Add first subject
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-2xl border p-3 sm:p-4"
          style={{
            borderColor: "var(--sh-border)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
            boxShadow: "var(--sh-shadow-sm)",
          }}
        >
          <p className="mb-3 text-xs font-medium sm:hidden" style={{ color: "var(--sh-text-muted)" }}>
            Swipe horizontally to move from Subjects to Tasks.
          </p>

          <div className="flex h-[min(76vh,760px)] min-h-[540px] gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
            <NavigationColumn
              title="Subjects"
              items={subjectColumnItems}
              activeId={selectedSubjectId}
              emptyMessage="No subjects available."
              onSelect={setSelectedSubjectId}
            />

            <NavigationColumn
              title="Chapters"
              items={chapterColumnItems}
              activeId={selectedChapterId}
              emptyMessage="No chapters in this subject."
              onSelect={setSelectedChapterId}
            />

            <NavigationColumn
              title="Topics"
              items={topicColumnItems}
              activeId={selectedTopicId}
              emptyMessage="No topics in this chapter."
              onSelect={setSelectedTopicId}
            />

            <section
              className="min-w-[340px] flex-1 rounded-xl border px-5 py-5 sm:px-6 sm:py-6 snap-start"
              style={{
                borderColor: "var(--sh-border)",
                background: "var(--sh-card)",
              }}
            >
              {selectedSubject && selectedChapter ? (
                <div className="flex h-full flex-col">
                  <nav
                    className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide"
                    style={{ color: "var(--sh-text-muted)" }}
                  >
                    <span>{selectedSubject.name}</span>
                    <span>{">"}</span>
                    <span>{selectedChapter.name}</span>
                    <span>{">"}</span>
                    <span style={{ color: "var(--sh-text-secondary)" }}>
                      {selectedTopic?.name ?? "Overview"}
                    </span>
                  </nav>

                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2
                        className="text-3xl font-extrabold tracking-tight"
                        style={{ color: "var(--sh-text-primary)" }}
                      >
                        {selectedTopic?.name ?? selectedChapter.name}
                      </h2>
                      <p className="mt-1 text-sm" style={{ color: "var(--sh-text-secondary)" }}>
                        {completedCount}/{chapterTasks.length} tasks completed
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--sh-text-muted)" }}>
                        Chapter: {selectedChapter.name}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleArchiveSelected}
                      disabled={pendingSubjectId === selectedSubject.id}
                    >
                      {selectedSubject.archived ? "Restore Subject" : "Archive Subject"}
                    </Button>
                  </div>

                  <div className="mt-6 flex-1 overflow-y-auto pr-1">
                    <div className="space-y-3">
                      {chapterTasks.length === 0 && (
                        <div
                          className="rounded-xl border border-dashed px-4 py-8 text-center text-sm"
                          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
                        >
                          No tasks for this chapter yet.
                        </div>
                      )}

                      {chapterTasks.map((task) => {
                        const meta = SESSION_META[task.sessionType]
                        const isPending = pendingTaskIds.has(task.id)

                        return (
                          <div
                            key={task.id}
                            className="group rounded-xl border px-4 py-3 transition-colors"
                            style={{
                              borderColor: "var(--sh-border)",
                              background: task.completed
                                ? "rgba(52, 211, 153, 0.08)"
                                : "rgba(255, 255, 255, 0.02)",
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => handleToggleTask(task.id, !task.completed)}
                                disabled={isPending}
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50"
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
                                    className="h-3.5 w-3.5 text-white"
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
                                  className={`truncate text-sm font-semibold ${task.completed ? "line-through opacity-60" : ""}`}
                                  style={{ color: "var(--sh-text-primary)" }}
                                >
                                  {task.title}
                                </p>
                                <p
                                  className={`mt-1 text-xs ${task.completed ? "line-through opacity-50" : ""}`}
                                  style={{ color: "var(--sh-text-muted)" }}
                                >
                                  {formatDateLabel(task.scheduledDate)} | {task.durationMinutes} min
                                </p>
                              </div>

                              <Badge variant={meta.variant} size="sm">
                                {meta.label}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm"
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
    </div>
  )
}

interface NavigationColumnProps {
  title: string
  items: ColumnItem[]
  activeId: string | null
  emptyMessage: string
  onSelect: (id: string) => void
}

function NavigationColumn({
  title,
  items,
  activeId,
  emptyMessage,
  onSelect,
}: NavigationColumnProps) {
  return (
    <section
      className="w-[248px] min-w-[248px] shrink-0 rounded-xl border p-2 snap-start"
      style={{
        borderColor: "var(--sh-border)",
        background: "color-mix(in srgb, var(--sh-card) 94%, var(--foreground) 6%)",
      }}
    >
      <p
        className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--sh-text-muted)" }}
      >
        {title}
      </p>

      <div className="max-h-full space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="px-2 py-6 text-sm" style={{ color: "var(--sh-text-muted)" }}>
            {emptyMessage}
          </p>
        )}

        {items.map((item) => {
          const isActive = item.id === activeId

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="w-full rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-[rgba(124,108,255,0.08)]"
              style={{
                borderColor: isActive ? "var(--sh-primary-glow)" : "transparent",
                background: isActive ? "var(--sh-primary-muted)" : "transparent",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{
                      color: isActive ? "var(--sh-primary-light)" : "var(--sh-text-primary)",
                    }}
                  >
                    {item.label}
                  </p>
                  {item.hint && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--sh-text-muted)" }}>
                      {item.hint}
                    </p>
                  )}
                </div>
                <span
                  className="pt-0.5 text-xs"
                  style={{ color: isActive ? "var(--sh-primary-light)" : "var(--sh-text-muted)" }}
                >
                  {">"}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
