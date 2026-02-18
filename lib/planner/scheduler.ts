import { SubjectInput } from "./overloadAnalyzer"

export type SchedulerMode = "strict" | "auto"

export type GeneratedTask = {
  subject_id: string
  scheduled_date: string
  duration_minutes: number
  title: string
  priority: number
}

export function scheduler(
  subjects: SubjectInput[],
  dailyAvailableMinutes: number,
  mode: SchedulerMode,
  today: Date
) {
  const active = subjects
    .map(s => {
      const remainingItems = s.total_items - s.completed_items
      const remainingMinutes =
        remainingItems * s.avg_duration_minutes

      const deadlineDate = new Date(s.deadline)

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
    return { tasks: [], effectiveCapacity: dailyAvailableMinutes }
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

  const totalRemaining = active.reduce(
    (sum, s) => sum + s.remainingMinutes,
    0
  )

  const maxDeadline = active.reduce((max, s) =>
    s.deadlineDate > max ? s.deadlineDate : max,
    today
  )

  const totalDays = Math.max(
    1,
    Math.ceil(
      (maxDeadline.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  )

  const burnRate = totalRemaining / totalDays

  const effectiveCapacity =
    mode === "auto"
      ? Math.max(dailyAvailableMinutes, Math.ceil(burnRate))
      : dailyAvailableMinutes

  const tasks: GeneratedTask[] = []

  let currentDate = new Date(today)

  while (
    active.some(s => s.remainingItems > 0) &&
    currentDate <= maxDeadline
  ) {
    let capacity = effectiveCapacity

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
    tasks,
    effectiveCapacity
  }
}
