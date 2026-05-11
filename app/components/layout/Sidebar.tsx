"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useSidebar, type SidebarMode } from "./AppShell"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

function useSupabaseBrowserClient() {
  return useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )
}

// ─── SVG icon primitive ───────────────────────────────────────

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
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

const ScheduleIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M8 14h8M8 18h5" />
  </Icon>
)

const SubjectsIcon = () => (
  <Icon>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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

const PinIcon = () => (
  <Icon>
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1z" />
  </Icon>
)

const PinOffIcon = () => (
  <Icon>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16c0 .35.18.67.47.83L12 21l2-1" />
    <path d="M15 10.76V7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H9l4.5 5.5" />
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
    label: "Main menu",
    items: [
      { href: "/dashboard",          label: "Overview",  icon: <OverviewIcon />,  exact: true },
      { href: "/dashboard/subjects", label: "Subjects",  icon: <SubjectsIcon /> },
      { href: "/dashboard/calendar", label: "Calendar",  icon: <CalendarIcon /> },
      { href: "/schedule",           label: "Schedule",  icon: <ScheduleIcon /> },
      { href: "/planner",            label: "Planner",   icon: <PlannerIcon /> },
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
  const roundedClass = collapsed && active ? "rounded-r-lg" : "rounded-full"
  const baseClass =
    `group relative flex items-center gap-3 w-full px-3 py-2.5 ${roundedClass} text-[13.5px] font-medium transition-all duration-150 select-none`

  const inactiveClass = "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
  const activeClass = "text-[--accent-selected-fg] bg-[--accent-selected-bg] border-l-[3px] border-l-[--accent-selected-bar] font-semibold"

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
      className={`${baseClass} ${active ? activeClass : inactiveClass}`}
    >
      {item.icon}
      {!collapsed && <span className="truncate">{item.label}</span>}
      {active && !collapsed && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      )}
      {collapsed && (
        <span className="sidebar-tooltip pointer-events-none">{item.label}</span>
      )}
    </Link>
  )
}

// ─── Sidebar user footer ──────────────────────────────────────

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const router = useRouter()
  const supabase = useSupabaseBrowserClient()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      if (!user) {
        if (!cancelled) setDisplayName(null)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()

      if (cancelled) return

      const fullName = (profile?.full_name ?? "").trim()
      setDisplayName(fullName || user.email || null)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push("/auth/login")
    } catch {
      setSigningOut(false)
    }
  }

  const initial = displayName ? displayName.trim()[0]?.toUpperCase() ?? "·" : "·"

  return (
    <div className="sidebar-footer hidden md:flex">
      <div className="flex items-center gap-3 px-3 py-3 min-w-0">
        <div className="sidebar-avatar shrink-0" aria-hidden="true">
          {initial}
        </div>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p
                className="sidebar-user-name truncate text-[13px] font-medium"
                title={displayName ?? ""}
              >
                {displayName ?? "—"}
              </p>
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
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────

export function Sidebar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const { mode, setMode, setIsHovering, mobileOpen, closeMobile } = useSidebar()
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const previousActiveEl = useRef<HTMLElement | null>(null)

  // ── Focus trap for mobile drawer (F5.5) ──
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !sidebarRef.current) return
    const focusable = getFocusableElements(sidebarRef.current)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }, [])

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile()
    },
    [closeMobile]
  )

  useEffect(() => {
    if (!mobileOpen) {
      if (previousActiveEl.current && typeof previousActiveEl.current.focus === "function") {
        previousActiveEl.current.focus()
        previousActiveEl.current = null
      }
      return
    }

    previousActiveEl.current = document.activeElement as HTMLElement
    document.addEventListener("keydown", handleEscape)
    document.addEventListener("keydown", trapFocus)

    requestAnimationFrame(() => {
      if (sidebarRef.current) {
        const focusable = getFocusableElements(sidebarRef.current)
        if (focusable.length > 0) focusable[0].focus()
      }
    })

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.removeEventListener("keydown", trapFocus)
    }
  }, [mobileOpen, handleEscape, trapFocus])

  // Debounce refs for hover-expand (F3.3)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    // Only active when mode is unlocked-collapsed
    if (mode !== "unlocked-collapsed") return
    // Cancel any pending leave
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    // Debounce 80ms before expanding
    enterTimerRef.current = setTimeout(() => {
      setIsHovering(true)
    }, 80)
  }, [mode, setIsHovering])

  const handleMouseLeave = useCallback(() => {
    // Only active when mode is unlocked-collapsed or unlocked-hover
    if (mode !== "unlocked-collapsed" && mode !== "unlocked-hover") return
    // Cancel any pending enter
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = null
    }
    // Debounce 200ms before collapsing
    leaveTimerRef.current = setTimeout(() => {
      setIsHovering(false)
    }, 200)
  }, [mode, setIsHovering])

  // Sidebar is visually collapsed only in unlocked-collapsed mode.
  // In unlocked-hover mode (expanded overlay) it renders full-width.
  const isCollapsed = mode === "unlocked-collapsed"

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  // Pin handler: toggles between locked-open and unlocked-collapsed
  const handlePinToggle = useCallback(() => {
    if (mode === "locked-open" || mode === "unlocked-hover") {
      setMode("unlocked-collapsed")
    } else {
      setMode("locked-open")
    }
  }, [mode, setMode])

  // Manual collapse (chevron): only visible when locked-open
  const handleManualCollapse = useCallback(() => {
    setMode("unlocked-collapsed")
  }, [setMode])

  const isPinned = mode === "locked-open"

  // F5.3: Nav sections rendered — on mobile, skip the primary nav (handled by tab bar)
  const navSectionsToRender = mobileOpen
    ? NAV_SECTIONS.filter((s) => s.id === "system")
    : NAV_SECTIONS

  return (
    <aside
      ref={sidebarRef}
      className={[
        "sidebar-root",
        isCollapsed ? "sidebar-collapsed" : "",
        mobileOpen ? "sidebar-mobile-open" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Primary navigation"
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Header: logo + controls ── */}
      <div className="sidebar-header">
        <Link
          href="/dashboard"
          className={`sidebar-logo group ${isCollapsed ? "mx-auto flex-none" : ""}`}
          aria-label="PrepVeda home"
          onClick={closeMobile}
        >
          <div className="flex-shrink-0 w-[26px] h-[26px] rounded-md overflow-hidden grid place-items-center bg-transparent">
            <Image src="/logo.jpg" alt="PrepVeda Logo" width={26} height={26} className="w-full h-full object-cover" />
          </div>
          {!isCollapsed && (
            <span className="sidebar-logo-text">PrepVeda</span>
          )}
        </Link>

        {/* F3.2: Two-button controls — pin lock + collapse chevron */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Manual collapse toggle — only visible when locked-open (expanded) */}
          {isPinned && (
            <button
              onClick={handleManualCollapse}
              aria-label="Collapse sidebar"
              className="sidebar-collapse-btn hidden md:flex"
            >
              <ChevronLeftIcon />
            </button>
          )}

          {/* Lock/unlock pin — always visible */}
          <button
            onClick={handlePinToggle}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            aria-pressed={isPinned}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            className="sidebar-collapse-btn hidden md:flex"
          >
            {isPinned ? <PinIcon /> : <PinOffIcon />}
          </button>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav
        className="flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto py-3"
        aria-label="App navigation"
      >
        {navSectionsToRender.map((section, sectionIndex) => (
          <div
            key={section.id}
            className={`px-2 ${sectionIndex > 0 ? "mt-2" : ""}`}
          >
            {!isCollapsed && (
              <p className="sidebar-section-label px-3 pb-1.5 pt-1 text-[10.5px] font-semibold tracking-widest uppercase">
                {section.label}
              </p>
            )}

            {isCollapsed && sectionIndex > 0 && (
              <div className="sidebar-section-divider mx-3 my-2 h-px" />
            )}

            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavItemRow
                  key={item.href}
                  item={item}
                  active={isActive(item.href, item.exact)}
                  collapsed={isCollapsed}
                  onClick={closeMobile}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* F5.3: Mobile Account link */}
      {mobileOpen && !isCollapsed && (
        <div className="px-2 pb-2">
          <Link
            href="/dashboard/settings"
            onClick={closeMobile}
            className="group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-full text-[13.5px] font-medium transition-all duration-150 select-none text-text-secondary hover:text-text-primary hover:bg-surface-hover"
          >
            <SettingsIcon />
            <span className="truncate">Account</span>
          </Link>
        </div>
      )}

      <SidebarFooter collapsed={isCollapsed} />
    </aside>
  )
}
