"use client"

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
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
            Something went wrong
          </h1>
          <pre
            style={{
              maxWidth: "640px",
              padding: "1rem",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.55)",
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {error.message}
          </pre>
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
      </body>
    </html>
  )
}
