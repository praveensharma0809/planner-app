"use client"

import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

export type ScheduleTopbarStatusFilter = "all" | "pending" | "completed"

export type ScheduleTopbarChip = {
  id: string
  label: string
}

export type ScheduleTopbarState = {
  enabled: boolean
  weekRangeTitle: string
  isCurrentWeek: boolean
  chips: ScheduleTopbarChip[]
  activeChipId: string
  statusFilter: ScheduleTopbarStatusFilter
  isImportingPlanner: boolean
  onChipClick: (chipId: string) => void
  onStatusFilterChange: (value: ScheduleTopbarStatusFilter) => void
  onAddEvent: () => void
  onImportPlanner: () => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onCurrentWeek: () => void
}

type ScheduleTopbarContextValue = {
  state: ScheduleTopbarState
  setState: Dispatch<SetStateAction<ScheduleTopbarState>>
  resetState: () => void
}

const NOOP = () => {}

const defaultState: ScheduleTopbarState = {
  enabled: false,
  weekRangeTitle: "",
  isCurrentWeek: false,
  chips: [],
  activeChipId: "all",
  statusFilter: "all",
  isImportingPlanner: false,
  onChipClick: NOOP,
  onStatusFilterChange: NOOP,
  onAddEvent: NOOP,
  onImportPlanner: NOOP,
  onPrevWeek: NOOP,
  onNextWeek: NOOP,
  onPrevMonth: NOOP,
  onNextMonth: NOOP,
  onCurrentWeek: NOOP,
}

const ScheduleTopbarContext = createContext<ScheduleTopbarContextValue>({
  state: defaultState,
  setState: NOOP as Dispatch<SetStateAction<ScheduleTopbarState>>,
  resetState: NOOP,
})

export function ScheduleTopbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScheduleTopbarState>(defaultState)
  const resetState = useCallback(() => {
    setState(defaultState)
  }, [])

  const value = useMemo<ScheduleTopbarContextValue>(() => ({
    state,
    setState,
    resetState,
  }), [resetState, state])

  return (
    <ScheduleTopbarContext.Provider value={value}>
      {children}
    </ScheduleTopbarContext.Provider>
  )
}

export function useScheduleTopbar() {
  return useContext(ScheduleTopbarContext)
}
