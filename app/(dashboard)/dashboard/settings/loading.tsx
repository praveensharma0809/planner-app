export default function SettingsLoading() {
  return (
    <div className="page-root flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full animate-pulse space-y-6 pb-8 pt-6 sm:pt-8">
          <div className="h-8 w-28 rounded bg-white/10" />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
            <div className="space-y-5 rounded-2xl border border-white/10 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 w-24 rounded bg-white/10" />
                  <div className="h-11 w-full rounded-lg bg-white/5" />
                </div>
              ))}
              <div className="h-11 w-40 rounded-xl bg-white/10" />
            </div>

            <div className="space-y-6">
              <div className="h-32 rounded-2xl border border-white/10 bg-white/5" />
              <div className="h-36 rounded-2xl border border-white/10 bg-white/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
