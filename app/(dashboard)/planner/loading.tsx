export default function SubjectsLoading() {
  return (
    <div className="page-root max-w-none">
      <div className="mb-6 space-y-2 animate-pulse">
        <div className="h-7 w-44 rounded bg-white/10" />
        <div className="h-4 w-72 rounded bg-white/10" />
      </div>

      <div className="rounded-2xl border border-white/10 p-3">
        <div className="flex h-[min(74vh,760px)] min-h-[560px] gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="w-[248px] min-w-[248px] rounded-xl border border-white/10 p-2"
            >
              <div className="mb-3 h-3 w-20 rounded bg-white/10" />
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((__, row) => (
                  <div key={row} className="h-12 rounded-lg bg-white/5" />
                ))}
              </div>
            </div>
          ))}

          <div className="min-w-[340px] flex-1 rounded-xl border border-white/10 p-6">
            <div className="h-3 w-60 rounded bg-white/10" />
            <div className="mt-4 h-10 w-56 rounded bg-white/10" />
            <div className="mt-8 space-y-3">
              {Array.from({ length: 7 }).map((_, row) => (
                <div key={row} className="h-16 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
