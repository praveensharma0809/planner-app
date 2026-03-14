"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

interface DropdownItem {
  id: string
  label: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  separator?: never
}
interface DropdownSeparator {
  separator: true
  id: string
}
type DropdownOption = DropdownItem | DropdownSeparator

interface DropdownProps {
  trigger: ReactNode
  items: DropdownOption[]
  align?: "left" | "right"
  className?: string
}

export function Dropdown({ trigger, items, align = "right", className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    document.addEventListener("mousedown", onOutside)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onOutside)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <div onClick={() => setOpen((p) => !p)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className={`absolute z-50 mt-2 min-w-[160px] rounded-xl border py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{
            background: "var(--sh-card)",
            border: "1px solid var(--sh-border)",
            boxShadow: "var(--sh-shadow)",
          }}
          role="menu"
        >
          {items.map((item) => {
            if ("separator" in item && item.separator) {
              return <div key={item.id} className="my-1 h-px" style={{ background: "var(--sh-border)" }} />
            }
            const it = item as DropdownItem
            return (
              <button
                key={it.id}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  it.onClick?.()
                  close()
                }}
                className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  it.danger
                    ? "text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]"
                    : "hover:bg-[rgba(255,255,255,0.05)]"
                }`}
                style={{ color: it.danger ? undefined : "var(--sh-text-secondary)" }}
              >
                {it.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
