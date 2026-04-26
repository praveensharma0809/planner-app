"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getTodayLocalDate } from "@/lib/tasks/getTasksForDate"
import {
  addDaysISO,
  clamp,
  dayIndexFromWeekStart,
  getWeekRangeMeta,
  parseISODate,
  type WeekRangeMeta,
} from "./schedule-page.helpers"

export function useWeekNavigation() {
  const [weekAnchorISO, setWeekAnchorISO] = useState(() => getTodayLocalDate())

  const weekMeta = useMemo<WeekRangeMeta>(
    () => getWeekRangeMeta(parseISODate(weekAnchorISO)),
    [weekAnchorISO]
  )

  const currentWeekStartISO = useMemo(() => getWeekRangeMeta(new Date()).weekStartISO, [])
  const isCurrentWeek = weekMeta.weekStartISO === currentWeekStartISO

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, day) => addDaysISO(weekMeta.weekStartISO, day)),
    [weekMeta.weekStartISO]
  )

  const [mobileDay, setMobileDay] = useState(0)

  useEffect(() => {
    const todayISO = getTodayLocalDate()
    const nextDay = dayIndexFromWeekStart(todayISO, weekMeta.weekStartISO)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing behavior: reset mobile day on week change
    setMobileDay(clamp(nextDay, 0, 6))
  }, [weekMeta.weekStartISO])

  const handleGoPrevWeek = useCallback(() => {
    setWeekAnchorISO(addDaysISO(weekMeta.weekStartISO, -7))
  }, [weekMeta.weekStartISO])

  const handleGoNextWeek = useCallback(() => {
    setWeekAnchorISO(addDaysISO(weekMeta.weekStartISO, 7))
  }, [weekMeta.weekStartISO])

  const handleGoCurrentWeek = useCallback(() => {
    setWeekAnchorISO(getTodayLocalDate())
  }, [])

  return {
    weekAnchorISO,
    setWeekAnchorISO,
    weekMeta,
    weekDates,
    currentWeekStartISO,
    isCurrentWeek,
    mobileDay,
    setMobileDay,
    handleGoPrevWeek,
    handleGoNextWeek,
    handleGoCurrentWeek,
  }
}
