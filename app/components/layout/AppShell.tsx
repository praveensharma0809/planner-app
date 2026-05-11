"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import dynamic from "next/dynamic"
import { Sidebar } from "@/app/components/layout/Sidebar"
import { MobileTabBar } from "@/app/components/layout/MobileTabBar"
import { ScheduleTopbarProvider } from "@/app/components/layout/ScheduleTopbarContext"
const GlobalFounderMessage = dynamic(
  () => import("@/app/components/FounderMessageModal").then((m) => ({ default: m.GlobalFounderMessage })),
  { ssr: false }
)

const Topbar = dynamic(
  () => import("@/app/components/layout/Topbar").then((m) => m.Topbar),
  { ssr: false }
)

// ─── Sidebar mode type ─────────────────────────────────────

export type SidebarMode = "locked-open" | "unlocked-collapsed" | "unlocked-hover"

// ─── Context ──────────────────────────────────────────────────

interface SidebarContextValue {
  /** Persistent sidebar mode; persisted to localStorage as sh-sidebar-mode */
  mode: SidebarMode
  /** Setter for sidebar mode; persists locked-open / unlocked-collapsed to localStorage */
  setMode: (m: SidebarMode) => void
  /** Whether the sidebar is currently in hover-expanded state (derived: mode === "unlocked-hover") */
  isHovering: boolean
  /** Transitions mode between unlocked-collapsed ↔ unlocked-hover */
  setIsHovering: (v: boolean) => void
  /** Derived effective sidebar width in px (240 or 64) */
  effectiveWidth: number
  /** Whether the mobile sidebar overlay is open */
  mobileOpen: boolean
  toggleMobile: () => void
  closeMobile: () => void
}

export const SidebarContext = createContext<SidebarContextValue>({
  mode: "locked-open",
  setMode: () => { },
  isHovering: false,
  setIsHovering: () => { },
  effectiveWidth: 240,
  mobileOpen: false,
  toggleMobile: () => { },
  closeMobile: () => { },
})

export function useSidebar() {
  return useContext(SidebarContext)
}

// ─── AppShell ─────────────────────────────────────────────────

/**
 * AppShell — the root layout wrapper for all authenticated pages.
 *
 * Single-layer edge-to-edge canvas model (Fix Design v2, Phase F2):
 *
 *   Layer 1 (Canvas)      — bg-canvas (#F4F1EA), full-bleed viewport
 *     ├── Sidebar         — transparent, inherits canvas,
 *     │                     width driven by 3-state machine (F3)
 *     └── Main content    — Topbar + scrollable content area
 *
 * Sidebar 3-state machine (Phase F3):
 *   - locked-open:         240px, in-flow (default)
 *   - unlocked-collapsed:  64px, in-flow, hover-expand enabled
 *   - unlocked-hover:      240px absolute overlay (transient)
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SidebarMode>("locked-open")
  const [mobileOpen, setMobileOpen] = useState(false)

  // Sidebar always initialises locked-open on desktop.
  // User may toggle via pin/collapse buttons; that choice is persisted
  // to localStorage for potential future restore, but is intentionally
  // NOT read on mount — hardcoded initial state ensures every fresh page
  // load and every route sees the same locked-open sidebar. Restoring
  // from localStorage here caused per-route drift (R6.1-fix).

  // setMode: persists locked-open / unlocked-collapsed to localStorage;
  // unlocked-hover is transient and never persisted.
  const setMode = useCallback((next: SidebarMode) => {
    setModeState(next)
    if (typeof window !== "undefined") {
      if (next === "locked-open" || next === "unlocked-collapsed") {
        localStorage.setItem("sh-sidebar-mode", next)
      }
    }
  }, [])

  // Derived values
  const isHovering = useMemo(() => mode === "unlocked-hover", [mode])

  const setIsHovering = useCallback((v: boolean) => {
    if (v) {
      setModeState((prev) => (prev === "unlocked-collapsed" ? "unlocked-hover" : prev))
    } else {
      setModeState((prev) => (prev === "unlocked-hover" ? "unlocked-collapsed" : prev))
    }
  }, [])

  const effectiveWidth = useMemo(() => {
    if (mode === "locked-open") return 240
    if (mode === "unlocked-hover") return 240
    return 64
  }, [mode])

  const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(min-width: 768px)")
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if ("matches" in e && e.matches) setMobileOpen(false)
    }
    if (mq.addEventListener) {
      mq.addEventListener("change", handler)
    } else {
      mq.addListener(handler)
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handler)
      } else {
        mq.removeListener(handler)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === "b") {
        e.preventDefault()
        setMode(
          mode === "locked-open" ? "unlocked-collapsed" : "locked-open"
        )
      }

      if (e.key === "Escape" && mode === "unlocked-hover") {
        setMode("unlocked-collapsed")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mode, setMode])

  // Sidebar overlays content when in unlocked-hover mode
  const sidebarOverlaying = mode === "unlocked-hover"

  return (
    <SidebarContext.Provider
      value={{ mode, setMode, isHovering, setIsHovering, effectiveWidth, mobileOpen, toggleMobile, closeMobile }}
    >
      <ScheduleTopbarProvider>
        {/* ══════ Layer 1: Edge-to-edge cream canvas ══════ */}
        <div
          className="bg-canvas min-h-screen flex"
          style={{ ["--sidebar-current-width" as string]: `${effectiveWidth}px` }}
        >
          {/* Ambient gradient background */}
          <div className="mesh-bg" aria-hidden="true" />

          {/* Mobile overlay — covers content behind open sidebar */}
          <div
            className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
              mobileOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Sidebar — CSS-variable-driven width, animated via F3 state machine */}
          <div
            className={`hidden md:flex flex-shrink-0 ${
              sidebarOverlaying ? "absolute left-0 z-10" : ""
            }`}
            style={{
              width: `${effectiveWidth}px`,
              transition: "width 200ms ease",
            }}
            aria-expanded={effectiveWidth === 240}
          >
            <Sidebar className="app-shell--flex-child" />
          </div>

          {/* ── Main content area ── */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <Topbar />
            <main className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-6">
              {children}
            </main>
            <MobileTabBar />
          </div>

          <GlobalFounderMessage />
        </div>
      </ScheduleTopbarProvider>
    </SidebarContext.Provider>
  )
}
