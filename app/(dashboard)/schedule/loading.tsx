export default function ScheduleLoading() {
  return (
    <div className="page-root animate-pulse flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-8 w-44 rounded bg-white/10" />
        <div className="h-9 w-24 rounded-lg bg-white/10" />
      </div>

      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--sh-border)",
          background: "var(--sh-card)",
          boxShadow: "var(--sh-shadow-sm)",
        }}
      >
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--sh-border)" }}>
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-11 border-r bg-white/[0.03]" style={{ borderColor: "var(--sh-border)" }} />
          ))}
        </div>

        <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, dayIndex) => (
            <div key={dayIndex} className="min-h-0 border-r p-2" style={{ borderColor: "var(--sh-border)" }}>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((__, row) => (
                  <div key={row} className="h-14 rounded-lg bg-white/[0.05]" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 p-3 md:hidden">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, row) => (
              <div key={row} className="h-14 rounded-lg bg-white/[0.05]" />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
