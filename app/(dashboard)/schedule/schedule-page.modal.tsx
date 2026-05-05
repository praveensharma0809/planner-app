import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { type ScheduleSubjectOption } from "@/app/actions/schedule/getWeekSchedule"
import { STANDALONE_SUBJECT_ID } from "@/lib/constants"
import { DAY_LABELS, DURATION_OPTIONS, formatDayDateLabel, formatDuration } from "./schedule-page.helpers"

export type ScheduleModalDraft = {
  title: string
  subjectId: string
  day: number
  durationMinutes: number
}

export type ScheduleModalEvent = {
  id: string
  title: string
  subjectId: string
  day: number
  durationMinutes: number
}

type AddEventModalProps = {
  presetDay: number
  initialEvent: ScheduleModalEvent | null
  weekDates: string[]
  subjectOptions: ScheduleSubjectOption[]
  isSaving: boolean
  onClose: () => void
  onSubmit: (draft: ScheduleModalDraft, eventId?: string) => Promise<boolean>
}

export function AddEventModal({
  presetDay,
  initialEvent,
  weekDates,
  subjectOptions,
  isSaving,
  onClose,
  onSubmit,
}: AddEventModalProps) {
  const firstSubject = subjectOptions[0]?.id ?? STANDALONE_SUBJECT_ID

  const [title, setTitle] = useState(() => initialEvent?.title ?? "")
  const [subjectId, setSubjectId] = useState<string>(() => initialEvent?.subjectId ?? firstSubject)
  const [day, setDay] = useState<number>(() => initialEvent?.day ?? presetDay)
  const [durationMinutes, setDurationMinutes] = useState<number>(
    () => initialEvent?.durationMinutes ?? 60
  )

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose()
    }

    document.addEventListener("keydown", onEscape)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onEscape)
      document.body.style.overflow = ""
    }
  }, [isSaving, onClose])

  const durationOptions = useMemo(() => {
    const values = new Set<number>(DURATION_OPTIONS)
    values.add(Math.max(15, durationMinutes))
    return [...values].sort((a, b) => a - b)
  }, [durationMinutes])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle || isSaving) return

    const success = await onSubmit(
      {
        title: trimmedTitle,
        subjectId,
        day,
        durationMinutes,
      },
      initialEvent?.id
    )

    if (success) {
      onClose()
    }
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="fixed inset-0 bg-black/55"
        onClick={() => {
          if (!isSaving) onClose()
        }}
        aria-label="Close modal"
      />

      <div
        className="fixed bottom-0 left-0 right-0 top-auto z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl rounded-b-none border border-border-hairline border-b-0 bg-surface-panel p-5 shadow-[var(--shadow-app)] md:left-1/2 md:top-1/2 md:max-h-[90vh] md:w-[calc(100%-2rem)] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border-b"
      >
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {initialEvent ? "Edit Event" : "Add Event"}
        </h2>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Title">
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="ui-input"
              placeholder="Enter event title"
              disabled={isSaving}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject">
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="ui-input"
                disabled={isSaving}
              >
                {subjectOptions.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Day">
              <select
                value={day}
                onChange={(event) => setDay(Number(event.target.value))}
                className="ui-input"
                disabled={isSaving}
              >
                {DAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}, {formatDayDateLabel(weekDates[index])}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Duration">
            <select
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="ui-input"
              disabled={isSaving}
            >
              {durationOptions.map((value) => (
                <option key={value} value={value}>
                  {formatDuration(value)}
                </option>
              ))}
            </select>
          </Field>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-[--action-primary-bg-hover] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : initialEvent ? "Save Event" : "Create Event"}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      {children}
    </label>
  )
}
