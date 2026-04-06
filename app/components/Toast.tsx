"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { TOAST_DURATION_MS } from "@/lib/constants"

interface Toast {
  id: number
  message: string
  type: "success" | "error" | "info"
}

interface ToastContextValue {
  addToast: (message: string, type?: Toast["type"]) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timeoutIdsRef = useRef<Map<number, number>>(new Map())

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, message, type }])
    const timeoutId = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timeoutIdsRef.current.delete(id)
    }, TOAST_DURATION_MS)
    timeoutIdsRef.current.set(id, timeoutId)
  }, [])

  const dismiss = useCallback((id: number) => {
    const timeoutId = timeoutIdsRef.current.get(id)
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      timeoutIdsRef.current.delete(id)
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current
    return () => {
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      timeoutIds.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container */}
      <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const bg =
            toast.type === "success"
              ? "bg-emerald-600 border-emerald-500/50"
              : toast.type === "error"
              ? "bg-red-600 border-red-500/50"
              : "bg-white/10 border-white/20"
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur text-sm text-white shadow-lg animate-slide-in ${bg}`}
            >
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-white/50 hover:text-white transition-colors text-xs shrink-0"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
