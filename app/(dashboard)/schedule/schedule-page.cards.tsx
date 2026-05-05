import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { formatDuration, getSubjectPalette } from "./schedule-page.helpers"

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
        className={`cursor-grab rounded-[6px] border p-2 text-xs transition duration-200 ${
          isDragging
            ? "scale-[1.02] cursor-grabbing shadow-[var(--shadow-pop)]"
            : "hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
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
          <div className="min-w-0 flex flex-1 items-start gap-1.5">
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
                borderColor: event.completed ? "var(--pastel-mint-text)" : "var(--border-subtle)",
                background: event.completed ? "var(--pastel-mint)" : "transparent",
                color: event.completed ? "var(--pastel-mint-text)" : "var(--text-muted)",
              }}
              aria-label={event.completed ? "Mark as pending" : "Mark as completed"}
            >
              {event.completed ? "\u2713" : ""}
            </button>

            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-1">
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold leading-snug break-words"
                  title={event.title}
                  style={{
                    color: "var(--text-primary)",
                    textDecoration: event.completed ? "line-through" : "none",
                    opacity: event.completed ? 0.6 : 1,
                  }}
                >
                  {event.title}
                </p>

                <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                  <span className={`shrink-0 ${event.completed ? "chip-mint" : "chip-peach"}`}>
                    {event.completed ? "Completed" : "Pending"}
                  </span>
                  <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
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
      className="w-56 rounded-[6px] border p-2 text-xs shadow-[var(--shadow-pop)]"
      style={{
        transform: "scale(1.03)",
        cursor: "grabbing",
        ...palette.containerStyle,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold" style={{ color: "var(--text-primary)" }}>
            {event.title}
          </div>
          <span className={`mt-1 inline-flex items-center ${event.completed ? "chip-mint" : "chip-peach"}`}>
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
      className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full transition hover:bg-[--surface-hover] md:h-8 md:min-h-8 md:min-w-8 md:w-8"
      style={{
        background: "var(--surface-page)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-secondary)",
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
