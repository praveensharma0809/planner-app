"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
import { SubjectDrawer } from "./SubjectDrawer"
import { Badge, Button, Progress } from "@/app/components/ui"
import { PageHeader } from "@/app/components/layout/PageHeader"
import { StatsRow } from "@/app/components/layout/StatsRow"

export interface SubjectTableRow {
  id: string
  name: string
  archived: boolean
  topicCount: number
  estimatedHours: number
  totalTasks: number
  completedTasks: number
  earliestDeadline: string | null
  priority: number | null
}

interface Props {
  initialSubjects: SubjectTableRow[]
}

// Deterministic accent colours (matches calendar palette)
const ACCENT_COLORS = [
  "#7C6CFF", "#34D399", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#F472B6", "#10B981",
]

const PRIORITY_CONFIG: Record<number, { variant: "danger" | "warning" | "primary"; label: string }> = {
  1: { variant: "danger",  label: "Critical" },
  2: { variant: "warning", label: "High"     },
  3: { variant: "primary", label: "Medium"   },
}

function progressPercent(s: SubjectTableRow): number {
  if (s.totalTasks === 0) return 0
  return Math.round((s.completedTasks / s.totalTasks) * 100)
}

function progressVariant(pct: number): "success" | "warning" | "danger" | "default" {
  if (pct >= 75) return "success"
  if (pct >= 40) return "default"
  if (pct >= 15) return "warning"
  return "danger"
}

function deadlineDaysLeft(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d     = new Date(iso); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

function deadlineLabel(iso: string | null): string {
  if (!iso) return "No deadline"
  const days = deadlineDaysLeft(iso)
  if (days < 0)   return `${Math.abs(days)}d overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  if (days <= 7)  return `${days}d left`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function deadlineVariant(iso: string | null): "danger" | "warning" | "success" | "default" {
  if (!iso) return "default"
  const days = deadlineDaysLeft(iso)
  if (days < 0)  return "danger"
  if (days <= 3)  return "danger"
  if (days <= 10) return "warning"
  return "success"
}

export function SubjectsDataTable({ initialSubjects }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const [subjects, setSubjects]         = useState<SubjectTableRow[]>(initialSubjects)
  const [showArchived, setShowArchived] = useState(false)
  const [pendingId, setPendingId]       = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen]     = useState(false)
  const [drawerMode, setDrawerMode]     = useState<"create" | "edit">("create")
  const [selectedId, setSelectedId]     = useState<string | null>(null)

  useEffect(() => { setSubjects(initialSubjects) }, [initialSubjects])

  const activeSubjects   = useMemo(() => subjects.filter((s) => !s.archived), [subjects])
  const archivedSubjects = useMemo(() => subjects.filter((s) => s.archived),  [subjects])
  const displaySubjects  = showArchived ? archivedSubjects : activeSubjects

  // Summary stats (active only)
  const totalTopics = activeSubjects.reduce((n, s) => n + s.topicCount, 0)
  const avgProgress = activeSubjects.length
    ? Math.round(activeSubjects.reduce((n, s) => n + progressPercent(s), 0) / activeSubjects.length)
    : 0
  const urgentCount = activeSubjects.filter(
    (s) => s.earliestDeadline && deadlineDaysLeft(s.earliestDeadline) <= 7
  ).length

  async function handleArchive(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setPendingId(id)
    const res = await toggleArchiveSubject(id)
    if (res.status === "SUCCESS") {
      setSubjects((prev) => prev.map((s) => s.id === id ? { ...s, archived: res.archived } : s))
      addToast(res.archived ? "Subject archived" : "Subject restored", "success")
      router.refresh()
    } else {
      addToast(res.status === "ERROR" ? res.message : "Unauthorized", "error")
    }
    setPendingId(null)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm("Delete this subject? This cannot be undone.")) return
    setPendingId(id)
    const res = await deleteSubject(id)
    if (res.status === "SUCCESS") {
      setSubjects((prev) => prev.filter((s) => s.id !== id))
      addToast("Subject deleted", "info")
      router.refresh()
    } else {
      addToast(res.status === "ERROR" ? res.message : "Unauthorized", "error")
    }
    setPendingId(null)
  }

  function openCreate() {
    setDrawerMode("create"); setSelectedId(null); setDrawerOpen(true)
  }
  function openEdit(id: string) {
    setDrawerMode("edit"); setSelectedId(id); setDrawerOpen(true)
  }

  return (
    <div className="page-root fade-in">
      {/* Page header */}
      <PageHeader
        eyebrow="Curriculum"
        title="Subjects"
        subtitle="Track progress across all your subjects. Configure topics and workload in the Planner."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "← Active" : "Archived"}
            </Button>
            <Button variant="primary" size="sm" onClick={openCreate}>
              + Add Subject
            </Button>
          </div>
        }
      />

      {/* Summary stats (active view only) */}
      {!showArchived && activeSubjects.length > 0 && (
        <StatsRow
          stats={[
            { label: "Active subjects", value: activeSubjects.length, dotColor: "bg-indigo-400"  },
            { label: "Total topics",    value: totalTopics,           dotColor: "bg-violet-400"  },
            { label: "Avg progress",    value: `${avgProgress}%`,     dotColor: "bg-emerald-400" },
            ...(urgentCount > 0
              ? [{ label: "Due soon", value: urgentCount, dotColor: "bg-red-400" }]
              : []),
          ]}
        />
      )}

      {/* Empty state */}
      {displaySubjects.length === 0 && (
        <div className="empty-state">
          <div className="text-5xl mb-4 opacity-20">📚</div>
          <p className="text-base font-semibold mb-1" style={{ color: "var(--sh-text-primary)" }}>
            {showArchived ? "No archived subjects" : "No subjects yet"}
          </p>
          <p className="text-sm mb-6" style={{ color: "var(--sh-text-muted)" }}>
            {showArchived
              ? "Archive a subject to see it here."
              : "Add your first subject to start building your curriculum."}
          </p>
          {!showArchived && (
            <Button variant="primary" onClick={openCreate}>Add first subject</Button>
          )}
        </div>
      )}

      {/* Subject card grid */}
      {displaySubjects.length > 0 && (
        <div className="subject-grid">
          {displaySubjects.map((subject, i) => {
            const pct       = progressPercent(subject)
            const pVar      = progressVariant(pct)
            const accent    = ACCENT_COLORS[i % ACCENT_COLORS.length]
            const dLabel    = deadlineLabel(subject.earliestDeadline)
            const dVar      = deadlineVariant(subject.earliestDeadline)
            const isPending = pendingId === subject.id
            const remaining = subject.totalTasks - subject.completedTasks
            const pConfig   = subject.priority != null
              ? (PRIORITY_CONFIG[subject.priority] ?? null)
              : null

            return (
              <div
                key={subject.id}
                onClick={() => openEdit(subject.id)}
                className="ui-card ui-card-interactive overflow-hidden focus-ring group"
                tabIndex={0}
                role="button"
                aria-label={`${subject.name} — click to edit`}
                onKeyDown={(e) => e.key === "Enter" && openEdit(subject.id)}
              >
                {/* Colour accent stripe */}
                <div style={{ height: "3px", background: accent }} aria-hidden="true" />

                <div className="p-5">
                  {/* Header: name + priority badge */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold text-[15px] leading-snug truncate"
                        style={{ color: "var(--sh-text-primary)" }}
                      >
                        {subject.name}
                      </h3>
                      {subject.archived && (
                        <span
                          className="text-[10px] uppercase tracking-widest"
                          style={{ color: "var(--sh-text-muted)" }}
                        >
                          archived
                        </span>
                      )}
                    </div>
                    {pConfig && (
                      <Badge variant={pConfig.variant} size="sm">{pConfig.label}</Badge>
                    )}
                  </div>

                  {/* Progress bar */}
                  <Progress value={pct} variant={pVar} height={5} className="mb-1.5" />
                  <div
                    className="flex justify-between text-[11px] mb-5"
                    style={{ color: "var(--sh-text-muted)" }}
                  >
                    <span>{subject.completedTasks}/{subject.totalTasks} tasks</span>
                    <span
                      className="font-semibold"
                      style={{ color: pct > 0 ? "var(--sh-text-secondary)" : undefined }}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* Stat tiles */}
                  <div className="grid grid-cols-3 gap-2.5 mb-5">
                    {[
                      { value: subject.topicCount,                      label: "Topics"    },
                      { value: `${subject.estimatedHours.toFixed(0)}h`, label: "Estimated" },
                      { value: remaining,                               label: "Remaining" },
                    ].map(({ value, label }) => (
                      <div key={label} className="subject-stat-tile">
                        <div
                          className="text-[17px] font-bold leading-none mb-1"
                          style={{ color: "var(--sh-text-primary)" }}
                        >
                          {value}
                        </div>
                        <div
                          className="text-[10px]"
                          style={{ color: "var(--sh-text-muted)" }}
                        >
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer: deadline badge + action buttons */}
                  <div
                    className="flex items-center justify-between pt-4"
                    style={{ borderTop: "1px solid var(--sh-border)" }}
                  >
                    <Badge variant={dVar} size="sm">{dLabel}</Badge>

                    {/* Hover-reveal action buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        type="button"
                        onClick={(e) => handleArchive(subject.id, e)}
                        disabled={isPending}
                        className="text-[11px] px-2 py-1 rounded-md transition-colors focus-ring disabled:opacity-40"
                        style={{ color: "var(--sh-text-muted)" }}
                        title={subject.archived ? "Restore" : "Archive"}
                      >
                        {isPending ? "…" : subject.archived ? "Restore" : "Archive"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(subject.id, e)}
                        disabled={isPending}
                        className="text-[11px] px-2 py-1 rounded-md transition-colors focus-ring disabled:opacity-40"
                        style={{ color: "#EF4444" }}
                        title="Delete subject"
                      >
                        {isPending ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Slide-over drawer */}
      <SubjectDrawer
        open={drawerOpen}
        mode={drawerMode}
        subjectId={selectedId}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => { setDrawerOpen(false); router.refresh() }}
      />
    </div>
  )
}
