type OpsEventStatus = "started" | "success" | "error" | "warning"

type Primitive = string | number | boolean | null

type JsonLike = Primitive | JsonLike[] | { [key: string]: JsonLike }

interface TelemetryInsertResult {
  error?: { message?: string } | null
}

interface TelemetrySupabaseLike {
  from?: (tableName: string) => {
    insert?: (row: unknown) => unknown
  }
}

interface TrackServerEventInput {
  eventName: string
  status: OpsEventStatus
  userId?: string | null
  durationMs?: number
  metadata?: Record<string, unknown>
  supabase?: TelemetrySupabaseLike
}

const MAX_METADATA_CHARS = 3500

function toJsonLike(value: unknown): JsonLike {
  if (value === null) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => toJsonLike(item))
  }

  if (typeof value === "object") {
    const output: { [key: string]: JsonLike } = {}
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 50)
    for (const [key, item] of entries) {
      output[key] = toJsonLike(item)
    }
    return output
  }

  return String(value)
}

function sanitizeMetadata(metadata?: Record<string, unknown>): JsonLike | null {
  if (!metadata) return null

  const normalized = toJsonLike(metadata)
  const serialized = JSON.stringify(normalized)

  if (serialized.length <= MAX_METADATA_CHARS) {
    return normalized
  }

  return {
    truncated: true,
    preview: serialized.slice(0, MAX_METADATA_CHARS),
  }
}

function dbTelemetryEnabled() {
  return process.env.ENABLE_DB_TELEMETRY === "true"
}

export function durationSince(startedAtMs: number): number {
  return Math.max(0, Date.now() - startedAtMs)
}

export async function trackServerEvent(input: TrackServerEventInput): Promise<void> {
  const eventRow = {
    event_name: input.eventName,
    event_status: input.status,
    user_id: input.userId ?? null,
    duration_ms: input.durationMs ?? null,
    metadata: sanitizeMetadata(input.metadata),
  }

  try {
    console.info("[ops-event]", JSON.stringify(eventRow))
  } catch {
    console.info("[ops-event]", input.eventName, input.status)
  }

  if (!dbTelemetryEnabled() || !input.supabase) {
    return
  }

  try {
    const from = input.supabase.from
    if (typeof from !== "function") {
      return
    }

    const table = from("ops_events")
    if (!table || typeof table.insert !== "function") {
      return
    }

    const response = await Promise.resolve(table.insert(eventRow))
    const error =
      response && typeof response === "object" && "error" in response
        ? (response as TelemetryInsertResult).error
        : null

    if (error) {
      console.error("[ops-event] db insert failed:", error.message ?? "Unknown error")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown telemetry error"
    console.error("[ops-event] db insert exception:", message)
  }
}

export type { OpsEventStatus, TrackServerEventInput }
