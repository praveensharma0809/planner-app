"use client"

import { usePathname } from "next/navigation"
import { type ReactNode } from "react"

/**
 * PageTransition — wraps routed children with a subtle fade + 4px slide-up
 * on every navigation. Respects `prefers-reduced-motion`.
 *
 * Uses a `key` on the inner element tied to the pathname so React remounts
 * it on each route change. A CSS animation runs on mount automatically.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className="motion-safe:animate-[page-enter_300ms_ease-out_both]"
    >
      {children}
    </div>
  )
}
