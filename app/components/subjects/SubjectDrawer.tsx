"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Modal } from "@/app/components/ui"
import { useToast } from "@/app/components/Toast"
import { addSubject } from "@/app/actions/subjects/addSubject"
import { updateSubject } from "@/app/actions/subjects/updateSubject"
import { deleteSubject } from "@/app/actions/subjects/deleteSubject"
import { getSubjectById } from "@/app/actions/subjects/getSubjectById"
import { toggleArchiveSubject } from "@/app/actions/subjects/toggleArchiveSubject"

/**
 * Unified Subject create/edit drawer used by both the planner and the
 * dashboard subjects page.
 *
 * Built on the shared `<Modal>` primitive — inherits focus trap, ESC-to-close,
 * body-scroll lock, focus restoration, and `initialFocusRef` (no autoFocus
 * anti-pattern, no unstable-effect-deps anti-pattern).
 *
 * Feature flags let each call site keep its existing UX:
 * - planner: `showDeadlineField`, `showDeleteAction`, `archiveBehavior="one-way"`
 * - dashboard: `archiveBehavior="toggle"` (no delete, no deadline field)
 */
export interface SubjectDrawerProps {
  open: boolean
  mode: "create" | "edit"
  subjectId: string | null

  /**
   * Optimistic prefill (planner uses this to skip the round-trip to
   * `getSubjectById` when the data was already loaded for the table row).
   */
  initialSubject?: {
    name: string
    deadline: string
  } | null

  /** Render the deadline date input. Default: `false`. */
  showDeadlineField?: boolean

  /**
   * Render a permanent-delete button in the danger zone. The planner uses
   * this; the dashboard does not. Default: `false`.
   */
  showDeleteAction?: boolean

  /**
   * - `"none"`: no archive control rendered.
   * - `"one-way"`: a single "Archive Subject" button in the danger zone
   *   (planner's pattern — restoration happens elsewhere).
   * - `"toggle"`: a footer button that toggles between "Archive" and
   *   "Restore" based on the subject's current archived state (dashboard's
   *   pattern).
   *
   * Default: `"none"`.
   */
  archiveBehavior?: "none" | "one-way" | "toggle"

  /** External mutation lock from parent (e.g., planner's `isMutating`). */
  isMutating?: boolean

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

export function SubjectDrawer({
  open,
  mode,
  subjectId,
  initialSubject = null,
  showDeadlineField = false,
  showDeleteAction = false,
  archiveBehavior = "none",
  isMutating = false,
  onClose,
  onSaved,
}: SubjectDrawerProps) {
  const { addToast } = useToast()
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Re-entrancy guard so a stuck network can't double-submit if the user
  // mashes the save button. Independent of React state so it can flip
  // synchronously inside event handlers.
  const actionLockRef = useRef(false)

  const [name, setName] = useState("")
  const [deadline, setDeadline] = useState("")
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [subjectArchived, setSubjectArchived] = useState(false)

  const busy = isMutating || loading || deleting || archiving

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

  // Hydrate form fields whenever the drawer (re-)opens. We deliberately do
  // NOT depend on `addToast` (it would re-fire the effect on every render);
  // capture it via ref-style closure that's safe for fire-and-forget toasts.
  useEffect(() => {
    if (!open) return

    if (mode === "create") {
      setName("")
      setDeadline("")
      setSubjectArchived(false)
      return
    }

    if (mode === "edit" && subjectId) {
      // Optimistic prefill — skip the round-trip when the parent already
      // has the data in hand (planner's table snapshot path).
      if (initialSubject) {
        setName(initialSubject.name)
        setDeadline(initialSubject.deadline ?? "")
        // We still need the archived flag for the toggle UI, fall through.
        // For one-way archive behavior, the prefill is enough.
        if (archiveBehavior !== "toggle") return
      }

      let cancelled = false
      void (async () => {
        const res = await getSubjectById(subjectId)
        if (cancelled) return

        if (res.status === "SUCCESS") {
          // Don't overwrite optimistic name/deadline if prefill was used.
          if (!initialSubject) {
            setName(res.subject.name)
            setDeadline(res.subject.deadline ?? "")
          }
          setSubjectArchived(res.subject.archived)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, subjectId, initialSubject, archiveBehavior])

  async function handleSaveSubject(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    if (showDeadlineField && deadline) {
      // Cheap client-side guard. Server still validates.
      // (Start-date guard from the old planner version was tied to a field
      // that was already commented out — dropped intentionally.)
    }

    if (!beginAction()) return
    setLoading(true)

    try {
      if (mode === "create") {
        const res = await addSubject({
          name,
          deadline: showDeadlineField ? (deadline || null) : null,
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
          deadline: showDeadlineField ? (deadline || null) : null,
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

  async function handleArchiveOneWay() {
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

  async function handleArchiveToggle() {
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
    } catch (error) {
      showMutationError(error, "Failed to update archive state.")
    } finally {
      setArchiving(false)
    }
  }

  const showDangerZone = mode === "edit" && (showDeleteAction || archiveBehavior === "one-way")
  const showFooterToggle = mode === "edit" && archiveBehavior === "toggle"

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return
        onClose()
      }}
      title={mode === "create" ? "Add New Subject" : "Edit Subject"}
      size="lg"
      initialFocusRef={nameInputRef}
    >
      <form id="subject-form" onSubmit={handleSaveSubject} className="space-y-5">
        <div>
          <label
            className="mb-2 block text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--sh-text-muted)" }}
          >
            Subject Name
          </label>
          <input
            ref={nameInputRef}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. System Design, Calculus"
            className="ui-input"
            disabled={busy}
          />
        </div>

        {showDeadlineField && (
          <div>
            <label
              className="mb-2 block text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--sh-text-muted)" }}
            >
              Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="ui-input"
              disabled={busy}
            />
          </div>
        )}

        <p className="text-xs leading-relaxed" style={{ color: "var(--sh-text-muted)" }}>
          This page is for structure storage. Keep subjects, chapters, topics, and task titles organized here.
        </p>

        {showDangerZone && (
          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: "rgba(248,113,113,0.35)",
              background: "rgba(248,113,113,0.08)",
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
              Danger Zone
            </p>
            {showDeleteAction && (
              <>
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
              </>
            )}
            {archiveBehavior === "one-way" && (
              <>
                {showDeleteAction && <div className="h-2" />}
                <button
                  type="button"
                  onClick={() => {
                    void handleArchiveOneWay()
                  }}
                  disabled={busy}
                  className="ui-btn ui-btn-danger ui-btn-sm mt-2"
                >
                  {archiving ? "Archiving..." : "Archive Subject"}
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={busy}
            className={`ui-btn ui-btn-primary ui-btn-md justify-center disabled:opacity-50 ${
              showFooterToggle ? "flex-1" : "w-full"
            }`}
          >
            {loading ? "Saving..." : mode === "create" ? "Create Subject" : "Save Changes"}
          </button>

          {showFooterToggle && (
            <button
              type="button"
              onClick={() => {
                void handleArchiveToggle()
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
      </form>
    </Modal>
  )
}
