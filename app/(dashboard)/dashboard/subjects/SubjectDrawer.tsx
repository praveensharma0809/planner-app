"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/app/components/Toast"
import { addSubject } from "@/app/actions/subjects/addSubject"
import { updateSubject } from "@/app/actions/subjects/updateSubject"
import { getSubjectById } from "@/app/actions/subjects/getSubjectById"

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

  useEffect(() => {
    if (!open) return

    if (mode === "create") {
      setName("")
      return
    }

    if (mode === "edit" && subjectId) {
      let cancelled = false
      void (async () => {
        const res = await getSubjectById(subjectId)
        if (cancelled) return

        if (res.status === "SUCCESS") {
          setName(res.subject.name)
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

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 transition-opacity"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col overflow-y-auto shadow-2xl transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "var(--sh-card)", borderLeft: "1px solid var(--sh-border)" }}
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

            <p className="text-xs leading-relaxed" style={{ color: "var(--sh-text-muted)" }}>
              Topics, deadlines, and workload parameters are configured in the{" "}
              <a href="/planner" style={{ color: "var(--sh-primary, #7c6cff)" }}>Planner wizard</a>.
            </p>
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