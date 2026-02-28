export default function SettingsLoading() {
  return (
    <div className="p-8 max-w-2xl mx-auto animate-pulse">
      <div className="h-8 w-28 bg-white/10 rounded mb-8" />

      <div className="space-y-5 max-w-lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-12 w-full bg-neutral-800 rounded-lg" />
          </div>
        ))}
        <div className="h-12 w-40 bg-neutral-800 rounded-lg" />
      </div>
    </div>
  )
}
