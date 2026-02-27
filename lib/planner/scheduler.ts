import type { Subject } from "@/lib/types/db"

export type SchedulerMode = "strict" | "auto"

export interface ScheduledTask {
  subject_id: string
  scheduled_date: string
  duration_minutes: number
  title: string
  priority: number
}

export interface SchedulerResult {
  tasks: ScheduledTask[]
}

export function scheduler(
  subjects: Subject[],
  dailyAvailableMinutes: number,
  today: Date,
  options?: {
    examDeadline?: string | null
    offDays?: Set<string>
  }
): SchedulerResult {
  const offDays = options?.offDays ?? new Set<string>()
  const examDeadline = options?.examDeadline ?? null

  const active = subjects
    .map(s => {
      const remainingItems = s.total_items - s.completed_items
      const remainingMinutes =
        remainingItems * s.avg_duration_minutes

      const parsedDeadline = new Date(s.deadline)
      const subjectDeadline = isNaN(parsedDeadline.getTime())
        ? today
        : parsedDeadline

      const parsedExam = examDeadline ? new Date(examDeadline) : null
      const examDateClamped = parsedExam && !isNaN(parsedExam.getTime())
        ? parsedExam
        : null

      const deadlineDate = examDateClamped
        ? new Date(Math.min(subjectDeadline.getTime(), examDateClamped.getTime()))
        : subjectDeadline

      const daysLeft = Math.max(
        1,
        Math.ceil(
          (deadlineDate.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )

      const requiredDaily = remainingMinutes / daysLeft
      const urgencyScore = requiredDaily * s.priority

      return {
        ...s,
        remainingItems,
        remainingMinutes,
        urgencyScore,
        deadlineDate
      }
    })
    .filter(s => s.remainingItems > 0)

  if (active.length === 0) {
    return { tasks: [] }
  }

  // Sort: mandatory → deadline → urgency
  active.sort((a, b) => {
    if (a.mandatory !== b.mandatory) {
      return a.mandatory ? -1 : 1
    }
    if (a.deadlineDate.getTime() !== b.deadlineDate.getTime()) {
      return a.deadlineDate.getTime() - b.deadlineDate.getTime()
    }
    return b.urgencyScore - a.urgencyScore
  })

  const maxDeadline = active.reduce((max, s) =>
    s.deadlineDate > max ? s.deadlineDate : max,
    today
  )

  const tasks: ScheduledTask[] = []

  let currentDate = new Date(today)

  while (
    active.some(s => s.remainingItems > 0) &&
    currentDate <= maxDeadline
  ) {
    const isoDate = currentDate.toISOString().split("T")[0]

    if (offDays.has(isoDate)) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    let capacity = dailyAvailableMinutes

    for (const subject of active) {
      while (
        subject.remainingItems > 0 &&
        capacity >= subject.avg_duration_minutes &&
        currentDate <= subject.deadlineDate
      ) {
        tasks.push({
          subject_id: subject.id,
          scheduled_date: currentDate
            .toISOString()
            .split("T")[0],
          duration_minutes: subject.avg_duration_minutes,
          title: `${subject.priority} Priority Study`,
          priority: subject.priority
        })

        subject.remainingItems -= 1
        capacity -= subject.avg_duration_minutes
      }
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return {
    tasks
  }
}
