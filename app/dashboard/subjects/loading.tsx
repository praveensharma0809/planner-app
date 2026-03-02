export default function SubjectsLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-white/10 rounded" />
          <div className="h-4 w-56 bg-white/10 rounded" />
        </div>
        <div className="h-10 w-28 bg-white/10 rounded" />
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-900/50">
        <div className="h-12 bg-white/5 border-b border-white/10" />
        <div className="divide-y divide-white/5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 bg-transparent" />
          ))}
        </div>
      </div>
    </div>
  )
}
