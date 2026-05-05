export default function ScheduleLoading() {
  return (
    <div className="page-root animate-pulse flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-8 w-44 rounded bg-surface-hover" />
        <div className="h-9 w-24 rounded-lg bg-surface-hover" />
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden surface-card">
        <div className="grid grid-cols-7 border-b border-border-hairline">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-11 border-r border-border-hairline bg-surface-page" />
          ))}
        </div>

        <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, dayIndex) => (
            <div key={dayIndex} className="min-h-0 border-r border-border-hairline p-2">
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((__, row) => (
                  <div key={row} className="h-14 rounded-[6px] bg-surface-hover" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 p-3 md:hidden">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, row) => (
              <div key={row} className="h-14 rounded-[6px] bg-surface-hover" />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
