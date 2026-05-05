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
        className="fixed inset-x-0 bottom-0 top-auto z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl rounded-b-none border-x-0 border-b-0 border-t border-border-hairline bg-surface-panel shadow-[--shadow-app] md:inset-auto md:left-1/2 md:top-1/2 md:w-[calc(100%-2rem)] md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add New Subject" : "Edit Subject"}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-hairline">
          <h2 className="text-xl font-semibold text-text-primary">
            {mode === "create" ? "Add New Subject" : "Edit Subject"}
          </h2>
          <button
            onClick={() => {
              if (busy) return
              onClose()
            }}
            disabled={busy}
            className="h-8 w-8 rounded-lg transition-colors hover:bg-surface-hover text-text-muted"
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                Subject Name
              </label>
              <input
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. System Design, Calculus"
                className="ui-input"
                disabled={busy}
              />
            </div>

            <p className="text-xs leading-relaxed text-text-muted">
              This page is for structure storage. Keep subjects, chapters, topics, and task titles organized here.
            </p>
          </form>
        </div>

        <div className="flex items-center gap-2 p-6 border-t border-border-hairline bg-surface-panel">
          <button
            form="subject-form"
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-pill font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] bg-action-primary-bg text-action-primary-fg hover:bg-action-primary-bg-hover shadow-none h-10 px-4 text-sm flex-1"
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
              className="inline-flex items-center justify-center gap-1.5 rounded-pill font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] bg-pastel-rose text-pastel-rose-text hover:opacity-90 h-10 px-4 text-sm flex-1"
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
