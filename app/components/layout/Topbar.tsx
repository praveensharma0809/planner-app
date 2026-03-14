"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "@/app/components/ThemeProvider"
import { useSidebar } from "./AppShell"

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
  { pattern: /^\/dashboard\/calendar/,      title: "Calendar"   },
  { pattern: /^\/dashboard\/subjects/,      title: "Subjects"   },
  { pattern: /^\/dashboard\/timetable/,     title: "Timetable"  },
  { pattern: /^\/dashboard\/settings/,      title: "Settings"   },
  { pattern: /^\/dashboard\/habits/,        title: "Habits"     },
  { pattern: /^\/dashboard\/notes/,         title: "Notes"      },
  { pattern: /^\/dashboard\/resources/,     title: "Resources"  },
  { pattern: /^\/planner/,                  title: "Planner"    },
  { pattern: /^\/execution/,                title: "Execution"  },
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
  const pathname = usePathname()
  const pageTitle = resolvePageTitle(pathname)

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

      {/* Page title */}
      <h1 className="topbar-page-title flex-1 truncate">{pageTitle}</h1>

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
