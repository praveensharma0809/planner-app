"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

function TabIcon({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      {children}
    </svg>
  )
}

function OverviewIcon({ active }: { active: boolean }) {
  return (
    <TabIcon active={active}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </TabIcon>
  )
}

function SubjectsIcon({ active }: { active: boolean }) {
  return (
    <TabIcon active={active}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </TabIcon>
  )
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <TabIcon active={active}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </TabIcon>
  )
}

function ScheduleIcon({ active }: { active: boolean }) {
  return (
    <TabIcon active={active}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h8M8 18h5" />
    </TabIcon>
  )
}

function PlannerIcon({ active }: { active: boolean }) {
  return (
    <TabIcon active={active}>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-5 4 2 5-7" />
    </TabIcon>
  )
}

type TabDefinition = {
  href: string
  label: string
  icon: (props: { active: boolean }) => ReactNode
  exact?: boolean
}

const TABS: TabDefinition[] = [
  { href: "/dashboard", label: "Overview", icon: OverviewIcon, exact: true },
  { href: "/dashboard/subjects", label: "Subjects", icon: SubjectsIcon },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/schedule", label: "Schedule", icon: ScheduleIcon },
  { href: "/planner", label: "Planner", icon: PlannerIcon },
]

export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav
      role="navigation"
      aria-label="Primary mobile"
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
      style={{
        background: "var(--canvas)",
        borderTop: "1px solid var(--border-subtle)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            aria-label={tab.label}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0"
            style={{
              minHeight: 56,
              paddingTop: 4,
              textDecoration: "none",
            }}
          >
            <tab.icon active={active} />
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                lineHeight: 1.2,
              }}
            >
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
