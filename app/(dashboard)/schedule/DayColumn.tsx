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
      className={isLast ? "flex h-full min-h-0 flex-col" : "flex h-full min-h-0 flex-col border-r"}
      style={{
        borderColor: "var(--sh-border)",
        background: isOver ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
      }}
    >
      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
        style={{
          height: "100%",
        }}
      >
        {events.length === 0 ? (
          <div
            className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed text-xs"
            style={{
              borderColor: isOver ? "var(--sh-primary)" : "var(--sh-border)",
              color: isOver ? "var(--sh-text-primary)" : "var(--sh-text-muted)",
            }}
          >
            {isOver ? "Release to move task" : "No tasks for this day"}
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

      <div className="flex h-10 items-center justify-center border-t" style={{ borderColor: "var(--sh-border)" }}>
        <QuickAddButton onClick={() => onQuickAdd(day)} />
      </div>
    </div>
  )
})

export default DayColumn
