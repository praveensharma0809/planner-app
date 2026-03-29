import { describe, expect, it } from "vitest"
import path from "path"
import { readdir, readFile } from "fs/promises"
import { SESSION_TYPES, STUDY_FREQUENCIES, TASK_SOURCES } from "@/lib/planner/contracts"

const WORKSPACE_ROOT = process.cwd()

const RUNTIME_DIRS = [
  "app/actions",
  "app/(dashboard)",
  "app/components",
  "lib/planner",
  "lib/types",
]

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"])

function tokenRegex(parts: string[], flags = "g"): RegExp {
  return new RegExp(`\\b${parts.join("")}\\b`, flags)
}

const LEGACY_PATTERNS = [
  { label: "removed topic params table alias", regex: tokenRegex(["topic", "_", "params"]) },
  { label: "removed planner config table alias", regex: tokenRegex(["plan", "_", "config"]) },
  { label: "removed generated-task flag alias", regex: tokenRegex(["is", "_", "plan", "_", "generated"]) },
  { label: "removed planner version alias", regex: tokenRegex(["plan", "_", "version"]) },
  { label: "legacy hierarchy topic-branch tokens", regex: tokenRegex(["sub", "topics?"], "gi") },
  { label: "legacy hierarchy grouping tokens", regex: tokenRegex(["cl", "usters?"], "gi") },
  { label: "legacy execution token prefix", regex: new RegExp(`\\b${["execution", "_"].join("")}[a-z0-9_]+\\b`, "gi") },
  { label: "task_source = planner", regex: /task_source\s*:\s*["']planner["']/g },
  {
    label: "task_source filter planner",
    regex: /\.(eq|neq|in)\(\s*["']task_source["']\s*,\s*["']planner["']/g,
  },
]

async function collectSourceFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        return collectSourceFiles(absolute)
      }

      const ext = path.extname(entry.name)
      return SOURCE_EXTENSIONS.has(ext) ? [absolute] : []
    })
  )

  return nested.flat()
}

function lineNumberForOffset(text: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset; i += 1) {
    if (text[i] === "\n") line += 1
  }
  return line
}

describe("db-v2 contract guard", () => {
  it("keeps canonical enum literals synced with DB v2 constraints", () => {
    expect(Array.from(TASK_SOURCES)).toEqual(["manual", "plan"])
    expect(Array.from(SESSION_TYPES)).toEqual(["core", "revision", "practice"])
    expect(Array.from(STUDY_FREQUENCIES)).toEqual(["daily", "spaced"])
  })

  it("prevents legacy schema/runtime tokens from re-entering runtime code", async () => {
    const sourceFiles = (
      await Promise.all(
        RUNTIME_DIRS.map((relativeDir) => collectSourceFiles(path.join(WORKSPACE_ROOT, relativeDir)))
      )
    ).flat()

    const violations: string[] = []

    for (const sourceFile of sourceFiles) {
      const content = await readFile(sourceFile, "utf8")
      const relativePath = path.relative(WORKSPACE_ROOT, sourceFile).replace(/\\/g, "/")

      for (const { label, regex } of LEGACY_PATTERNS) {
        const scanner = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`)
        let match = scanner.exec(content)
        while (match) {
          const line = lineNumberForOffset(content, match.index)
          violations.push(`${relativePath}:${line} (${label})`)
          match = scanner.exec(content)
        }
      }
    }

    expect(
      violations,
      [
        "DB-v2 contract guard failed. Legacy identifiers must stay out of runtime code.",
        ...violations,
      ].join("\n")
    ).toEqual([])
  })
})
