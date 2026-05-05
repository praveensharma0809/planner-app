import type { ReactNode } from "react"
import { ToastProvider } from "@/app/components/Toast"

/**
 * Wraps children with all providers needed for component tests.
 * Use with React Testing Library's `render(ui, { wrapper: TestProviders })`.
 *
 * ThemeProvider removed — the app is strictly light-mode.
 * The `data-theme="light"` attribute is set on the root <html> tag in layout.tsx.
 */
export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  )
}
