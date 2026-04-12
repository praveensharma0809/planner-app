"use client"

import { Children, ReactNode } from "react"
import { useDroppable } from "@dnd-kit/core"

interface DayColumnProps {
  date: string
  label: string
  totalMinutes: number
  dailyAvailableMinutes: number
  isOverloaded: boolean
  isToday?: boolean
  isDragging?: boolean
  pulse?: boolean
  children: ReactNode
}

export function DayColumn({
  date,
  label,
  totalMinutes,
  dailyAvailableMinutes,
  isOverloaded,
  isToday,
  isDragging,
  pulse,
  children,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  const isEven = new Date(date + "T12:00:00").getDay() % 2 === 0
  const isEmpty = Children.count(children) === 0
  const showPlaceholder = isEmpty && (isDragging || isOver)
  const progress = dailyAvailableMinutes > 0
    ? Math.min(100, Math.round((totalMinutes / dailyAvailableMinutes) * 100))
    : 0

  return (
    <div
      ref={setNodeRef}
      className="group rounded-md px-4 py-6 space-y-3 min-h-[340px]"
      style={{
        backgroundColor: isEven
          ? "color-mix(in srgb, var(--background) 98%, var(--foreground) 2%)"
          : "transparent",
        borderTop: isOverloaded ? "1px solid var(--tt-overload)" : "1px solid transparent",
        boxShadow: pulse
          ? "0 0 0 1px var(--tt-today)"
          : isOver
            ? "0 0 0 1px var(--tt-border-strong)"
            : "none",
        transition: "box-shadow 180ms ease-out, background-color 180ms ease-out, border-top-color 180ms ease-out",
      }}
      aria-label={`${label} column`}
    >
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-xs uppercase tracking-wide"
              style={{ color: isToday ? "var(--tt-text)" : "var(--tt-muted)" }}
            >
              {label}
            </span>
            {isToday && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "var(--tt-today)", color: "var(--tt-text)" }}
              >
                Today
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1 pt-3">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--tt-track)" }}
          >
            <div
              className="h-1 rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor: isOverloaded ? "var(--tt-overfill)" : "var(--tt-fill)",
              }}
            />
          </div>
          <div className="text-[10px]" style={{ color: "var(--tt-muted)" }}>
            {totalMinutes} / {dailyAvailableMinutes} min
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {children}
        {isEmpty && (
          <div
            className={`text-[10px] text-center transition-opacity ${showPlaceholder ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            style={{ color: "var(--tt-muted)" }}
            aria-hidden={!showPlaceholder}
          >
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}
