type LogLevel = "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  label: string
  message: string
  data?: unknown
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function emit(entry: LogEntry) {
  const line = formatEntry(entry)
  if (entry.level === "error") {
    console.error(line)
  } else if (entry.level === "warn") {
    console.warn(line)
  } else {
    console.info(line)
  }
}

function buildPayload(label: string, detail: unknown, message?: string): Pick<LogEntry, "message" | "data"> {
  if (detail instanceof Error) {
    const { message: msg, stack, ...rest } = detail as Error & Record<string, unknown>
    return {
      message: message ?? msg ?? "Unknown error",
      data: { stack, ...rest },
    }
  }

  if (typeof detail === "string") {
    return { message: detail, data: undefined }
  }

  return { message: message ?? String(detail), data: detail }
}

interface Logger {
  /** Log an informational message. */
  info(label: string, detail: unknown, message?: string): void
  /** Log a warning that does not require immediate action. */
  warn(label: string, detail: unknown, message?: string): void
  /** Log an error — use this in every catch block. */
  error(label: string, detail: unknown, message?: string): void
}

function createLogger(): Logger {
  return {
    info(label, detail, message) {
      emit({ timestamp: new Date().toISOString(), level: "info", label, ...buildPayload(label, detail, message) })
    },
    warn(label, detail, message) {
      emit({ timestamp: new Date().toISOString(), level: "warn", label, ...buildPayload(label, detail, message) })
    },
    error(label, detail, message) {
      emit({ timestamp: new Date().toISOString(), level: "error", label, ...buildPayload(label, detail, message) })
    },
  }
}

export const logger = createLogger()
