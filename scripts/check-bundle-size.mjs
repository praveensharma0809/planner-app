import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"

const CWD = process.cwd()
const CHUNKS_DIR = join(CWD, ".next", "static", "chunks")
const MAX_CHUNK_BYTES = 500 * 1024
const MAX_TOTAL_BYTES = 2 * 1024 * 1024

function buildIfNeeded() {
  try {
    statSync(CHUNKS_DIR)
    return true
  } catch {
    process.stdout.write("No prior build found. Running npx next build...\n")
    try {
      execSync("npx next build", { stdio: "inherit", cwd: CWD })
      return true
    } catch {
      process.stderr.write("ERROR: next build failed.\n")
      process.exit(1)
    }
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function collectJsFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push({ name: entry.name, path: fullPath, size: statSync(fullPath).size })
    }
  }
  return results
}

function printReport(files, totalBytes) {
  const sorted = files.sort((a, b) => b.size - a.size)
  const top5 = sorted.slice(0, 5)

  process.stdout.write("Bundle Size Report\n")
  process.stdout.write("==================\n")
  process.stdout.write(`Total JS: ${formatSize(totalBytes)} (${totalBytes} bytes)\n\n`)

  process.stdout.write("Top 5 largest chunks:\n")
  top5.forEach((f, i) => {
    process.stdout.write(`  ${i + 1}. ${f.name} — ${formatSize(f.size)}\n`)
  })

  const oversized = sorted.filter((f) => f.size > MAX_CHUNK_BYTES)
  const totalOverBudget = totalBytes > MAX_TOTAL_BYTES
  const passed = oversized.length === 0 && !totalOverBudget

  process.stdout.write("\n")
  if (passed) {
    process.stdout.write("Status: PASS \u2713 (no budget exceeded)\n")
  } else {
    process.stdout.write("Status: FAIL \u2717\n")
    if (oversized.length > 0) {
      process.stdout.write(`  ${oversized.length} chunk(s) over 500 KB limit:\n`)
      for (const f of oversized) {
        process.stdout.write(`    - ${f.name}: ${formatSize(f.size)} (limit: ${formatSize(MAX_CHUNK_BYTES)})\n`)
      }
    }
    if (totalOverBudget) {
      process.stdout.write(`  Total JS exceeds 2 MB limit (${formatSize(totalBytes)})\n`)
    }
    process.exit(1)
  }
}

buildIfNeeded()

const files = collectJsFiles(CHUNKS_DIR)

if (files.length === 0) {
  process.stderr.write("ERROR: No .js files found in .next/static/chunks/\n")
  process.exit(1)
}

const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

printReport(files, totalBytes)
