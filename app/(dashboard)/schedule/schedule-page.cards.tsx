import type { CSSProperties } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { formatDuration, getSubjectPalette } from "./schedule-page.helpers"

const COMPLETED_BADGE_STYLE: CSSProperties = {
  background: "color-mix(in srgb, #10B981 28%, transparent)",
  color: "#34D399",
}

const PENDING_BADGE_STYLE: CSSProperties = {
  background: "color-mix(in srgb, #F59E0B 28%, transparent)",
  color: "#FBBF24",
}

export type ScheduleCardEvent = {
  id: string
  title: string
  subjectName: string
  durationMinutes: number
  completed: boolean
}

type EventCardProps = {
  event: ScheduleCardEvent
  registerElement: (element: HTMLDivElement | null) => void
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleComplete: () => void
}

export function EventCard({ event, registerElement, busy, onEdit, onDelete, onToggleComplete }: EventCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
  })

  const palette = getSubjectPalette(event.subjectName)
  const dragTransform = CSS.Translate.toString(transform)

  return (
    <div
      ref={(element) => {
        setNodeRef(element)
        registerElement(element)
      }}
      style={{
        transform: dragTransform,
        transition: transition ?? "transform 180ms ease-out, box-shadow 180ms ease-out",
        zIndex: isDragging ? 50 : 20,
      }}
      className="relative"
    >
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab rounded-lg border p-1.5 text-xs shadow-sm transition duration-200 ${
          isDragging
            ? "scale-[1.02] cursor-grabbing shadow-xl"
            : "hover:-translate-y-0.5 hover:shadow-md"
        }`}
        onPointerDownCapture={(event) => {
          const target = event.target as HTMLElement
          if (target.closest("button, input, select, textarea, a, [data-no-drag='true']")) {
            event.stopPropagation()
          }
        }}
        style={palette.containerStyle}
      >
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex flex-1 items-start gap-1">
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation()
                onToggleComplete()
              }}
              onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
              disabled={busy}
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] disabled:opacity-50"
              style={{
                borderColor: event.completed ? "#34D399" : "var(--sh-border)",
                background: event.completed ? "rgba(52, 211, 153, 0.18)" : "transparent",
                color: event.completed ? "#34D399" : "var(--sh-text-muted)",
              }}
              aria-label={event.completed ? "Mark as pending" : "Mark as completed"}
            >
              {event.completed ? "\u2713" : ""}
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-1">
              <div className="min-w-0">
                <p
                  className="text-[12.5px] font-semibold leading-snug break-words"
                  title={event.title}
                  style={{
                    color: "var(--sh-text-primary)",
                    textDecoration: event.completed ? "line-through" : "none",
                    opacity: event.completed ? 0.72 : 1,
                  }}
                >
                  {event.title}
                </p>

                <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px]">
                  <span
                    className="shrink-0 rounded px-1.5 py-px font-medium"
                    style={event.completed ? COMPLETED_BADGE_STYLE : PENDING_BADGE_STYLE}
                  >
                    {event.completed ? "Completed" : "Pending"}
                  </span>
                  <span className="shrink-0" style={{ color: "var(--sh-text-muted)" }}>
                    {formatDuration(event.durationMinutes)}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                <button
                  type="button"
                  className="task-icon-edit-button"
                  onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    onEdit()
                  }}
                  aria-label="Edit task"
                  title="Edit"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5l3 3" />
                  </svg>
                  <span className="sr-only">Edit</span>
                </button>

                <button
                  type="button"
                  className="task-icon-delete-button"
                  onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation()
                    onDelete()
                  }}
                  aria-label="Delete task"
                  title="Delete"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 13a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L5 6" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v7M14 10v7" />
                  </svg>
                  <span className="sr-only">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DragPreviewCard({ event }: { event: ScheduleCardEvent }) {
  const palette = getSubjectPalette(event.subjectName)

  return (
    <div
      className="w-56 rounded-md border p-2 text-xs shadow-2xl"
      style={{
        transform: "scale(1.03)",
        cursor: "grabbing",
        ...palette.containerStyle,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            {event.title}
          </div>
          <span
            className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={event.completed ? COMPLETED_BADGE_STYLE : PENDING_BADGE_STYLE}
          >
            {event.completed ? "Completed" : "Pending"}
          </span>
        </div>
      </div>
    </div>
  )
}

type QuickAddButtonProps = {
  onClick: () => void
}

export function QuickAddButton({ onClick }: QuickAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition"
      style={{
        background: "color-mix(in srgb, var(--sh-card) 70%, var(--sh-primary) 30%)",
        border: "1px solid color-mix(in srgb, var(--sh-primary) 24%, var(--sh-border) 76%)",
        color: "var(--sh-text-secondary)",
      }}
      aria-label="Quick add event"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
