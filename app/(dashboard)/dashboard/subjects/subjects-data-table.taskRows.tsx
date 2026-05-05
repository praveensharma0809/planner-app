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
      className={`group rounded-lg px-2 py-1.5 transition-colors ${task.completed ? "bg-pastel-mint/40" : isDragging ? "bg-surface-hover" : "hover:bg-surface-hover"}`}
    >
      <div className={`flex gap-1.5 ${showFullTitle ? "items-start" : "items-center"}`}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded text-xs transition-opacity text-text-muted opacity-0 group-hover:opacity-60 hover:!opacity-100 disabled:opacity-50 md:min-h-0 md:min-w-0"
          style={{ touchAction: "none" }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <svg
            className="h-3 w-3"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M3 3h2v2H3V3zm0 4h2v2H3V7zm0 4h2v2H3v-2zm4-8h2v2H7V3zm0 4h2v2H7V7zm0 4h2v2H7v-2zm4-8h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onToggle(!task.completed)}
          disabled={isPending || !canEdit}
          className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[4px] transition-colors disabled:opacity-50 md:min-h-0 md:min-w-0 ${task.completed ? "border-[1.5px] border-black bg-black" : "border-[1.5px] border-border-subtle hover:border-text-primary bg-transparent"}`}
          aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
        >
          <span className="flex h-[16px] w-[16px] items-center justify-center">
            {task.completed && (
              <svg
                className="h-2.5 w-2.5 text-white"
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
          className={`min-w-0 flex-1 text-[12.5px] font-medium ${task.completed ? "line-through text-text-muted" : "text-text-primary"} truncate`}
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
