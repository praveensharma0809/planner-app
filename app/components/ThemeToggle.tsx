"use client"

import { useTheme } from "./ThemeProvider"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="text-lg">{theme === "dark" ? "🌙" : "☀️"}</span>
      <span className="text-white/70">
        {theme === "dark" ? "Dark mode" : "Light mode"}
      </span>
      <span className="ml-auto text-xs text-white/40">
        Switch to {theme === "dark" ? "light" : "dark"}
      </span>
    </button>
  )
}
