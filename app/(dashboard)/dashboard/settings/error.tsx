"use client"

import { RouteErrorState } from "@/app/components/layout/RouteErrorState"

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorState
      title="Settings error"
      description="Could not load your settings. Please try again."
      onRetry={reset}
      digest={error.digest}
    />
  )
}
