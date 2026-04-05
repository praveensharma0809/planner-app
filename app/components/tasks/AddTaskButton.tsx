"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import { Modal } from "@/app/components/ui"
import { STANDALONE_SUBJECT_ID, STANDALONE_SUBJECT_LABEL } from "@/lib/constants"
import { createTaskViaUnifiedFlow } from "@/app/components/tasks/taskWriteGateway"

type SubjectOption = {
  id: string
  name: string
}

type AddTaskButtonProps = {
  subjects: SubjectOption[]
  initialDate: string
  buttonLabel?: string
  buttonClassName?: string
  onCreated?: () => void
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240] as const

export function AddTaskButton({
  subjects,
  initialDate,
  buttonLabel = "Add Task",
  buttonClassName,
  onCreated,
}: AddTaskButtonProps) {
  const router = useRouter()
  const { addToast } = useToast()

  const subjectOptions = useMemo(
    () => [...subjects, { id: STANDALONE_SUBJECT_ID, name: STANDALONE_SUBJECT_LABEL }],
    [subjects]
  )

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [subjectId, setSubjectId] = useState(subjectOptions[0]?.id ?? STANDALONE_SUBJECT_ID)
  const [scheduledDate, setScheduledDate] = useState(initialDate)
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setScheduledDate(initialDate)
  }, [initialDate])

  useEffect(() => {
    if (subjectOptions.some((subject) => subject.id === subjectId)) {
      return
    }
    setSubjectId(subjectOptions[0]?.id ?? STANDALONE_SUBJECT_ID)
  }, [subjectId, subjectOptions])

  const resetForm = () => {
    setTitle("")
    setDurationMinutes(60)
    setSubjectId(subjectOptions[0]?.id ?? STANDALONE_SUBJECT_ID)
    setScheduledDate(initialDate)
  }

  const handleSubmit = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle || saving) return

    setSaving(true)
    try {
      const result = await createTaskViaUnifiedFlow({
        title: trimmedTitle,
        subjectId,
        scheduledDate,
        durationMinutes,
      })

      if (result.status === "SUCCESS") {
        addToast("Task created.", "success")
        setOpen(false)
        resetForm()
        router.refresh()
        onCreated?.()
        return
      }

      if (result.status === "UNAUTHORIZED") {
        addToast("Please sign in again.", "error")
        return
      }

      if (result.status === "NOT_FOUND") {
        addToast("Subject not found.", "error")
        return
      }

      addToast(result.message || "Could not create task.", "error")
    } catch {
      addToast("Could not create task right now.", "error")
    } finally {
      setSaving(false)
    }
  }

  const resolvedButtonClassName = buttonClassName
    ?? "ui-btn ui-btn-primary ui-btn-sm"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={resolvedButtonClassName}
      >
        {buttonLabel}
      </button>

      <Modal
        open={open}
        onClose={() => {
          if (saving) return
          setOpen(false)
        }}
        title="Add Task"
        size="md"
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--sh-text-secondary)" }}>
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter task title"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: "color-mix(in srgb, var(--sh-card) 88%, var(--foreground) 12%)",
                borderColor: "var(--sh-border)",
                color: "var(--sh-text-primary)",
              }}
              disabled={saving}
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: "var(--sh-text-secondary)" }}>
                Subject
              </span>
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  background: "color-mix(in srgb, var(--sh-card) 88%, var(--foreground) 12%)",
                  borderColor: "var(--sh-border)",
                  color: "var(--sh-text-primary)",
                }}
                disabled={saving}
              >
                {subjects.length > 0 ? (
                  <optgroup label="Subjects">
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Standalone">
                  <option value={STANDALONE_SUBJECT_ID}>{STANDALONE_SUBJECT_LABEL}</option>
                </optgroup>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: "var(--sh-text-secondary)" }}>
                Date
              </span>
              <input
                type="date"
                value={scheduledDate}
                onChange={(event) => setScheduledDate(event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  background: "color-mix(in srgb, var(--sh-card) 88%, var(--foreground) 12%)",
                  borderColor: "var(--sh-border)",
                  color: "var(--sh-text-primary)",
                }}
                disabled={saving}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: "var(--sh-text-secondary)" }}>
              Duration
            </span>
            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                background: "color-mix(in srgb, var(--sh-card) 88%, var(--foreground) 12%)",
                borderColor: "var(--sh-border)",
                color: "var(--sh-text-primary)",
              }}
              disabled={saving}
            >
              {DURATION_OPTIONS.map((value) => (
                <option key={value} value={value}>{value} min</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || !title.trim()}
            className="ui-btn ui-btn-primary ui-btn-md w-full"
          >
            {saving ? "Creating..." : "Create Task"}
          </button>
        </div>
      </Modal>
    </>
  )
}
