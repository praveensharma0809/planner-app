"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
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
import { FlowTutorialButton } from "@/app/components/onboarding/FlowTutorialButton"
import {
  PLANNER_FLOW_SLIDES,
  SCHEDULE_CALENDAR_FLOW_SLIDES,
} from "@/app/components/onboarding/flowSlides"

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

// ─── Page title resolver ──────────────────────────────────────

const ROUTE_TITLES: Array<{ pattern: RegExp; title: string; breadcrumb?: Array<{ label: string; href?: string }> }> = [
  { pattern: /^\/dashboard$/,               title: "Overview",   breadcrumb: [{ label: "Home" }] },
  { pattern: /^\/dashboard\/overview/,      title: "Overview",   breadcrumb: [{ label: "Home" }] },
  { pattern: /^\/dashboard\/calendar/,      title: "Calendar",   breadcrumb: [{ label: "Home", href: "/dashboard" }, { label: "Calendar" }] },
  { pattern: /^\/dashboard\/subjects/,      title: "Subjects",   breadcrumb: [{ label: "Home", href: "/dashboard" }, { label: "Subjects" }] },
  { pattern: /^\/dashboard\/timetable/,     title: "Timetable",  breadcrumb: [{ label: "Home", href: "/dashboard" }, { label: "Timetable" }] },
  { pattern: /^\/dashboard\/settings/,      title: "Settings",   breadcrumb: [{ label: "Home", href: "/dashboard" }, { label: "Settings" }] },
  { pattern: /^\/schedule/,                 title: "Schedule",   breadcrumb: [{ label: "Home", href: "/dashboard" }, { label: "Schedule" }] },
  { pattern: /^\/planner/,                  title: "Planner",    breadcrumb: [{ label: "Home", href: "/dashboard" }, { label: "Planner" }] },
  { pattern: /^\/onboarding/,               title: "Onboarding", breadcrumb: [{ label: "Home", href: "/dashboard" }, { label: "Onboarding" }] },
]

function resolveBreadcrumb(pathname: string): Array<{ label: string; href?: string }> {
  return ROUTE_TITLES.find(({ pattern }) => pattern.test(pathname))?.breadcrumb ?? [{ label: "Home" }]
}

// ─── Topbar ───────────────────────────────────────────────────

/**
 * Topbar — sticky horizontal bar rendered at the top of the shell body.
 *
 * Contains:
 *   - Mobile hamburger menu button
 *   - Current page title (auto-resolved from pathname)
 */
export function Topbar() {
  const { toggleMobile } = useSidebar()
  const { state: scheduleTopbar } = useScheduleTopbar()
  const pathname = usePathname()
  const breadcrumb = resolveBreadcrumb(pathname)
  const isPlannerRoute = pathname.startsWith("/planner")
  const isScheduleRoute = pathname.startsWith("/schedule")
  const showScheduleControls = isScheduleRoute && scheduleTopbar.enabled

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
      <header
        className="topbar-root"
        role="banner"
        style={{ height: "auto", minHeight: "64px", padding: "10px 16px", gap: "8px", flexDirection: "column" }}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={toggleMobile}
              className="topbar-icon-btn lg:hidden"
              aria-label="Open navigation menu"
            >
              <MenuIcon />
            </button>

            <div className="min-w-0">
              {breadcrumb.length > 0 && (
                <nav className="flex items-center gap-1.5 text-xs text-text-secondary mb-0.5" aria-label="Breadcrumb">
                  {breadcrumb.map((item, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-text-muted" aria-hidden="true">/</span>}
                      {item.href ? (
                        <Link href={item.href} className="hover:text-text-primary transition-colors">{item.label}</Link>
                      ) : (
                        <span className="text-text-primary">{item.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              )}
              <h1 className="text-base font-semibold text-text-primary truncate" title={scheduleTopbar.weekRangeTitle}>
                {scheduleTopbar.weekRangeTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            {!pathname.startsWith("/planner") && (
              <Link
                href="/planner"
                className="inline-flex items-center justify-center gap-1.5 rounded-full min-h-[44px] md:min-h-0 md:h-9 px-4 text-xs font-semibold transition-all duration-150"
                style={{ background: "#1A1612", color: "#FFFFFF" }}
              >
                + New Plan
              </Link>
            )}
            <FlowTutorialButton
              title="Schedule & Calendar Tutorial"
              flowLabel="Schedule & Calendar Flow"
              slides={SCHEDULE_CALENDAR_FLOW_SLIDES}
              buttonVariant="ghost"
              buttonSize="sm"
            />
          </div>
        </div>

        <ScheduleTopbarControls state={scheduleTopbar} />
      </header>
    )
  }

  return (
    <header className="topbar-root" role="banner">
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobile}
        className="topbar-icon-btn lg:hidden"
        aria-label="Open navigation menu"
      >
        <MenuIcon />
      </button>

      {/* Breadcrumb + planner phase nav */}
      <div className={`flex-1 min-w-0 ${isPlannerRoute ? "flex items-center gap-3" : ""}`}>
        <div className="min-w-0">
          {!isPlannerRoute && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 text-xs text-[--text-secondary]" aria-label="Breadcrumb">
              {breadcrumb.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[--text-muted]" aria-hidden="true">/</span>}
                  {item.href ? (
                    <Link href={item.href} className="hover:text-[--text-primary] transition-colors">{item.label}</Link>
                  ) : (
                    <span className="text-[--text-primary]">{item.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}

          {isPlannerRoute && (
            <h1 className="text-base font-semibold text-[--text-primary] truncate">Planner</h1>
          )}
        </div>

        {isPlannerRoute && isMounted && (
          <nav className="planner-topbar-phase-nav" aria-label="Planner phases" style={{ marginLeft: 0, flex: "none" }}>
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
                  <span className="font-bold mr-1">{phase.id}</span>
                  {phase.shortLabel}
                </button>
              )
            })}
          </nav>
        )}
      </div>

      {isPlannerRoute && isMounted && (
        <button
          onClick={handlePlannerResetRequest}
          className="planner-topbar-reset-btn"
          type="button"
        >
          Reset
        </button>
      )}

      {isPlannerRoute && (
        <FlowTutorialButton
          title="Planner Tutorial"
          flowLabel="Planner Flow"
          slides={PLANNER_FLOW_SLIDES}
          buttonVariant="ghost"
          buttonSize="sm"
        />
      )}

      {/* New Plan CTA — shown on all non-planner routes */}
      {!isPlannerRoute && (
        <Link
          href="/planner"
          className="inline-flex items-center justify-center gap-1.5 rounded-full min-h-[44px] md:min-h-0 md:h-9 px-4 text-xs font-semibold transition-all duration-150 flex-shrink-0"
          style={{ background: "#1A1612", color: "#FFFFFF" }}
        >
          + New Plan
        </Link>
      )}
    </header>
  )
}

function ScheduleTopbarControls({ state }: { state: ScheduleTopbarState }) {
  return (
    <div className="flex min-h-0 items-center gap-2 px-2 py-1.5 pr-4" aria-label="Schedule controls">
      {/* Navigation — segmented pill */}
      <div
        className="flex shrink-0 items-center gap-0.5 rounded-full p-1"
        style={{ background: "var(--surface-page)" }}
        aria-label="Week and month navigation"
      >
        <NavPill onClick={state.onPrevMonth} aria-label="Previous month">Month-</NavPill>
        <NavPill onClick={state.onPrevWeek} aria-label="Previous week">Week-</NavPill>
        <NavPill onClick={state.onCurrentWeek} aria-label="Current week" disabled={state.isCurrentWeek}>Current</NavPill>
        <NavPill onClick={state.onNextWeek} aria-label="Next week">Week+</NavPill>
        <NavPill onClick={state.onNextMonth} aria-label="Next month">Month+</NavPill>
      </div>

      {/* Subject chips */}
      <div className="flex min-w-0 items-center gap-1.5 flex-wrap" aria-label="Subject filters">
        {state.chips.map((chip) => {
          const isActive = chip.id === state.activeChipId
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => state.onChipClick(chip.id)}
              className={`shrink-0 transition min-h-[44px] md:min-h-0 ${isActive ? "chip-neutral" : "chip-neutral opacity-60 hover:opacity-100"}`}
              aria-pressed={isActive}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5" aria-label="Schedule actions">
        <select
          value={state.statusFilter}
          onChange={(event) => state.onStatusFilterChange(event.target.value as ScheduleTopbarState["statusFilter"])}
          className="min-h-[44px] cursor-pointer rounded-full border border-border-subtle bg-surface-panel px-3 text-xs font-medium text-text-secondary outline-none transition hover:border-border-strong md:h-8 md:min-h-8 md:text-[11px]"
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
          className="min-h-[44px] rounded-full border border-border-subtle bg-surface-panel px-3 text-xs font-medium text-text-secondary transition hover:bg-surface-hover disabled:opacity-50 md:h-8 md:min-h-8 md:text-[11px]"
        >
          {state.isImportingPlanner ? "Syncing" : "Import"}
        </button>

        <button
          type="button"
          onClick={state.onAddEvent}
          className="min-h-[44px] rounded-full bg-black px-4 text-xs font-semibold text-white transition hover:bg-[--action-primary-bg-hover] md:h-8 md:min-h-8 md:text-[11px]"
        >
          + Add Event
        </button>
      </div>
    </div>
  )
}

function NavPill({ children, onClick, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative z-10 min-h-[44px] rounded-full px-3 text-xs font-medium text-text-secondary transition hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-1 md:text-[11px]"
      {...rest}
    >
      {children}
    </button>
  )
}

