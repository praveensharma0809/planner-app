export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto animate-pulse">
      {/* Header skeleton */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="h-4 w-20 bg-white/10 rounded mb-2" />
          <div className="h-8 w-32 bg-white/10 rounded" />
        </div>
        <div className="h-10 w-20 bg-white/10 rounded-lg" />
      </header>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
            <div className="h-3 w-16 bg-white/10 rounded" />
            <div className="h-7 w-10 bg-white/10 rounded" />
            <div className="h-3 w-20 bg-white/10 rounded" />
          </div>
        ))}
      </div>

      {/* Weekly strip */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="h-4 w-24 bg-white/10 rounded mb-3" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-lg p-2 bg-white/5 h-16" />
          ))}
        </div>
      </div>

      {/* Plan Health */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
        <div className="h-4 w-24 bg-white/10 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-3 w-16 bg-white/10 rounded" />
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="h-5 w-28 bg-white/10 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-3 h-14" />
          ))}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="h-5 w-36 bg-white/10 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-3 h-12" />
          ))}
        </div>
      </div>
    </div>
  )
}
