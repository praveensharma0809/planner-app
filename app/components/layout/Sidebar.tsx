"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useSidebar } from "./AppShell"

// ─── SVG icon primitive ───────────────────────────────────────

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {children}
    </svg>
  )
}

// ─── Icons ────────────────────────────────────────────────────

const OverviewIcon = () => (
  <Icon>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </Icon>
)

const CalendarIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
)

const PlannerIcon = () => (
  <Icon>
    <path d="M3 3v18h18" />
    <path d="M7 16l4-5 4 2 5-7" />
  </Icon>
)

const SubjectsIcon = () => (
  <Icon>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </Icon>
)

const ExecutionIcon = () => (
  <Icon>
    <polygon points="5 3 19 12 5 21 5 3" />
  </Icon>
)

const HabitsIcon = () => (
  <Icon>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Icon>
)

const NotesIcon = () => (
  <Icon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </Icon>
)

const ResourcesIcon = () => (
  <Icon>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </Icon>
)

const SettingsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
)

const ChevronLeftIcon = () => (
  <Icon>
    <polyline points="15 18 9 12 15 6" />
  </Icon>
)

const ChevronRightIcon = () => (
  <Icon>
    <polyline points="9 18 15 12 9 6" />
  </Icon>
)

const LogOutIcon = () => (
  <Icon>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </Icon>
)

// ─── Navigation data ──────────────────────────────────────────

type NavItem = {
  href: string
  label: string
  icon: ReactNode
  exact?: boolean
  comingSoon?: boolean
}

type NavSection = {
  id: string
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "main",
    label: "Main",
    items: [
      { href: "/dashboard",          label: "Overview",  icon: <OverviewIcon />,  exact: true },
      { href: "/dashboard/calendar", label: "Calendar",  icon: <CalendarIcon /> },
      { href: "/planner",            label: "Planner",   icon: <PlannerIcon /> },
      { href: "/dashboard/subjects", label: "Subjects",  icon: <SubjectsIcon /> },
      { href: "/execution",          label: "Execution", icon: <ExecutionIcon /> },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { href: "/dashboard/habits",    label: "Habits",    icon: <HabitsIcon />,    comingSoon: true },
      { href: "/dashboard/notes",     label: "Notes",     icon: <NotesIcon />,     comingSoon: true },
      { href: "/dashboard/resources", label: "Resources", icon: <ResourcesIcon />, comingSoon: true },
    ],
  },
  {
    id: "system",
    label: "Settings",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: <SettingsIcon /> },
    ],
  },
]

// ─── NavItem element ──────────────────────────────────────────

function NavItemRow({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const baseClass =
    "group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 select-none"

  if (item.comingSoon) {
    return (
      <div
        className={`${baseClass} sidebar-nav-item cursor-not-allowed opacity-35`}
        title={collapsed ? `${item.label} — coming soon` : undefined}
      >
        {item.icon}
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && (
          <span className="ml-auto rounded-md border border-current px-1.5 py-0.5 text-[10px] font-normal tracking-wide opacity-60">
            soon
          </span>
        )}
        {/* Collapsed tooltip */}
        {collapsed && (
          <span className="sidebar-tooltip pointer-events-none">
            {item.label}
            <span className="ml-1.5 opacity-50 text-[10px]">· soon</span>
          </span>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${baseClass} sidebar-nav-item ${active ? "sidebar-nav-item-active" : ""}`}
    >
      {item.icon}
      {!collapsed && <span className="truncate">{item.label}</span>}
      {/* Active indicator dot */}
      {active && !collapsed && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      )}
      {/* Collapsed tooltip */}
      {collapsed && (
        <span className="sidebar-tooltip pointer-events-none">{item.label}</span>
      )}
    </Link>
  )
}

// ─── Sidebar user footer ──────────────────────────────────────

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    client.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      const client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await client.auth.signOut()
      router.push("/auth/login")
    } catch {
      setSigningOut(false)
    }
  }

  const initial = email ? email[0].toUpperCase() : "·"

  return (
    <div className="sidebar-footer">
      <div className="flex items-center gap-3 px-3 py-3 min-w-0">
        {/* Avatar */}
        <div className="sidebar-avatar" aria-hidden="true">
          {initial}
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="sidebar-user-email truncate text-[12.5px]" title={email ?? ""}>
                {email ?? "—"}
              </p>
              <p className="sidebar-user-plan text-[11px] mt-0.5">Free plan</p>
            </div>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
              className="sidebar-signout-btn flex-shrink-0 rounded-lg p-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <LogOutIcon />
            </button>
          </>
        )}
      </div>

      {/* Collapsed: show sign-out below avatar */}
      {collapsed && (
        <div className="flex justify-center pb-3">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            className="sidebar-signout-btn rounded-lg p-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <LogOutIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────

export function Sidebar() {
  const { collapsed, mobileOpen, toggleCollapse, closeMobile } = useSidebar()
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside
      className={[
        "sidebar-root",
        collapsed ? "sidebar-collapsed" : "",
        mobileOpen ? "sidebar-mobile-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Primary navigation"
    >
      {/* ── Header: logo + collapse toggle ── */}
      <div className="sidebar-header">
        <Link
          href="/dashboard"
          className="sidebar-logo group"
          aria-label="StudyHard home"
          onClick={closeMobile}
        >
          <div className="sidebar-logo-mark">
            <span>S</span>
          </div>
          {!collapsed && (
            <span className="sidebar-logo-text">StudyHard</span>
          )}
        </Link>

        {/* Desktop collapse toggle */}
        <button
          onClick={toggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="sidebar-collapse-btn hidden lg:flex"
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav
        className="flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto py-3"
        aria-label="App navigation"
      >
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div
            key={section.id}
            className={`px-2 ${sectionIndex > 0 ? "mt-2" : ""}`}
          >
            {/* Section label (expanded) */}
            {!collapsed && (
              <p className="sidebar-section-label px-3 pb-1.5 pt-1 text-[10.5px] font-semibold tracking-widest uppercase">
                {section.label}
              </p>
            )}

            {/* Section divider (collapsed) */}
            {collapsed && sectionIndex > 0 && (
              <div className="sidebar-section-divider mx-3 my-2 h-px" />
            )}

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavItemRow
                  key={item.href}
                  item={item}
                  active={isActive(item.href, item.exact)}
                  collapsed={collapsed}
                  onClick={closeMobile}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer: user info + sign out ── */}
      <SidebarFooter collapsed={collapsed} />
    </aside>
  )
}
