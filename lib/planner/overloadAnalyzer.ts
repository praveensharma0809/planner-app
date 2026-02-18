export type SubjectInput = {
    id: string
    total_items: number
    completed_items: number
    avg_duration_minutes: number
    deadline: string
    priority: number
    mandatory: boolean
  }
  
  export type OverloadResult =
    | { overload: false }
    | {
        overload: true
        burnRate: number
        currentCapacity: number
        suggestedCapacity: number
      }
  
  export function overloadAnalyzer(
    subjects: SubjectInput[],
    dailyAvailableMinutes: number,
    today: Date
  ): OverloadResult {
    const active = subjects.filter(
      s => s.total_items - s.completed_items > 0
    )
  
    if (active.length === 0) {
      return { overload: false }
    }
  
    let totalRemainingMinutes = 0
    let maxDeadline = today
  
    for (const s of active) {
      const remainingItems = s.total_items - s.completed_items
      const remainingMinutes =
        remainingItems * s.avg_duration_minutes
  
      totalRemainingMinutes += remainingMinutes
  
      const deadlineDate = new Date(s.deadline)
      if (deadlineDate > maxDeadline) {
        maxDeadline = deadlineDate
      }
    }
  
    const totalDays = Math.max(
      1,
      Math.ceil(
        (maxDeadline.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    )
  
    const burnRate = totalRemainingMinutes / totalDays
  
    if (burnRate <= dailyAvailableMinutes) {
      return { overload: false }
    }
  
    return {
      overload: true,
      burnRate,
      currentCapacity: dailyAvailableMinutes,
      suggestedCapacity: Math.ceil(burnRate)
    }
  }
  