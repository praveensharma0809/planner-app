"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import dynamic from "next/dynamic"
import { Sidebar } from "@/app/components/layout/Sidebar"
import { ScheduleTopbarProvider } from "@/app/components/layout/ScheduleTopbarContext"
const GlobalFounderMessage = dynamic(
  () => import("@/app/components/FounderMessageModal").then((m) => ({ default: m.GlobalFounderMessage })),
  { ssr: false }
)

const Topbar = dynamic(
  () => import("@/app/components/layout/Topbar").then((m) => m.Topbar),
  { ssr: false }
)

// ─── Context ──────────────────────────────────────────────────

interface SidebarContextValue {
  /** Whether the sidebar is in icon-only (collapsed) mode on desktop */
  collapsed: boolean
  /** Whether the mobile sidebar overlay is open */
  mobileOpen: boolean
  toggleCollapse: () => void
  toggleMobile: () => void
  closeMobile: () => void
}

export const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  mobileOpen: false,
  toggleCollapse: () => { },
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
 *     ├── Sidebar         — transparent, inherits canvas
 *     └── Main content    — Topbar + scrollable content area
 *
 * Responsive:
 *   - Mobile (<768px):     sidebar off-canvas drawer
 *   - Tablet portrait:     sidebar 64px icon rail
 *   - Tablet landscape+:   sidebar 240px full sidebar
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem("sh-sidebar-collapsed") === "true")
    }
  }, [])

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      if (typeof window !== "undefined") {
        localStorage.setItem("sh-sidebar-collapsed", String(next))
      }
      return next
    })
  }, [])

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

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, toggleCollapse, toggleMobile, closeMobile }}>
      <ScheduleTopbarProvider>
        {/* ══════ Layer 1: Edge-to-edge cream canvas ══════ */}
        <div className="bg-canvas min-h-screen flex">
          {/* Ambient gradient background */}
          <div className="mesh-bg" aria-hidden="true" />

          {/* Mobile overlay — covers content behind open sidebar */}
          <div
            className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300 ${mobileOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
              }`}
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Sidebar — width per §3.1 matrix:
              Mobile (<md): off-canvas drawer (hidden from flex layout)
              Tablet portrait (md): 64px icon rail
              Tablet landscape+ (lg): 240px full sidebar */}
          <div className="hidden md:flex md:w-16 lg:w-60 flex-shrink-0">
            <Sidebar className="app-shell--flex-child" />
          </div>

          {/* ── Main content area ── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>

          <GlobalFounderMessage />
        </div>
      </ScheduleTopbarProvider>
    </SidebarContext.Provider>
  )
}
