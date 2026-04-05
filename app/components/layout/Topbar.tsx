"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "@/app/components/ThemeProvider"
import {
  useScheduleTopbar,
  type ScheduleTopbarState,
} from "@/app/components/layout/ScheduleTopbarContext"
import { useSidebar } from "./AppShell"
import {
  createDefaultWizardProgress,
  loadWizardProgress,
  PLANNER_PHASES,
  PLANNER_WIZARD_PROGRESS_EVENT,
  PLANNER_WIZARD_RESET_EVENT,
  saveWizardProgress,
  type PlannerWizardProgress,
} from "@/app/(dashboard)/planner/wizard-state"

// ─── Icons ────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// ─── Page title resolver ──────────────────────────────────────

const ROUTE_TITLES: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/dashboard$/,               title: "Overview"   },
  { pattern: /^\/dashboard\/overview/,      title: "Overview"   },
  { pattern: /^\/dashboard\/calendar/,      title: "Calendar"   },
  { pattern: /^\/dashboard\/subjects/,      title: "Subjects"   },
  { pattern: /^\/dashboard\/timetable/,     title: "Timetable"  },
  { pattern: /^\/dashboard\/settings/,      title: "Settings"   },
  { pattern: /^\/schedule/,                 title: "Schedule"   },
  { pattern: /^\/planner/,                  title: "Planner"    },
  { pattern: /^\/onboarding/,               title: "Onboarding" },
]

function resolvePageTitle(pathname: string): string {
  return ROUTE_TITLES.find(({ pattern }) => pattern.test(pathname))?.title ?? "StudyHard"
}

// ─── Topbar ───────────────────────────────────────────────────

/**
 * Topbar — sticky horizontal bar rendered at the top of the shell body.
 *
 * Contains:
 *   - Mobile hamburger menu button
 *   - Current page title (auto-resolved from pathname)
 *   - Theme toggle
 */
export function Topbar() {
  const { toggleMobile } = useSidebar()
  const { theme, toggle } = useTheme()
  const { state: scheduleTopbar } = useScheduleTopbar()
  const pathname = usePathname()
  const pageTitle = resolvePageTitle(pathname)
  const isPlannerRoute = pathname.startsWith("/planner")
  const isScheduleRoute = pathname.startsWith("/schedule")
  const showScheduleControls = isScheduleRoute && scheduleTopbar.enabled
  const hideMenuOnRoute =
    pathname === "/dashboard" ||
    pathname === "/dashboard/overview" ||
    pathname.startsWith("/dashboard/calendar") ||
    pathname.startsWith("/dashboard/subjects") ||
    pathname === "/dashboard/schedule" ||
    pathname.startsWith("/dashboard/schedule") ||
    pathname === "/schedule" ||
    pathname.startsWith("/schedule/")

  const [plannerProgress, setPlannerProgress] = useState<PlannerWizardProgress>(
    createDefaultWizardProgress()
  )
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsMounted(true)
      setPlannerProgress(loadWizardProgress() ?? createDefaultWizardProgress())
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!isPlannerRoute) return

    const handleProgressChanged = (event: Event) => {
      const detail = (event as CustomEvent<PlannerWizardProgress>).detail
      if (!detail) return
      setPlannerProgress(detail)
    }

    window.addEventListener(PLANNER_WIZARD_PROGRESS_EVENT, handleProgressChanged)
    return () => {
      window.removeEventListener(PLANNER_WIZARD_PROGRESS_EVENT, handleProgressChanged)
    }
  }, [isPlannerRoute])

  const plannerTitleClass = useMemo(
    () => (isPlannerRoute ? "topbar-page-title topbar-page-title-planner" : "topbar-page-title"),
    [isPlannerRoute]
  )

  function handlePlannerPhaseSelect(phaseId: number) {
    if (phaseId > plannerProgress.maxPhase) return
    saveWizardProgress({
      phase: phaseId,
      maxPhase: plannerProgress.maxPhase,
    })
  }

  function handlePlannerResetRequest() {
    window.dispatchEvent(new CustomEvent(PLANNER_WIZARD_RESET_EVENT))
  }

  if (showScheduleControls && !isPlannerRoute) {
    return (
      <header className="topbar-root topbar-root-schedule" role="banner">
        <div className="schedule-topbar-head-row">
          <div className="schedule-topbar-head-left">
            {!hideMenuOnRoute && (
              <button
                onClick={toggleMobile}
                className="topbar-icon-btn lg:hidden"
                aria-label="Open navigation menu"
              >
                <MenuIcon />
              </button>
            )}

            <h1 className="topbar-page-title schedule-topbar-title" title={scheduleTopbar.weekRangeTitle}>
              {scheduleTopbar.weekRangeTitle}
            </h1>
          </div>

          <button
            onClick={toggle}
            className="topbar-icon-btn"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        <ScheduleTopbarControls state={scheduleTopbar} />
      </header>
    )
  }

  return (
    <header className="topbar-root" role="banner">
      {/* Mobile hamburger */}
      {!isPlannerRoute && !hideMenuOnRoute && (
        <button
          onClick={toggleMobile}
          className="topbar-icon-btn lg:hidden"
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </button>
      )}

      {/* Page title */}
      <h1 className={`${plannerTitleClass} ${isPlannerRoute ? "truncate" : "flex-1 truncate"}`}>
        {pageTitle}
      </h1>

      {isPlannerRoute && isMounted && (
        <>
          <nav className="planner-topbar-phase-nav" aria-label="Planner phases">
            {PLANNER_PHASES.map((phase) => {
              const isActive = phase.id === plannerProgress.phase
              const isReachable = phase.id <= plannerProgress.maxPhase

              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => isReachable && handlePlannerPhaseSelect(phase.id)}
                  disabled={!isReachable}
                  className={`planner-topbar-phase-btn ${isActive ? "planner-topbar-phase-btn-active" : ""}`}
                  aria-current={isActive ? "step" : undefined}
                  title={phase.title}
                >
                  {phase.shortLabel}
                </button>
              )
            })}
          </nav>

          <button
            onClick={handlePlannerResetRequest}
            className="planner-topbar-reset-btn"
            type="button"
          >
            Reset
          </button>
        </>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="topbar-icon-btn"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  )
}

function ScheduleTopbarControls({ state }: { state: ScheduleTopbarState }) {
  return (
    <div className="schedule-topbar-controls" aria-label="Schedule controls">
      <div className="schedule-topbar-section schedule-topbar-section-nav" aria-label="Week and month navigation">
        <div className="schedule-topbar-group schedule-topbar-group-nav">
          <button type="button" className="schedule-topbar-btn" onClick={state.onPrevMonth} aria-label="Previous month">
            Month-
          </button>
          <button type="button" className="schedule-topbar-btn" onClick={state.onPrevWeek} aria-label="Previous week">
            Week-
          </button>
          <button
            type="button"
            className="schedule-topbar-btn"
            onClick={state.onCurrentWeek}
            aria-label="Current week"
            disabled={state.isCurrentWeek}
          >
            Current
          </button>
          <button type="button" className="schedule-topbar-btn" onClick={state.onNextWeek} aria-label="Next week">
            Week+
          </button>
          <button type="button" className="schedule-topbar-btn" onClick={state.onNextMonth} aria-label="Next month">
            Month+
          </button>
        </div>
      </div>

      <div className="schedule-topbar-section schedule-topbar-section-subjects">
        <div className="schedule-topbar-chip-scroll" aria-label="Subject filters">
          {state.chips.map((chip) => {
            const isActive = chip.id === state.activeChipId
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => state.onChipClick(chip.id)}
                className={`schedule-topbar-chip ${isActive ? "schedule-topbar-chip-active" : ""}`}
                aria-pressed={isActive}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="schedule-topbar-section schedule-topbar-section-actions" aria-label="Schedule actions">
        <div className="schedule-topbar-group">
          <select
            value={state.statusFilter}
            onChange={(event) => state.onStatusFilterChange(event.target.value as ScheduleTopbarState["statusFilter"])}
            className="schedule-topbar-select"
            aria-label="Filter by completion status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>

          <button
            type="button"
            onClick={state.onImportPlanner}
            disabled={state.isImportingPlanner}
            className="schedule-topbar-btn"
          >
            {state.isImportingPlanner ? "Syncing" : "Import"}
          </button>

          <button
            type="button"
            onClick={state.onAddEvent}
            className="schedule-topbar-btn schedule-topbar-btn-primary"
          >
            + Add Event
          </button>
        </div>
      </div>
    </div>
  )
}
