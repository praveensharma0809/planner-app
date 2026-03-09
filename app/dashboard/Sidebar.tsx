"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { useState } from "react"

const navLinks = [
  {
    href: "/dashboard", label: "Dashboard", exact: true,
    icon: (
      <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/calendar", label: "Calendar", exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/planner", label: "Planner", exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
        <path d="M12 20V10M18 20V4M6 20v-4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/subjects", label: "Subjects", exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings", label: "Settings", exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase.auth.signOut()
      router.push("/auth/login")
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/[0.06] bg-[#0a0a18]/80 backdrop-blur-xl">
      <div className="h-full max-w-[1440px] mx-auto flex items-center gap-1 px-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 group mr-6 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-xs font-black text-white">S</span>
          </div>
          <span className="hidden sm:block text-sm font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent group-hover:to-white/80 transition-all">
            StudyHard
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {navLinks.map(({ href, label, exact, icon }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200 ${
                  active
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 to-purple-500" />
                )}
                <span className={active ? "text-indigo-400" : "text-white/25"}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-white/30 hover:text-red-400 hover:bg-red-500/[0.06] transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {signingOut ? "..." : "Sign out"}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden ml-auto p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5 text-white/60" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen
              ? <path d="M6 18L18 6M6 6l12 12" />
              : <path d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 top-14 bg-black/40 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
          <nav className="md:hidden absolute top-14 left-0 right-0 bg-[#0d0d1a]/95 backdrop-blur-xl border-b border-white/[0.06] p-3 space-y-1 z-50 animate-slide-in">
            {navLinks.map(({ href, label, exact, icon }) => {
              const active = isActive(href, exact)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    active
                      ? "bg-white/[0.08] text-white font-medium"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className={active ? "text-indigo-400" : "text-white/25"}>{icon}</span>
                  {label}
                </Link>
              )
            })}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/30 hover:text-red-400 hover:bg-red-500/[0.06] transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </nav>
        </>
      )}
    </header>
  )
}

/** @deprecated Use TopNav instead */
export const Sidebar = TopNav