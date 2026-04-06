import { readFileSync } from "node:fs"

const hotspotLimits = [
  { path: "app/(dashboard)/planner/subjects-data-table.tsx", maxLines: 4100 },
  { path: "app/(dashboard)/planner/PlannerWizardClient.tsx", maxLines: 1100 },
  { path: "app/(dashboard)/schedule/page.tsx", maxLines: 1100 },
]

function countLines(path) {
  const source = readFileSync(path, "utf8")
  if (source.length === 0) return 0
  return source.split(/\r?\n/).length
}

const violations = []

for (const entry of hotspotLimits) {
  const lines = countLines(entry.path)

  if (lines > entry.maxLines) {
    violations.push(
      `${entry.path}: ${lines} lines (limit: ${entry.maxLines})`
    )
  }
}

if (violations.length > 0) {
  process.stderr.write("Hotspot size guard failed:\n")
  for (const violation of violations) {
    process.stderr.write(`- ${violation}\n`)
  }
  process.exit(1)
}

process.stdout.write("Hotspot size guard passed.\n")
for (const entry of hotspotLimits) {
  const lines = countLines(entry.path)
  process.stdout.write(`- ${entry.path}: ${lines}/${entry.maxLines}\n`)
}
