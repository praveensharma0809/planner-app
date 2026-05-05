"use client"

import React, { type MutableRefObject } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EventCard, QuickAddButton } from "./schedule-page.cards"
import type { CalendarEvent } from "./schedule-page.helpers"

type DayColumnProps = {
  day: number
  events: CalendarEvent[]
  eventElementMapRef: MutableRefObject<Map<string, HTMLDivElement>>
  isLast: boolean
  busyTaskIds: Set<string>
  onQuickAdd: (day: number) => void
  onEditEvent: (eventId: string) => void
  onDeleteEvent: (eventId: string) => void
  onToggleComplete: (eventId: string, nextCompleted: boolean) => void
}

const DayColumn = React.memo(function DayColumn({
  day,
  events,
  eventElementMapRef,
  isLast,
  busyTaskIds,
  onQuickAdd,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` })

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-0 flex-col ${isLast ? "" : "border-r border-border-hairline"}`}
      style={{
        background: isOver ? "var(--surface-hover)" : "transparent",
      }}
    >
      <div
        className="min-h-0 flex-1 space-y-[var(--gap-card)] overflow-y-auto p-2"
        style={{
          height: "100%",
        }}
      >
        {events.length === 0 ? (
          <div
            className="flex h-full min-h-0 flex-1 flex-col items-center justify-center rounded-[6px] border border-dashed gap-2 text-xs"
            style={{
              borderColor: isOver ? "var(--border-subtle)" : "var(--border-hairline)",
              color: isOver ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <button
              type="button"
              onClick={() => onQuickAdd(day)}
              className="flex items-center justify-center rounded-full w-6 h-6 transition hover:bg-[--surface-hover]"
              style={{ color: "var(--text-secondary)" }}
              aria-label="Quick add task"
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
            <span>{isOver ? "Release to move task" : "No tasks for this day"}</span>
          </div>
        ) : (
          <SortableContext
            items={events.map((event) => event.id)}
            strategy={verticalListSortingStrategy}
          >
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                registerElement={(element) => {
                  if (element) {
                    eventElementMapRef.current.set(event.id, element)
                  } else {
                    eventElementMapRef.current.delete(event.id)
                  }
                }}
                busy={busyTaskIds.has(event.id)}
                onEdit={() => onEditEvent(event.id)}
                onDelete={() => onDeleteEvent(event.id)}
                onToggleComplete={() => onToggleComplete(event.id, !event.completed)}
              />
            ))}
          </SortableContext>
        )}
      </div>

      <div className="flex h-10 items-center justify-center border-t border-border-hairline">
        <QuickAddButton onClick={() => onQuickAdd(day)} />
      </div>
    </div>
  )
})

export default DayColumn
