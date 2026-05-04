"use client"

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: "sm" | "md" | "lg" | "xl"
  /** Whether clicking the backdrop closes the modal (default: true) */
  backdropClose?: boolean
  /**
   * Ref to the element that should receive focus when the modal first opens.
   * If omitted, the first focusable non-close element receives focus.
   */
  initialFocusRef?: RefObject<HTMLElement | null>
}

// Close-button elements are tagged with this attribute so the selector below
// intentionally skips them when looking for the "first focusable" element.
const DATA_MODAL_CLOSE = "data-modal-close"

const FOCUSABLE_SELECTOR =
  `a[href], button:not([disabled]):not([${DATA_MODAL_CLOSE}]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`

const sizeClass = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
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
  initialFocusRef,
}: ModalProps) {
  const previousActiveEl = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Layer 2: stable close ref ──────────────────────────────────────────────
  // Keep a ref to the latest onClose so handleKey never needs to list it as a
  // dep. Without this, every inline arrow passed by the parent (e.g. the
  // AddTaskButton's `() => { if (saving) return; setOpen(false) }`) would
  // produce a new function reference on every render, making handleKey
  // unstable, which in turn re-runs the main useEffect and steals focus.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // ── Layer 1: one-shot initial focus guard ──────────────────────────────────
  // Reset to false whenever the modal transitions from closed → open, so the
  // focus block inside the main effect fires exactly once per open.
  const hasInitiallyFocusedRef = useRef(false)
  const prevOpenRef = useRef(open)
  if (prevOpenRef.current !== open) {
    prevOpenRef.current = open
    if (open) hasInitiallyFocusedRef.current = false
  }

  // Stable keyboard handler — empty dep array is safe because it reads
  // onCloseRef.current at call time instead of closing over onClose directly.
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onCloseRef.current()
  }, [])

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

    // One-shot initial focus: fires exactly once per open transition because
    // hasInitiallyFocusedRef guards re-entry on subsequent renders.
    if (!hasInitiallyFocusedRef.current) {
      hasInitiallyFocusedRef.current = true
      requestAnimationFrame(() => {
        // Prefer the caller-supplied ref; fall back to first focusable element.
        if (initialFocusRef?.current) {
          initialFocusRef.current.focus()
        } else if (panelRef.current) {
          const focusable = getFocusableElements(panelRef.current)
          if (focusable.length > 0) focusable[0].focus()
        }
      })
    }

    return () => {
      document.removeEventListener("keydown", handleKey)
      document.removeEventListener("keydown", trapFocus)
      document.body.style.overflow = ""
    }
  }, [open, handleKey, trapFocus, initialFocusRef])

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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={backdropClose ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed left-1/2 top-1/2 z-[61] flex max-h-[90vh] w-[calc(100%-2rem)] ${sizeClass[size]} -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border animate-slide-in`}
        style={{
          background: "var(--sh-card)",
          border: "1px solid var(--sh-border)",
          boxShadow: "var(--sh-shadow-lg)",
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--sh-border)" }}
          >
            <h2
              className="text-base font-bold"
              style={{ color: "var(--sh-text-primary)" }}
            >
              {title}
            </h2>
            {/* Layer 3a: tagged so FOCUSABLE_SELECTOR skips it as "first focusable" */}
            <button
              onClick={onClose}
              aria-label="Close modal"
              data-modal-close="true"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
              style={{ color: "var(--sh-text-muted)" }}
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
