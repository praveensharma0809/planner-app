import Link from "next/link"
import { redirect } from "next/navigation"
import { getOpsOverview } from "@/app/actions/ops/getOpsOverview"

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtPct(value: number) {
  return `${value.toFixed(1)}%`
}

export default async function OperationsPage() {
  const result = await getOpsOverview()

  if (result.status === "UNAUTHORIZED") {
    redirect("/auth/login")
  }

  const totalErrors = result.eventSummaries.reduce((sum, row) => sum + row.errors, 0)
  const totalWarnings = result.eventSummaries.reduce((sum, row) => sum + row.warning, 0)

  const quickStartFinalCount =
    result.quickStartFunnel.success +
    result.quickStartFunnel.warning +
    result.quickStartFunnel.error

  const quickStartSuccessRate =
    quickStartFinalCount > 0
      ? (result.quickStartFunnel.success / quickStartFinalCount) * 100
      : null

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Operations</p>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Reliability Dashboard</h1>
          <p className="text-sm text-white/40">
            Live telemetry from <code className="text-white/60">ops_events</code> for your account.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all text-white/60"
        >
          Back to Settings
        </Link>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-white/35 uppercase tracking-wider">Events (24h)</p>
          <p className="text-2xl font-bold mt-2">{result.totalEvents24h}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-white/35 uppercase tracking-wider">Error Events</p>
          <p className="text-2xl font-bold mt-2 text-red-400/90">{totalErrors}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-white/35 uppercase tracking-wider">Warning Events</p>
          <p className="text-2xl font-bold mt-2 text-amber-300/90">{totalWarnings}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-white/35 uppercase tracking-wider">Quick Start Success (7d)</p>
          <p className="text-2xl font-bold mt-2 text-emerald-300/90">
            {quickStartSuccessRate === null ? "--" : fmtPct(quickStartSuccessRate)}
          </p>
        </div>
      </section>

      <section className="glass-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Event Reliability (Last 24h)</h2>
          <p className="text-xs text-white/35">
            Generated {fmtTime(result.generatedAt)}
          </p>
        </div>

        {result.eventSummaries.length === 0 ? (
          <p className="text-sm text-white/40">No telemetry events recorded in the last 24 hours.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-white/35 border-b border-white/[0.06]">
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 font-medium">Total</th>
                  <th className="py-2 pr-3 font-medium">Error %</th>
                  <th className="py-2 pr-3 font-medium">P95 (ms)</th>
                  <th className="py-2 pr-3 font-medium">Avg (ms)</th>
                  <th className="py-2 pr-3 font-medium">Status Mix</th>
                </tr>
              </thead>
              <tbody>
                {result.eventSummaries.map((row) => (
                  <tr key={row.eventName} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-white/85">{row.eventName}</td>
                    <td className="py-2.5 pr-3 text-white/70">{row.total}</td>
                    <td className={`py-2.5 pr-3 ${row.errorPct > 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {fmtPct(row.errorPct)}
                    </td>
                    <td className="py-2.5 pr-3 text-white/70">
                      {row.p95Ms === null ? "--" : row.p95Ms}
                    </td>
                    <td className="py-2.5 pr-3 text-white/70">
                      {row.avgMs === null ? "--" : row.avgMs}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-white/45">
                      s:{row.success} w:{row.warning} e:{row.errors} st:{row.started}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-card p-4 sm:p-5 space-y-4">
        <h2 className="text-lg font-semibold">Recent Warnings And Errors</h2>

        {result.recentIssues.length === 0 ? (
          <p className="text-sm text-white/40">No warning or error events in the last 24 hours.</p>
        ) : (
          <div className="space-y-2">
            {result.recentIssues.map((issue, idx) => (
              <div
                key={`${issue.createdAt}-${issue.eventName}-${idx}`}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-white/80">
                    <span className="font-semibold">{issue.eventName}</span>
                    <span className={`ml-2 text-xs ${issue.status === "error" ? "text-red-300" : "text-amber-300"}`}>
                      {issue.status}
                    </span>
                  </p>
                  <p className="text-xs text-white/35">{fmtTime(issue.createdAt)}</p>
                </div>
                <p className="text-xs text-white/45 mt-1">
                  reason: {issue.reason ?? "(not provided)"}
                  {issue.durationMs !== null ? ` · duration: ${issue.durationMs} ms` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
