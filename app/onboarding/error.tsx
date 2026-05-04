"use client"

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: "2rem",
        background: "#050510",
        color: "#e8e8f0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        Setup unavailable
      </h1>
      <p
        style={{
          maxWidth: "480px",
          marginBottom: "0.25rem",
          fontSize: "0.9375rem",
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.6,
        }}
      >
        Something went wrong during setup. Your progress has been saved — please
        try again.
      </p>
      {error.digest && (
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.25)",
            fontFamily: "monospace",
          }}
        >
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        style={{
          marginTop: "1.25rem",
          padding: "10px 28px",
          borderRadius: "12px",
          border: "none",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(99,102,241,0.25)",
        }}
      >
        Try again
      </button>
    </div>
  )
}
