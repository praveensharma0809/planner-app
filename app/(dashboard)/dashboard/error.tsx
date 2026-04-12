"use client"

import { RouteErrorState } from "@/app/components/layout/RouteErrorState"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorState
      title="Something went wrong"
      description="An unexpected error occurred while loading the dashboard. Please try again."
      onRetry={reset}
      digest={error.digest}
    />
  )
}
