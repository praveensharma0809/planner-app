"use client"

import { RouteErrorState } from "@/app/components/layout/RouteErrorState"

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorState
      title="Calendar error"
      description="Could not load your calendar. Please try again."
      onRetry={reset}
      digest={error.digest}
    />
  )
}
