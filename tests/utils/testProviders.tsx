import type { ReactNode } from "react"
import { ThemeProvider } from "@/app/components/ThemeProvider"
import { ToastProvider } from "@/app/components/Toast"

/**
 * Wraps children with all providers needed for component tests.
 * Use with React Testing Library's `render(ui, { wrapper: TestProviders })`.
 */
export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  )
}
