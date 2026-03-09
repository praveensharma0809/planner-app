"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
import { SubjectDrawer } from "./SubjectDrawer"

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

export function SubjectsDataTable({ initialSubjects }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const [subjects, setSubjects] = useState<SubjectTableRow[]>(initialSubjects)
  const [showArchived, setShowArchived] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)

  useEffect(() => {
    setSubjects(initialSubjects)
  }, [initialSubjects])

  const activeSubjects = useMemo(() => subjects.filter((subject) => !subject.archived), [subjects])
  const archivedSubjects = useMemo(() => subjects.filter((subject) => subject.archived), [subjects])
  const displaySubjects = showArchived ? archivedSubjects : activeSubjects

  function formatDeadline(deadline: string) {
    return new Date(deadline).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  function progressPercent(subject: SubjectTableRow) {
    if (subject.totalTasks === 0) return 0
    return Math.round((subject.completedTasks / subject.totalTasks) * 100)
  }

  async function handleArchive(id: string) {
    setPendingActionId(id)
    const result = await toggleArchiveSubject(id)

    if (result.status === "SUCCESS") {
      setSubjects((prev) =>
        prev.map((subject) =>
          subject.id === id ? { ...subject, archived: result.archived } : subject
        )
      )
      addToast(result.archived ? "Subject archived" : "Subject restored", "success")
      router.refresh()
    } else if (result.status === "ERROR") {
      addToast(result.message, "error")
    } else {
      addToast("Unauthorized", "error")
    }

    setPendingActionId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this subject entirely? This cannot be undone.")) return

    setPendingActionId(id)
    const result = await deleteSubject(id)

    if (result.status === "SUCCESS") {
      setSubjects((prev) => prev.filter((subject) => subject.id !== id))
      addToast("Subject deleted", "info")
      router.refresh()
    } else if (result.status === "ERROR") {
      addToast(result.message, "error")
    } else {
      addToast("Unauthorized", "error")
    }

    setPendingActionId(null)
  }

  function openCreate() {
    setDrawerMode("create")
    setSelectedSubjectId(null)
    setDrawerOpen(true)
  }

  function openEdit(id: string) {
    setDrawerMode("edit")
    setSelectedSubjectId(id)
    setDrawerOpen(true)
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Curriculum</h1>
          <p className="text-sm text-white/45">
            Manage your subjects and configure topics/workload in Planner.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived((prev) => !prev)}
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            {showArchived ? "View Active" : "View Archived"}
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Subject
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10 uppercase tracking-wider text-xs text-white/50">
              <tr>
                <th className="px-6 py-4 font-medium">Subject</th>
                <th className="px-6 py-4 font-medium">Topics</th>
                <th className="px-6 py-4 font-medium">Estimated</th>
                <th className="px-6 py-4 font-medium">Progress</th>
                <th className="px-6 py-4 font-medium">Earliest Deadline</th>
                <th className="px-6 py-4 font-medium">Priority</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displaySubjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-white/40">
                    {showArchived ? "No archived subjects." : "No active subjects. Add one to get started."}
                  </td>
                </tr>
              ) : (
                displaySubjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td
                      className="px-6 py-4 font-medium cursor-pointer"
                      onClick={() => openEdit(subject.id)}
                    >
                      {subject.name}
                    </td>
                    <td className="px-6 py-4 text-white/70">{subject.topicCount}</td>
                    <td className="px-6 py-4 text-white/70">{subject.estimatedHours.toFixed(1)} hrs</td>
                    <td className="px-6 py-4 text-white/70">
                      {subject.completedTasks}/{subject.totalTasks} ({progressPercent(subject)}%)
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      {subject.earliestDeadline ? formatDeadline(subject.earliestDeadline) : "No deadline"}
                    </td>
                    <td className="px-6 py-4">
                      {subject.priority ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            subject.priority === 1
                              ? "bg-red-500/10 text-red-400"
                              : subject.priority === 2
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-blue-500/10 text-blue-400"
                          }`}
                        >
                          P{subject.priority}
                        </span>
                      ) : (
                        <span className="text-white/40">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-end gap-2 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleArchive(subject.id)
                          }}
                          disabled={pendingActionId === subject.id}
                          className="text-xs text-white/40 hover:text-white transition-colors"
                          title={subject.archived ? "Restore" : "Archive"}
                        >
                          {pendingActionId === subject.id
                            ? "..."
                            : subject.archived
                            ? "Restore"
                            : "Archive"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(subject.id)
                          }}
                          disabled={pendingActionId === subject.id}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          {pendingActionId === subject.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SubjectDrawer
        open={drawerOpen}
        mode={drawerMode}
        subjectId={selectedSubjectId}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false)
          router.refresh()
        }}
      />
    </div>
  )
}
