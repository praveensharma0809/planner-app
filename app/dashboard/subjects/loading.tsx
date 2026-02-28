export default function SubjectsLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-8 w-32 bg-white/10 rounded mb-8" />

      {/* Add form skeleton */}
      <div className="bg-neutral-900 p-6 rounded-xl mb-8 space-y-4">
        <div className="h-12 w-full bg-neutral-800 rounded" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 bg-neutral-800 rounded" />
          <div className="h-12 bg-neutral-800 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 bg-neutral-800 rounded" />
          <div className="h-12 bg-neutral-800 rounded" />
        </div>
        <div className="h-12 w-32 bg-neutral-800 rounded" />
      </div>

      {/* Subject cards skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-neutral-900 p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-6 w-40 bg-neutral-800 rounded" />
              <div className="flex gap-2">
                <div className="h-5 w-10 bg-neutral-800 rounded" />
                <div className="h-5 w-14 bg-neutral-800 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-neutral-800 rounded" />
                <div className="h-3 w-16 bg-neutral-800 rounded" />
              </div>
              <div className="h-2 w-full bg-neutral-800 rounded-full" />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-36 bg-neutral-800 rounded" />
              <div className="h-4 w-28 bg-neutral-800 rounded" />
              <div className="h-4 w-20 bg-neutral-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
