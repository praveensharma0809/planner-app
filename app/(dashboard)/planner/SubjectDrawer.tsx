"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/app/components/Toast"
import { addSubject } from "@/app/actions/subjects/addSubject"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
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

export function SubjectDrawer({ open, mode, subjectId, initialSubject = null, onClose, onSaved }: Props) {
  const { addToast } = useToast()

  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [deadline, setDeadline] = useState("")
  const [restAfterDays, setRestAfterDays] = useState("0")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)

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
        onClose()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

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

  if (!shouldRender) return null

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault()

    if (startDate && deadline && startDate > deadline) {
      addToast("Subject start date must be on or before subject deadline.", "error")
      return
    }

    const parsedRest = Number.parseInt(restAfterDays || "0", 10)
    const normalizedRestAfterDays = Number.isFinite(parsedRest)
      ? Math.max(0, parsedRest)
      : 0

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
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteSubject() {
    if (mode !== "edit" || !subjectId) return

    if (!window.confirm("Delete this subject and all related planner links?")) {
      return
    }

    setDeleting(true)

    const result = await deleteSubject(subjectId)
    if (result.status === "SUCCESS") {
      addToast("Subject deleted", "success")
      onSaved()
    } else {
      addToast(result.status === "ERROR" ? result.message : "Unauthorized", "error")
    }

    setDeleting(false)
  }

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
        aria-label="Close drawer"
      />

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col overflow-y-auto shadow-2xl transform transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "var(--sh-card)", borderLeft: "1px solid var(--sh-border)" }}
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
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors focus-ring"
            style={{ color: "var(--sh-text-muted)" }}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <form id="subject-form" onSubmit={handleSaveSubject} className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "var(--sh-text-muted)" }}
              >
                Subject Name
              </label>
              <input
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. System Design, Calculus"
                className="ui-input"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "var(--sh-text-muted)" }}
                >
                  Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="ui-input"
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
                  disabled={deleting || loading}
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
          <button
            form="subject-form"
            type="submit"
            disabled={loading}
            className="ui-btn ui-btn-primary ui-btn-md w-full justify-center disabled:opacity-50"
          >
            {loading ? "Saving…" : mode === "create" ? "Create Subject" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  )
}