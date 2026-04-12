"use client"

import { RouteErrorState } from "@/app/components/layout/RouteErrorState"

export default function SubjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorState
      title="Planner error"
      description="Could not load the planner wizard. Please try again."
      onRetry={reset}
      digest={error.digest}
    />
  )
}
