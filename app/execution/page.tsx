import Link from "next/link"
import { getExecutionMonth } from "@/app/actions/execution/getExecutionMonth"
import { ExecutionBoard } from "./ExecutionBoard"

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

interface PageProps {
  searchParams?: { month?: string }
}

export default async function ExecutionPage({ searchParams }: PageProps) {
  const monthKey = typeof searchParams?.month === "string" ? searchParams.month : undefined
  const res = await getExecutionMonth(monthKey)

  if (res.status !== "SUCCESS") {
    return (
      <div className="h-screen flex items-center justify-center text-white" style={{ background: "#0d0d14" }}>
        <div className="text-center space-y-3">
          <h1 className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>Execution Board</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Sign in to access your execution data.</p>
          <Link href="/auth/login" className="inline-block text-sm text-blue-400 hover:text-blue-300">Sign in &rarr;</Link>
        </div>
      </div>
    )
  }

  const data = res.data
  const prevKey = shiftMonth(data.month_key, -1)
  const nextKey = shiftMonth(data.month_key, 1)

  return (
    <div className="h-screen flex flex-col overflow-hidden text-white" style={{ background: "#0d0d14" }}>
      {/* Formula bar */}
      <div className="shrink-0 h-7 flex items-center gap-3 px-2 text-[11px]" style={{ background: "#111120", borderBottom: "1px solid #252538" }}>
        <Link href="/dashboard" className="hover:text-white/60" style={{ color: "rgba(255,255,255,0.3)" }}>&larr; Back</Link>
        <div className="w-px h-4" style={{ background: "#252538" }} />
        <Link href={`/execution?month=${prevKey}`} className="hover:text-white/60 px-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>&#9664;</Link>
        <span className="font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>{data.month_label}</span>
        <Link href={`/execution?month=${nextKey}`} className="hover:text-white/60 px-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>&#9654;</Link>
        <div className="w-px h-4" style={{ background: "#252538" }} />
        <span style={{ color: "rgba(255,255,255,0.25)" }}>&#128293; {data.global_metrics.global_streak}</span>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>&middot;</span>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>{data.global_metrics.monthly_completion_percent}% monthly</span>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>&middot;</span>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>{data.global_metrics.today_completion_count} today</span>
        {data.is_past_month && (
          <>
            <div className="w-px h-4" style={{ background: "#252538" }} />
            <span style={{ color: "rgba(245,158,11,0.5)" }}>Past month</span>
          </>
        )}
      </div>
      {/* Sheet fills remaining viewport */}
      <div className="flex-1 min-h-0">
        <ExecutionBoard data={data} />
      </div>
    </div>
  )
}
