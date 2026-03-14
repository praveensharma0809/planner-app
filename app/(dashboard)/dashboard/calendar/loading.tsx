export default function CalendarLoading() {
  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      <header className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="h-4 w-16 bg-white/10 rounded mb-2" />
            <div className="h-8 w-48 bg-white/10 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 bg-white/10 rounded-lg" />
            <div className="h-8 w-16 bg-white/10 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 w-20 bg-white/10 rounded" />
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl p-3 bg-white/5 border border-white/10 min-h-[200px] space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-8 bg-white/10 rounded" />
              <div className="h-3 w-12 bg-white/10 rounded" />
            </div>
            <div className="space-y-2">
              <div className="bg-white/5 rounded-lg h-20" />
              <div className="bg-white/5 rounded-lg h-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
