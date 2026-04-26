"use client"

import { useEffect, useMemo, useState } from "react"
import type { ScheduleSubjectOption } from "@/app/actions/schedule/getWeekSchedule"
import type { ScheduleTopbarStatusFilter } from "@/app/components/layout/ScheduleTopbarContext"
import { STANDALONE_SUBJECT_ID, STANDALONE_SUBJECT_LABEL } from "@/lib/constants"
import type { CalendarEvent } from "./schedule-page.helpers"

type StatusFilter = ScheduleTopbarStatusFilter

type FilterChip = {
  id: string
  label: string
  subjectId: string | "all"
}

type UseScheduleFiltersParams = {
  subjects: ScheduleSubjectOption[]
  events: CalendarEvent[]
}

export function useScheduleFilters({ subjects, events }: UseScheduleFiltersParams) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [activeChipId, setActiveChipId] = useState("all")

  const filterChips = useMemo<FilterChip[]>(() => {
    return [
      { id: "all", label: "All", subjectId: "all" },
      ...subjects.map((subject) => ({
        id: `subject-${subject.id}`,
        label: subject.name,
        subjectId: subject.id,
      })),
      {
        id: `subject-${STANDALONE_SUBJECT_ID}`,
        label: STANDALONE_SUBJECT_LABEL,
        subjectId: STANDALONE_SUBJECT_ID,
      },
    ]
  }, [subjects])

  useEffect(() => {
    if (filterChips.some((chip) => chip.id === activeChipId)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing behavior: chip fallback reset
    setActiveChipId("all")
  }, [activeChipId, filterChips])

  const selectedChip = useMemo(
    () => filterChips.find((chip) => chip.id === activeChipId) ?? filterChips[0],
    [activeChipId, filterChips]
  )

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSubject =
        selectedChip.subjectId === "all" || selectedChip.subjectId === event.subjectId
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "completed"
            ? event.completed
            : !event.completed

      return matchesSubject && matchesStatus
    })
  }, [events, selectedChip, statusFilter])

  return {
    statusFilter,
    setStatusFilter,
    activeChipId,
    setActiveChipId,
    filterChips,
    selectedChip,
    filteredEvents,
  }
}
