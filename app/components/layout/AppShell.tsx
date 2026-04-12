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

const Topbar = dynamic(
  () => import("@/app/components/layout/Topbar").then((m) => m.Topbar),
  { ssr: false }
)

// â”€â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  toggleCollapse: () => {},
  toggleMobile: () => {},
  closeMobile: () => {},
})

export function useSidebar() {
  return useContext(SidebarContext)
}

// â”€â”€â”€ AppShell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * AppShell â€” the root layout wrapper for all authenticated pages.
 *
 * Structure:
 *   â”œâ”€â”€ Ambient mesh background
 *   â”œâ”€â”€ Mobile overlay (backdrop)
 *   â”œâ”€â”€ Sidebar (fixed left, collapsible)
 *   â””â”€â”€ Shell body
 *       â”œâ”€â”€ Topbar (sticky top)
 *       â””â”€â”€ <main> scrollable content area
 *
 * Usage:
 *   <AppShell>
 *     {children}
 *   </AppShell>
 */
export function AppShell({ children }: { children: ReactNode }) {
  // Persist collapsed state across route-change remounts
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Set collapsed state from localStorage after mount
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

  // Close mobile sidebar on wider viewports
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if ("matches" in e && e.matches) setMobileOpen(false);
    };
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else {
      // Fallback for older browsers
      mq.addListener(handler);
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handler);
      } else {
        mq.removeListener(handler);
      }
    };
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, toggleCollapse, toggleMobile, closeMobile }}>
      <ScheduleTopbarProvider>
        <div className="relative flex h-dvh min-h-0">
          {/* Ambient gradient background */}
          <div className="mesh-bg" aria-hidden="true" />

          {/* Mobile overlay â€” covers content behind open sidebar */}
          <div
            className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
              mobileOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={closeMobile}
            aria-hidden="true"
          />

          {/* Sidebar */}
          <Sidebar />

          {/* Right body: topbar + scrollable main */}
          <div
            className={`flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden transition-[margin-left] duration-300 ease-in-out ${
              collapsed ? "lg:ml-[var(--sidebar-collapsed-width)]" : "lg:ml-[var(--sidebar-width)]"
            }`}
          >
            <Topbar />
            <main className="shell-main flex h-full min-h-0 w-full min-w-0 flex-col items-stretch overflow-hidden">{children}</main>
          </div>
        </div>
      </ScheduleTopbarProvider>
    </SidebarContext.Provider>
  )
}
