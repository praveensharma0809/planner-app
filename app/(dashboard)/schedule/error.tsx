"use client"

export default function ScheduleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="page-root flex h-full min-h-0 flex-col overflow-hidden">
      <section className="flex min-h-0 flex-1 items-center justify-center surface-card px-6">
        <div className="max-w-md space-y-3 text-center">
          <h2 className="text-xl font-semibold text-text-primary">
            Schedule failed to load
          </h2>
          <p className="text-sm text-text-muted">
            Please try again. If this keeps happening, refresh the page and retry your last action.
          </p>
          {error.digest ? (
            <p className="text-xs text-text-muted">
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[--action-primary-bg-hover]"
          >
            Try again
          </button>
        </div>
      </section>
    </div>
  )
}
