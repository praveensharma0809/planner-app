"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useToast } from "@/app/components/Toast"
import { addSubject } from "@/app/actions/subjects/addSubject"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"
import { updateSubject } from "@/app/actions/subjects/updateSubject"
import { getSubjectById } from "@/app/actions/subjects/getSubjectById"

interface Props {
  open: boolean
  mode: "create" | "edit"
  subjectId: string | null
  initialSubject?: {
    name: string
    startDate: string
    deadline: string
    restAfterDays: string
  } | null
  onClose: () => void
  onSaved: () => void
}

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = `${error.name} ${error.message}`.toLowerCase()
  return (
    message.includes("network")
    || message.includes("failed to fetch")
    || message.includes("fetch failed")
    || message.includes("load failed")
    || message.includes("connection")
    || message.includes("timeout")
    || message.includes("socket")
    || message.includes("econn")
    || message.includes("enotfound")
  )
}

export function SubjectDrawer({ open, mode, subjectId, initialSubject = null, onClose, onSaved }: Props) {
  const { addToast } = useToast()

  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [deadline, setDeadline] = useState("")
  const [, setRestAfterDays] = useState("0")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)
  const actionLockRef = useRef(false)

  function showMutationError(error: unknown, fallbackMessage: string) {
    addToast(
      isLikelyNetworkError(error)
        ? "Network issue. Check connection."
        : fallbackMessage,
      "error"
    )
  }

  function beginAction(): boolean {
    if (actionLockRef.current) return false
    actionLockRef.current = true
    return true
  }

  function endAction() {
    actionLockRef.current = false
  }

  const busy = loading || deleting || archiving

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }

    const timer = window.setTimeout(() => setShouldRender(false), 260)
    document.body.style.overflow = ""
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busy) return
        onClose()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [busy, onClose, open])

  useEffect(() => {
    if (!open) return

    if (mode === "create") {
      setName("")
      setStartDate("")
      setDeadline("")
      setRestAfterDays("0")
      return
    }

    if (mode === "edit" && subjectId) {
      if (initialSubject) {
        setName(initialSubject.name)
        setStartDate(initialSubject.startDate)
        setDeadline(initialSubject.deadline)
        setRestAfterDays(initialSubject.restAfterDays)
        return
      }

      let cancelled = false
      void (async () => {
        const res = await getSubjectById(subjectId)
        if (cancelled) return

        if (res.status === "SUCCESS") {
          setName(res.subject.name)
          setDeadline(res.subject.deadline ?? "")
        } else if (res.status === "UNAUTHORIZED") {
          addToast("Unauthorized", "error")
        } else {
          addToast(res.message, "error")
        }
      })()

      return () => {
        cancelled = true
      }
    }
  }, [open, mode, subjectId, initialSubject, addToast])

  if (!shouldRender || typeof document === "undefined") return null

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault()

    if (busy) return

    if (startDate && deadline && startDate > deadline) {
      addToast("Subject start date must be on or before subject deadline.", "error")
      return
    }

    if (!beginAction()) return

    setLoading(true)

    try {
      if (mode === "create") {
        const res = await addSubject({
          name,
          deadline: deadline || null,
        })
        if (res.status === "SUCCESS") {
          addToast("Subject created", "success")
          onSaved()
        } else if (res.status === "ERROR") {
          addToast(res.message, "error")
        } else {
          addToast("Unauthorized", "error")
        }
      } else if (mode === "edit" && subjectId) {
        const res = await updateSubject({
          id: subjectId,
          name,
          deadline: deadline || null,
        })

        if (res.status === "SUCCESS") {
          addToast("Subject updated", "success")
          onSaved()
        } else if (res.status === "ERROR") {
          addToast(res.message, "error")
        } else {
          addToast("Unauthorized", "error")
        }
      }
    } catch (error) {
      showMutationError(error, "Failed to save subject.")
    } finally {
      setLoading(false)
      endAction()
    }
  }

  async function handleDeleteSubject() {
    if (mode !== "edit" || !subjectId) return
    if (busy || !beginAction()) return

    if (!window.confirm("Delete this subject and all related planner links?")) {
      endAction()
      return
    }

    setDeleting(true)
    try {
      const result = await deleteSubject(subjectId)
      if (result.status === "SUCCESS") {
        addToast("Subject deleted", "success")
        onSaved()
      } else {
        addToast(result.status === "ERROR" ? result.message : "Unauthorized", "error")
      }
    } catch (error) {
      showMutationError(error, "Failed to delete subject.")
    } finally {
      setDeleting(false)
      endAction()
    }
  }

  async function handleArchiveSubject() {
    if (mode !== "edit" || !subjectId) return
    if (busy || !beginAction()) return

    if (!window.confirm("Archive this subject? It will be removed from active lists.")) {
      endAction()
      return
    }

    setArchiving(true)
    try {
      const result = await toggleArchiveSubject(subjectId)

      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Unauthorized", "error")
        return
      }

      if (!result.archived) {
        addToast("Could not archive subject right now.", "error")
        return
      }

      addToast("Subject archived", "success")
      onSaved()
    } catch (error) {
      showMutationError(error, "Failed to archive subject.")
    } finally {
      setArchiving(false)
      endAction()
    }
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <button
        type="button"
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(3px)" }}
        onClick={() => {
          if (busy) return
          onClose()
        }}
        disabled={busy}
        aria-label="Close drawer"
      />

      {/* Centered panel */}
      <div
        className={`fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl transition-all duration-300 ease-out ${open ? "scale-100 opacity-100 pointer-events-auto" : "scale-95 opacity-0 pointer-events-none"}`}
        style={{ background: "var(--sh-card)", borderColor: "var(--sh-border)" }}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add New Subject" : "Edit Subject"}
      >
        <div
          className="flex items-center justify-between p-6 shrink-0"
          style={{ borderBottom: "1px solid var(--sh-border)" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            {mode === "create" ? "Add New Subject" : "Edit Subject"}
          </h2>
          <button
            onClick={() => {
              if (busy) return
              onClose()
            }}
            disabled={busy}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors focus-ring"
            style={{ color: "var(--sh-text-muted)" }}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          <form id="subject-form" onSubmit={handleSaveSubject} className="space-y-5">
            <div>
              <label
                htmlFor="planner-subject-name"
                className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "var(--sh-text-muted)" }}
              >
                Subject Name
              </label>
              <input
                id="planner-subject-name"
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. System Design, Calculus"
                className="ui-input"
                disabled={busy}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              <div>
                <label
                  htmlFor="planner-subject-deadline"
                  className="block text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "var(--sh-text-muted)" }}
                >
                  Deadline
                </label>
                <input
                  id="planner-subject-deadline"
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="ui-input"
                  disabled={busy}
                />
              </div>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "var(--sh-text-muted)" }}>
              This page is for structure storage. Keep subjects, chapters, topics, and task titles organized here.
            </p>

            {mode === "edit" && (
              <div className="rounded-lg border p-3" style={{ borderColor: "rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.08)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Danger Zone</p>
                <p className="mt-1 text-xs text-red-200/80">
                  Deleting a subject is permanent and cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteSubject()
                  }}
                  disabled={busy}
                  className="ui-btn ui-btn-danger ui-btn-sm mt-2"
                >
                  {deleting ? "Deleting..." : "Delete Subject"}
                </button>
              </div>
            )}
          </form>
        </div>

        <div
          className="p-6 shrink-0"
          style={{ borderTop: "1px solid var(--sh-border)", background: "var(--sh-card)" }}
        >
          {mode === "create" ? (
            <button
              form="subject-form"
              type="submit"
              disabled={busy}
              className="ui-btn ui-btn-primary ui-btn-md w-full justify-center disabled:opacity-50"
            >
              {loading ? "Saving…" : "Create Subject"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                form="subject-form"
                type="submit"
                disabled={busy}
                className="ui-btn ui-btn-primary ui-btn-md flex-1 justify-center disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleArchiveSubject()
                }}
                disabled={busy}
                className="ui-btn ui-btn-danger ui-btn-md flex-1 justify-center disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Archive Subject"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}