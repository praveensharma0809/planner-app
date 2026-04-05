"use client"

import { useTheme } from "./ThemeProvider"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-white/90">Dark Mode</p>
        <p className="text-xs text-white/45">Customize how the app looks</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full border border-white/20 transition-colors duration-300 ${
          isDark ? "bg-indigo-400/55" : "bg-white/15"
        }`}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <span
          className={`absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition-transform duration-300 ${
            isDark ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  )
}
