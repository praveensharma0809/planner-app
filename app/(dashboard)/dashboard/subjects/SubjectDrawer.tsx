"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useToast } from "@/app/components/Toast"
import { addSubject } from "@/app/actions/subjects/addSubject"
import { updateSubject } from "@/app/actions/subjects/updateSubject"
import { getSubjectById } from "@/app/actions/subjects/getSubjectById"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"

interface Props {
  open: boolean
  mode: "create" | "edit"
  subjectId: string | null
  onClose: () => void
  onSaved: () => void
}

export function SubjectDrawer({ open, mode, subjectId, onClose, onSaved }: Props) {
  const { addToast } = useToast()

  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [subjectArchived, setSubjectArchived] = useState(false)

  const busy = loading || archiving

  useEffect(() => {
    if (!open) return

    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
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
      setSubjectArchived(false)
      return
    }

    if (mode === "edit" && subjectId) {
      let cancelled = false
      void (async () => {
        const res = await getSubjectById(subjectId)
        if (cancelled) return

        if (res.status === "SUCCESS") {
          setName(res.subject.name)
          const nextArchived = Boolean((res.subject as { archived?: boolean }).archived)
          setSubjectArchived(nextArchived)
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
  }, [open, mode, subjectId, addToast])

  if (!open || typeof document === "undefined") return null

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === "create") {
        const res = await addSubject({ name })
        if (res.status === "SUCCESS") {
          addToast("Subject created", "success")
          onSaved()
        } else if (res.status === "ERROR") {
          addToast(res.message, "error")
        } else {
          addToast("Unauthorized", "error")
        }
      } else if (mode === "edit" && subjectId) {
        const res = await updateSubject({ id: subjectId, name })

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

  async function handleToggleArchive() {
    if (mode !== "edit" || !subjectId || busy) return

    const targetArchived = !subjectArchived
    const confirmMessage = targetArchived
      ? "Archive this subject?"
      : "Restore this subject to active list?"

    if (!window.confirm(confirmMessage)) return

    setArchiving(true)
    try {
      const result = await toggleArchiveSubject(subjectId)
      if (result.status !== "SUCCESS") {
        addToast(result.status === "ERROR" ? result.message : "Unauthorized", "error")
        return
      }

      setSubjectArchived(result.archived)
      addToast(result.archived ? "Subject archived." : "Subject restored.", "success")
      onSaved()
    } finally {
      setArchiving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="fixed inset-0 bg-black/55"
        onClick={() => {
          if (busy) return
          onClose()
        }}
        disabled={busy}
        aria-label="Close modal"
      />

      <div
        className="fixed left-1/2 top-1/2 z-10 flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--sh-card)", borderColor: "var(--sh-border)" }}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add New Subject" : "Edit Subject"}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
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
            className="h-8 w-8 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--sh-text-muted)" }}
            aria-label="Close"
          >
            <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <form id="subject-form" onSubmit={handleSaveSubject} className="space-y-5">
            <div>
              <label
                htmlFor="dashboard-subject-name"
                className="mb-2 block text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--sh-text-muted)" }}
              >
                Subject Name
              </label>
              <input
                id="dashboard-subject-name"
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. System Design, Calculus"
                className="ui-input"
                disabled={busy}
              />
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "var(--sh-text-muted)" }}>
              This page is for structure storage. Keep subjects, chapters, topics, and task titles organized here.
            </p>
          </form>
        </div>

        <div
          className="flex items-center gap-2 p-6"
          style={{ borderTop: "1px solid var(--sh-border)", background: "var(--sh-card)" }}
        >
          <button
            form="subject-form"
            type="submit"
            disabled={busy}
            className="ui-btn ui-btn-primary ui-btn-md flex-1 justify-center disabled:opacity-50"
          >
            {loading ? "Saving…" : mode === "create" ? "Create Subject" : "Save Changes"}
          </button>

          {mode === "edit" && (
            <button
              type="button"
              onClick={() => {
                void handleToggleArchive()
              }}
              disabled={busy}
              className="ui-btn ui-btn-danger ui-btn-md flex-1 justify-center disabled:opacity-50"
            >
              {archiving
                ? "Saving..."
                : subjectArchived
                  ? "Restore Subject"
                  : "Archive Subject"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}