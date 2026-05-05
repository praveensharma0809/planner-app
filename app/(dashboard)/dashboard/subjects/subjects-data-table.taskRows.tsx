import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { RowActionButton } from "@/app/components/subjects-data-table/shared"
import type { TopicTaskItem } from "./subjects-data-table"

interface DraggableTaskRowProps {
  task: TopicTaskItem
  isPending: boolean
  isReordering: boolean
  showFullTitle: boolean
  canEdit: boolean
  onToggle: (completed: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

export function DraggableTaskRow({
  task,
  isPending,
  isReordering,
  showFullTitle,
  canEdit,
  onToggle,
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
        cursor: isDragging ? "grabbing" : "grab",
      }}
      className={`group rounded-xl px-2.5 py-2 transition-colors ${task.completed ? "bg-pastel-mint/40" : isDragging ? "bg-surface-hover" : "hover:bg-surface-hover"}`}
    >
      <div className={`flex gap-2 ${showFullTitle ? "items-start" : "items-center"}`}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-xs transition-colors text-text-muted hover:bg-surface-hover disabled:opacity-50 md:min-h-0 md:min-w-0"
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
          className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[5px] transition-colors disabled:opacity-50 md:min-h-0 md:min-w-0 ${task.completed ? "border-2 border-black bg-black" : "border-2 border-border-subtle hover:border-text-primary bg-transparent"}`}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center">
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
          </span>
        </button>

        <p
          className={`min-w-0 flex-1 text-[13px] font-medium ${task.completed ? "line-through text-text-muted" : "text-text-primary"} ${showFullTitle ? "whitespace-normal break-words leading-[1.25]" : "truncate"}`}
          title={task.title}
        >
          {task.title}
        </p>

        <RowActionButton
          label="Edit task title"
          onClick={onEdit}
          disabled={isPending || !canEdit}
        />
        <RowActionButton
          label="Delete task"
          onClick={onDelete}
          danger
          disabled={isPending || !canEdit}
        />
      </div>
    </div>
  )
}
