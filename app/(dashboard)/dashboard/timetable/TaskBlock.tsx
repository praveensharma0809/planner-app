"use client"

import { CSS } from "@dnd-kit/utilities"
import { useSortable } from "@dnd-kit/sortable"
import type { Task } from "@/lib/types/db"

interface TaskBlockProps {
  task: Task
}

export function TaskBlock({ task }: TaskBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: task.id })

  const baseTransform = CSS.Transform.toString(transform) ?? ""
  const style = {
    transform: `${baseTransform}${isDragging ? " scale(1.02)" : ""}`.trim(),
    transition: "transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out",
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: "var(--tt-card)",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-md px-3 py-2 cursor-grab active:cursor-grabbing transition-colors transition-transform hover:-translate-y-0.5 hover:bg-[var(--tt-card-hover)]"
      aria-label={`Task ${task.title}`}
      tabIndex={0}
    >
      <div className="text-xs font-medium truncate" style={{ color: "var(--tt-text)" }}>
        {task.title}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px]" style={{ color: "var(--tt-muted)" }}>
          {task.duration_minutes} min
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: "color-mix(in srgb, var(--tt-track) 60%, transparent)",
            color: "var(--tt-muted)",
          }}
        >
          P{task.priority}
        </span>
      </div>
    </div>
  )
}
