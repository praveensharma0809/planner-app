"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

interface OpsEventRow {
  event_name: string
  event_status: "started" | "success" | "warning" | "error"
  duration_ms: number | null
  metadata: unknown
  created_at: string
}

interface EventSummary {
  eventName: string
  total: number
  started: number
  success: number
  warning: number
  errors: number
  errorPct: number
  p95Ms: number | null
  avgMs: number | null
  latencySamples: number
}

interface RecentIssue {
  eventName: string
  status: "warning" | "error"
  createdAt: string
  durationMs: number | null
  reason: string | null
}

interface QuickStartFunnel {
  started: number
  success: number
  warning: number
  error: number
}

function isIssueStatus(status: OpsEventRow["event_status"]): status is "warning" | "error" {
  return status === "warning" || status === "error"
}

function isIssueRow(
  row: OpsEventRow
): row is OpsEventRow & { event_status: "warning" | "error" } {
  return isIssueStatus(row.event_status)
}

export type GetOpsOverviewResponse =
  | { status: "UNAUTHORIZED" }
  | {
      status: "SUCCESS"
      generatedAt: string
      window24hStart: string
      totalEvents24h: number
      eventSummaries: EventSummary[]
      quickStartFunnel: QuickStartFunnel
      recentIssues: RecentIssue[]
    }

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const weight = idx - lo
  return sorted[lo] * (1 - weight) + sorted[hi] * weight
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function extractReason(metadata: unknown): string | null {
  if (!isRecord(metadata)) return null
  if (typeof metadata.reason === "string" && metadata.reason.length > 0) {
    return metadata.reason
  }
  if (typeof metadata.message === "string" && metadata.message.length > 0) {
    return metadata.message
  }
  return null
}

export async function getOpsOverview(): Promise<GetOpsOverviewResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { status: "UNAUTHORIZED" }

  const now = new Date()
  const since24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: events24h }, { data: quickStartRows }] = await Promise.all([
    supabase
      .from("ops_events")
      .select("event_name, event_status, duration_ms, metadata, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since24)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("ops_events")
      .select("event_status")
      .eq("user_id", user.id)
      .eq("event_name", "planner.quick_start")
      .gte("created_at", since7d)
      .limit(5000),
  ])

  const rows = (events24h ?? []) as OpsEventRow[]

  const bucketMap = new Map<
    string,
    {
      total: number
      started: number
      success: number
      warning: number
      errors: number
      durations: number[]
      durationSum: number
    }
  >()

  for (const row of rows) {
    const bucket =
      bucketMap.get(row.event_name) ??
      {
        total: 0,
        started: 0,
        success: 0,
        warning: 0,
        errors: 0,
        durations: [],
        durationSum: 0,
      }

    bucket.total += 1
    if (row.event_status === "started") bucket.started += 1
    if (row.event_status === "success") bucket.success += 1
    if (row.event_status === "warning") bucket.warning += 1
    if (row.event_status === "error") bucket.errors += 1

    // Ignore "started" rows for latency quality metrics.
    if (row.duration_ms !== null && row.event_status !== "started") {
      bucket.durations.push(row.duration_ms)
      bucket.durationSum += row.duration_ms
    }

    bucketMap.set(row.event_name, bucket)
  }

  const eventSummaries: EventSummary[] = Array.from(bucketMap.entries())
    .map(([eventName, bucket]) => {
      const p95 = percentile(bucket.durations, 0.95)
      const avg =
        bucket.durations.length > 0
          ? bucket.durationSum / bucket.durations.length
          : null
      return {
        eventName,
        total: bucket.total,
        started: bucket.started,
        success: bucket.success,
        warning: bucket.warning,
        errors: bucket.errors,
        errorPct: bucket.total > 0 ? (bucket.errors / bucket.total) * 100 : 0,
        p95Ms: p95 === null ? null : Math.round(p95),
        avgMs: avg === null ? null : Math.round(avg),
        latencySamples: bucket.durations.length,
      }
    })
    .sort((a, b) => {
      if (b.errorPct !== a.errorPct) return b.errorPct - a.errorPct
      return b.total - a.total
    })

  const recentIssues: RecentIssue[] = rows
    .filter(isIssueRow)
    .slice(0, 20)
    .map((row) => ({
      eventName: row.event_name,
      status: row.event_status,
      createdAt: row.created_at,
      durationMs: row.duration_ms,
      reason: extractReason(row.metadata),
    }))

  const quickStartFunnel: QuickStartFunnel = {
    started: 0,
    success: 0,
    warning: 0,
    error: 0,
  }

  for (const row of quickStartRows ?? []) {
    if (row.event_status === "started") quickStartFunnel.started += 1
    if (row.event_status === "success") quickStartFunnel.success += 1
    if (row.event_status === "warning") quickStartFunnel.warning += 1
    if (row.event_status === "error") quickStartFunnel.error += 1
  }

  return {
    status: "SUCCESS",
    generatedAt: now.toISOString(),
    window24hStart: since24,
    totalEvents24h: rows.length,
    eventSummaries,
    quickStartFunnel,
    recentIssues,
  }
}
