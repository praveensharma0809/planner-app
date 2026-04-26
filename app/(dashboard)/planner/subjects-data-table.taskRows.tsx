import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { MIN_SESSION_LENGTH_MINUTES, MAX_SESSION_LENGTH_MINUTES } from "@/lib/planner/draft"
import { RowActionButton } from "@/app/components/subjects-data-table/shared"
import type { TopicTaskItem } from "./subjects-data-table"

interface DraggableTaskRowProps {
  task: TopicTaskItem
  isPending: boolean
  isDurationSaving: boolean
  isReordering: boolean
  canEdit: boolean
  durationDraft: string
  onToggle: (completed: boolean) => void
  onDurationDraftChange: (value: string) => void
  onDurationSave: () => void
  onEdit: () => void
  onDelete: () => void
}

export function DraggableTaskRow({
  task,
  isPending,
  isDurationSaving,
  isReordering,
  canEdit,
  durationDraft,
  onToggle,
  onDurationDraftChange,
  onDurationSave,
  onEdit,
  onDelete,
}: DraggableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging || isReordering ? 0.7 : 1,
        borderColor: isDragging ? "var(--sh-primary-glow)" : "var(--sh-border)",
        background: task.completed
          ? "rgba(52, 211, 153, 0.08)"
          : isDragging
            ? "rgba(124, 108, 255, 0.1)"
            : "rgba(255, 255, 255, 0.02)",
        cursor: isDragging ? "grabbing" : "default",
      }}
      className="group rounded-lg border px-2 py-1.5 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={!canEdit}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs transition-colors hover:bg-white/5 disabled:opacity-50"
          style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)", touchAction: "none" }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M2 5h7v1H2V5zm0 3h7v1H2V8zm0 3h7v1H2v-1z" />
            <path d="M10 5h4v1h-4V5zm0 3h4v1h-4V8zm0 3h4v1h-4v-1z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onToggle(!task.completed)}
          disabled={isPending || !canEdit}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-50"
          style={{
            borderColor: task.completed
              ? "var(--sh-success)"
              : "var(--sh-border)",
            background: task.completed ? "var(--sh-success)" : "transparent",
          }}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          {task.completed && (
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1 flex items-center gap-2">
          <p
            className={`min-w-0 flex-1 text-[13px] font-medium ${task.completed ? "line-through opacity-60" : ""} truncate`}
            style={{ color: "var(--sh-text-primary)" }}
            title={task.title}
          >
            {task.title}
          </p>

          <input
            type="number"
            min={MIN_SESSION_LENGTH_MINUTES}
            max={MAX_SESSION_LENGTH_MINUTES}
            value={durationDraft}
            onChange={(event) => onDurationDraftChange(event.target.value)}
            onBlur={onDurationSave}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                onDurationSave()
              }
            }}
            disabled={isDurationSaving || !canEdit}
            className="ui-input h-7 text-xs text-center"
            style={{ width: "4.2rem" }}
            title="Task duration (minutes)"
          />

          {isDurationSaving && (
            <span className="text-[10px] shrink-0" style={{ color: "var(--sh-text-muted)" }}>
              Saving...
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <RowActionButton
            label="Edit task title"
            onClick={onEdit}
            disabled={isPending || isDurationSaving || !canEdit}
          />
          <RowActionButton
            label="Delete task"
            onClick={onDelete}
            danger
            disabled={isPending || isDurationSaving || !canEdit}
          />
        </div>
      </div>
    </div>
  )
}
