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
      title="Subjects error"
      description="Could not load your subjects. Please try again."
      onRetry={reset}
      digest={error.digest}
    />
  )
}
