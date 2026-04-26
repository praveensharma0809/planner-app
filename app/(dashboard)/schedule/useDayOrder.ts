"use client"

import { useEffect, useState } from "react"
import type { CalendarEvent, DayOrderMap } from "./schedule-page.helpers"
import { emptyDayOrderMap, readDayOrderStorage, writeDayOrderStorage } from "./schedule-page.helpers"

type UseDayOrderParams = {
  events: CalendarEvent[]
  weekStartISO: string
}

export function useDayOrder({ events, weekStartISO }: UseDayOrderParams) {
  const [dayOrderMap, setDayOrderMap] = useState<DayOrderMap>(emptyDayOrderMap)
  const [didHydrateDayOrder, setDidHydrateDayOrder] = useState(false)

  useEffect(() => {
    const storage = readDayOrderStorage()
    setDayOrderMap(storage[weekStartISO] ?? emptyDayOrderMap())
    setDidHydrateDayOrder(true)
  }, [weekStartISO])

  useEffect(() => {
    if (!didHydrateDayOrder) return
    const storage = readDayOrderStorage()
    writeDayOrderStorage({
      ...storage,
      [weekStartISO]: dayOrderMap,
    })
  }, [dayOrderMap, didHydrateDayOrder, weekStartISO])

  useEffect(() => {
    setDayOrderMap((previous) => {
      const next: DayOrderMap = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

      for (let day = 0; day < 7; day++) {
        const dayIds = events.filter((event) => event.day === day).map((event) => event.id)
        const previousForDay = previous[day] ?? []
        const kept = previousForDay.filter((id) => dayIds.includes(id))
        const missing = dayIds.filter((id) => !kept.includes(id))
        next[day] = [...kept, ...missing]
      }

      return next
    })
  }, [events])

  return { dayOrderMap, setDayOrderMap }
}
