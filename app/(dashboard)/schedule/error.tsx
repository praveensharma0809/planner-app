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
      <section
        className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border px-6"
        style={{
          borderColor: "var(--sh-border)",
          background: "var(--sh-card)",
          boxShadow: "var(--sh-shadow-sm)",
        }}
      >
        <div className="max-w-md space-y-3 text-center">
          <h2 className="text-xl font-semibold" style={{ color: "var(--sh-text-primary)" }}>
            Schedule failed to load
          </h2>
          <p className="text-sm" style={{ color: "var(--sh-text-muted)" }}>
            Please try again. If this keeps happening, refresh the page and retry your last action.
          </p>
          {error.digest ? (
            <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              background: "var(--sh-primary)",
              color: "white",
            }}
          >
            Try again
          </button>
        </div>
      </section>
    </div>
  )
}
