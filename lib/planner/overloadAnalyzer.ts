import type { Subject } from "@/lib/types/db"

export interface OverloadResult {
  overload: boolean
  burnRate: number
  currentCapacity: number
  suggestedCapacity: number
}

export function overloadAnalyzer(
  subjects: Subject[],
  dailyAvailableMinutes: number,
  today: Date
): OverloadResult {
    const active = subjects.filter(
      s => s.total_items - s.completed_items > 0
    )
  
    if (active.length === 0) {
      return {
        overload: false,
        burnRate: 0,
        currentCapacity: dailyAvailableMinutes,
        suggestedCapacity: dailyAvailableMinutes
      }
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
      return {
        overload: false,
        burnRate,
        currentCapacity: dailyAvailableMinutes,
        suggestedCapacity: dailyAvailableMinutes
      }
    }
  
    return {
      overload: true,
      burnRate,
      currentCapacity: dailyAvailableMinutes,
      suggestedCapacity: Math.ceil(burnRate)
    }
  }
  