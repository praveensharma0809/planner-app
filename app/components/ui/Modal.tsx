"use client"

import { useCallback, useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  /** Whether clicking the backdrop closes the modal (default: true) */
  backdropClose?: boolean
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const sizeClass = {
  sm: "md:max-w-sm",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
  xl: "md:max-w-4xl",
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  backdropClose = true,
}: ModalProps) {
  const previousActiveEl = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return
    const focusable = getFocusableElements(panelRef.current)
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

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) {
      if (previousActiveEl.current && typeof previousActiveEl.current.focus === "function") {
        previousActiveEl.current.focus()
        previousActiveEl.current = null
      }
      return
    }

    previousActiveEl.current = document.activeElement as HTMLElement
    document.addEventListener("keydown", handleKey)
    document.addEventListener("keydown", trapFocus)
    document.body.style.overflow = "hidden"

    requestAnimationFrame(() => {
      if (panelRef.current) {
        const focusable = getFocusableElements(panelRef.current)
        if (focusable.length > 0) focusable[0].focus()
      }
    })

    return () => {
      document.removeEventListener("keydown", handleKey)
      document.removeEventListener("keydown", trapFocus)
      document.body.style.overflow = ""
    }
  }, [open, handleKey, trapFocus])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={backdropClose ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed z-[61] flex max-h-[85vh] flex-col overflow-hidden animate-slide-in
          inset-x-0 bottom-0 top-auto w-full rounded-t-3xl rounded-b-none
          md:inset-auto md:left-1/2 md:top-1/2 md:w-[calc(100%-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]
          ${sizeClass[size]}`}
        style={{
          background: "var(--surface-panel)",
          boxShadow: "var(--shadow-app)",
        }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[--border-hairline]">
            <h2 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[--surface-hover]"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}
