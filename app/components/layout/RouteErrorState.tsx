"use client"

type RouteErrorStateProps = {
  title: string
  description: string
  onRetry: () => void
  digest?: string
}

export function RouteErrorState({ title, description, onRetry, digest }: RouteErrorStateProps) {
  return (
    <div className="p-8 max-w-xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="text-sm text-white/60 max-w-sm">{description}</p>

      {digest ? (
        <p className="text-[11px] text-white/45">Reference: {digest}</p>
      ) : null}

      <button
        onClick={onRetry}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
