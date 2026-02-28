"use client"

import { useState } from "react"
import { Subject, Subtopic } from "@/lib/types/db"
import { useToast } from "@/app/components/Toast"
import { updateSubject } from "@/app/actions/subjects/updateSubject"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
import { getSubtopics, addSubtopic, deleteSubtopic } from "@/app/actions/subjects/subtopics"

interface Props {
  subject: Subject
}

export function SubjectCard({ subject }: Props) {
  const { addToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [totalItems, setTotalItems] = useState(subject.total_items)
  const [avgDuration, setAvgDuration] = useState(subject.avg_duration_minutes)
  const [deadline, setDeadline] = useState(subject.deadline)
  const [priority, setPriority] = useState(subject.priority)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showSubtopics, setShowSubtopics] = useState(false)
  const [subtopics, setSubtopics] = useState<Subtopic[]>([])
  const [subtopicsLoaded, setSubtopicsLoaded] = useState(false)
  const [loadingSubtopics, setLoadingSubtopics] = useState(false)
  const [newSubtopicName, setNewSubtopicName] = useState("")
  const [newSubtopicItems, setNewSubtopicItems] = useState(0)
  const [addingSubtopic, setAddingSubtopic] = useState(false)

  const progress =
    subject.total_items === 0
      ? 100
      : Math.round(
          (subject.completed_items / subject.total_items) * 100
        )

  const deadlineMs = new Date(subject.deadline + "T23:59:59").getTime()
  const todayMs = new Date().setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((deadlineMs - todayMs) / 86_400_000)

  const health: "on_track" | "behind" | "at_risk" | "overdue" =
    daysLeft < 0 && progress < 100
      ? "overdue"
      : daysLeft <= 3 && progress < 80
      ? "at_risk"
      : daysLeft <= 7 && progress < 60
      ? "behind"
      : "on_track"

  const barColor =
    health === "on_track"
      ? "progress-emerald"
      : health === "behind"
      ? "progress-amber"
      : "progress-red"

  const healthLabel =
    health === "on_track"
      ? "On track"
      : health === "behind"
      ? "Behind"
      : health === "at_risk"
      ? "At risk"
      : "Overdue"

  const healthTextColor =
    health === "on_track"
      ? "text-emerald-400"
      : health === "behind"
      ? "text-amber-400"
      : "text-red-400"

  const healthBg =
    health === "on_track"
      ? "bg-emerald-500/10"
      : health === "behind"
      ? "bg-amber-500/10"
      : "bg-red-500/10"

  const estimatedFinish = (() => {
    const remaining = subject.total_items - subject.completed_items
    if (remaining <= 0) return "Complete"
    const createdMs = new Date(subject.created_at).getTime()
    const nowMs = Date.now()
    const daysSinceCreated = Math.max(1, Math.ceil((nowMs - createdMs) / 86_400_000))
    const burnRate = subject.completed_items / daysSinceCreated
    if (burnRate <= 0) return "No data yet"
    const daysNeeded = Math.ceil(remaining / burnRate)
    const eta = new Date()
    eta.setDate(eta.getDate() + daysNeeded)
    return eta.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  })()

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await updateSubject({
        id: subject.id,
        total_items: totalItems,
        avg_duration_minutes: avgDuration,
        deadline,
        priority,
      })
      if (result.status === "UNAUTHORIZED") {
        setError("Session expired. Please sign in again.")
      } else if (result.status === "ERROR") {
        setError(result.message)
      } else {
        setEditing(false)
        addToast(`${subject.name} updated`, "success")
      }
    } catch {
      setError("Network error - please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const result = await deleteSubject(subject.id)
      if (result.status === "UNAUTHORIZED") {
        setError("Session expired. Please sign in again.")
      } else if (result.status === "ERROR") {
        setError(result.message)
      } else {
        addToast(`${subject.name} deleted`, "info")
      }
    } catch {
      setError("Network error - please try again.")
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleArchiveToggle = async () => {
    setArchiving(true)
    try {
      const result = await toggleArchiveSubject(subject.id)
      if (result.status === "SUCCESS") {
        addToast(result.archived ? `${subject.name} archived` : `${subject.name} restored`, "info")
      } else if (result.status === "ERROR") {
        addToast(result.message, "error")
      }
    } catch {
      addToast("Network error", "error")
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="glass-card !p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="text-lg font-bold text-white/90 truncate">{subject.name}</h3>
          {subject.mandatory && (
            <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded-md font-semibold shrink-0">REQ</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleArchiveToggle}
            disabled={archiving}
            className="px-2.5 py-1 text-xs text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/[0.06] rounded-lg transition-all disabled:opacity-50"
            aria-label={`${subject.archived ? "Restore" : "Archive"} ${subject.name}`}
          >
            {archiving ? "..." : subject.archived ? "Restore" : "Archive"}
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="px-2.5 py-1 text-xs text-indigo-400/70 hover:text-indigo-400 hover:bg-indigo-500/[0.06] rounded-lg transition-all"
            aria-label={`${editing ? "Cancel editing" : "Edit"} ${subject.name}`}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="px-2.5 py-1 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.06] rounded-lg transition-all disabled:opacity-50"
            aria-label={`Delete ${subject.name}`}
          >
            {deleting ? "..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">
            {subject.completed_items}/{subject.total_items} ({progress}%)
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold ${healthTextColor} ${healthBg} px-2 py-0.5 rounded-md`}>{healthLabel}</span>
            <span className="text-[10px] text-white/25">
              {daysLeft === 0
                ? "Due today"
                : daysLeft < 0
                ? `${Math.abs(daysLeft)}d overdue`
                : `${daysLeft}d left`}
            </span>
          </div>
        </div>
        <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      {confirmDelete && (
        <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl p-4 space-y-3">
          <p className="text-sm text-red-300">
            Delete <strong>{subject.name}</strong>? All associated tasks will also be removed. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 bg-red-500/80 text-white text-xs font-semibold rounded-xl hover:bg-red-500 transition-all disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Total items</label>
            <input
              type="number"
              value={totalItems}
              onChange={e => setTotalItems(Number(e.target.value))}
              min={1}
              className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Avg duration (mins)</label>
            <input
              type="number"
              value={avgDuration}
              onChange={e => setAvgDuration(Number(e.target.value))}
              min={1}
              className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(Number(e.target.value))}
              className="w-full p-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm focus:border-indigo-500/30 focus:outline-none"
            >
              <option value={1}>High</option>
              <option value={2}>Medium-High</option>
              <option value={3}>Medium</option>
              <option value={4}>Low</option>
              <option value={5}>Very Low</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      ) : (
        <div className="text-sm text-white/40 space-y-1">
          <div className="flex items-center justify-between">
            <span>Avg Duration: {subject.avg_duration_minutes} mins</span>
            <span className="text-[10px] text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-md">P{subject.priority}</span>
          </div>
          <p>Deadline: {subject.deadline}</p>
          <p className="text-xs text-white/30">
            Est. finish: <span className={estimatedFinish === "Complete" ? "text-emerald-400" : "text-white/60"}>{estimatedFinish}</span>
          </p>
        </div>
      )}

      {/* Subtopics */}
      <div className="border-t border-white/[0.06] pt-3">
        <button
          onClick={async () => {
            if (!subtopicsLoaded) {
              setLoadingSubtopics(true)
              try {
                const res = await getSubtopics(subject.id)
                if (res.status === "SUCCESS") setSubtopics(res.subtopics)
              } catch {
                // Silently fail
              } finally {
                setSubtopicsLoaded(true)
                setLoadingSubtopics(false)
              }
            }
            setShowSubtopics(!showSubtopics)
          }}
          aria-expanded={showSubtopics}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {loadingSubtopics ? "Loading..." : showSubtopics ? "&#x25BE; Hide subtopics" : "&#x25B8; Subtopics / Chapters"}
          {subtopicsLoaded && ` (${subtopics.length})`}
        </button>

        {showSubtopics && (
          <div className="mt-3 space-y-2">
            {subtopics.length === 0 && (
              <p className="text-xs text-white/25">No subtopics yet. Break this subject into chapters or sections.</p>
            )}

            {subtopics.map(st => {
              const stPct = st.total_items > 0 ? Math.round((st.completed_items / st.total_items) * 100) : 0
              return (
                <div key={st.id} className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white/70 truncate">{st.name}</div>
                    <div className="text-[10px] text-white/30">{st.completed_items}/{st.total_items} items &#xB7; {stPct}%</div>
                  </div>
                  <div className="w-16 bg-white/[0.06] rounded-full h-1 overflow-hidden shrink-0">
                    <div className="h-1 rounded-full progress-emerald transition-all" style={{ width: `${stPct}%` }} />
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await deleteSubtopic(st.id)
                        if (res.status === "SUCCESS") {
                          setSubtopics(prev => prev.filter(s => s.id !== st.id))
                          addToast("Subtopic removed", "info")
                        }
                      } catch {
                        addToast("Failed to remove subtopic.", "error")
                      }
                    }}
                    className="text-[10px] text-red-400/40 hover:text-red-400 transition-colors shrink-0"
                    aria-label={`Delete ${st.name}`}
                  >
                    &#x2715;
                  </button>
                </div>
              )
            })}

            {/* Add subtopic form */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={newSubtopicName}
                  onChange={e => setNewSubtopicName(e.target.value)}
                  placeholder="Chapter name"
                  aria-label="Subtopic name"
                  className="w-full text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-white/80 placeholder:text-white/25 focus:border-indigo-500/30 focus:outline-none"
                />
              </div>
              <input
                type="number"
                value={newSubtopicItems || ""}
                onChange={e => setNewSubtopicItems(Number(e.target.value))}
                placeholder="Items"
                aria-label="Number of items"
                min={0}
                className="w-16 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl px-2 py-2 text-white/80 placeholder:text-white/25 focus:border-indigo-500/30 focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!newSubtopicName.trim()) return
                  setAddingSubtopic(true)
                  try {
                    const res = await addSubtopic(subject.id, newSubtopicName, newSubtopicItems)
                    if (res.status === "SUCCESS") {
                      setSubtopics(prev => [...prev, res.subtopic])
                      setNewSubtopicName("")
                      setNewSubtopicItems(0)
                      addToast("Subtopic added", "success")
                    } else if (res.status === "ERROR") {
                      addToast(res.message, "error")
                    }
                  } catch {
                    addToast("Failed to add subtopic.", "error")
                  } finally {
                    setAddingSubtopic(false)
                  }
                }}
                disabled={addingSubtopic || !newSubtopicName.trim()}
                className="btn-primary text-xs !px-3 !py-2 shrink-0"
              >
                {addingSubtopic ? "..." : "+ Add"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}