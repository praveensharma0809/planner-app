#!/usr/bin/env node

import { execSync, spawnSync, spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoPath = path.resolve(__dirname, "..")

console.log("\n╔════════════════════════════════════════════════════════════════════════════════╗")
console.log("║           PLANNER APP - SCREENSHOT & TEST WORKFLOW                           ║")
console.log("╚════════════════════════════════════════════════════════════════════════════════╝\n")

// STEP 1
console.log("[1/6] GIT STATUS & HEAD")
console.log("────────────────────────────────────────────────────────────────────────────────")

let gitStatus = ""
let gitHead = ""

try {
  const status = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" })
  const head = execSync("git rev-parse HEAD", { cwd: repoPath, encoding: "utf-8" })
  gitStatus = status.trim()
  gitHead = head.trim()

  console.log(`Branch: design-v2`)
  console.log(`HEAD: ${gitHead.substring(0, 10)}...`)
  if (gitStatus) {
    const lines = gitStatus.split('\n').length
    console.log(`Status: ${lines} files modified`)
  } else {
    console.log(`Status: Working tree clean`)
  }
} catch (err) {
  console.error("Git error:", err.message)
}

// STEP 2
console.log("\n[2/6] STARTING DEV SERVER")
console.log("────────────────────────────────────────────────────────────────────────────────")

const devProc = spawn("npm", ["run", "dev"], {
  cwd: repoPath,
  stdio: "pipe",
  shell: true
})

// Wait for server
let ready = false
let attempts = 0

async function checkServer() {
  while (attempts < 60) {
    try {
      const res = await fetch("http://localhost:3000/", { timeout: 2000 }).catch(() => null)
      if (res) {
        ready = true
        console.log("✓ Server ready at http://localhost:3000")
        return true
      }
    } catch (e) {
      // not ready
    }
    process.stdout.write(".")
    await new Promise(r => setTimeout(r, 1000))
    attempts++
  }
  console.log("\n✗ Server startup timeout")
  return false
}

const serverOk = await checkServer()
if (!serverOk) {
  devProc.kill()
  process.exit(1)
}

// Wait a bit more
await new Promise(r => setTimeout(r, 2000))

// STEP 3
console.log("\n[3/6] CAPTURING SCREENSHOTS")
console.log("────────────────────────────────────────────────────────────────────────────────")

const { chromium } = await import("playwright")

const outDir = path.resolve(repoPath, "app_screenshots", "Post_F6")
fs.mkdirSync(outDir, { recursive: true })

const routes = [
  { name: "dashboard", path: "/dashboard" },
  { name: "dashboard/subjects", path: "/dashboard/subjects" },
  { name: "dashboard/calendar", path: "/dashboard/calendar" },
  { name: "schedule", path: "/schedule" },
  { name: "planner", path: "/planner" },
  { name: "dashboard/settings", path: "/dashboard/settings" },
]

const widths = [375, 768, 1024, 1440, 1600]
const totalShots = routes.length * widths.length

let successCount = 0
const captureFailures = []

try {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()

  console.log("Authenticating...")
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 })
  
  await page.fill('input#email', 'praveen.vts@rediffmail.com')
  await page.fill('input#password', 'impossible')
  await page.click('button[type="submit"]')
  
  await page.waitForTimeout(3000)
  console.log("✓ Authenticated\n")

  for (const route of routes) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      const url = `http://localhost:3000${route.path}`
      const filename = `${route.name}_${width}px.png`

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
        await page.waitForTimeout(1500)
        await page.screenshot({ path: path.join(outDir, filename), fullPage: false })
        successCount++
        process.stdout.write("✓")
      } catch (err) {
        captureFailures.push(filename)
        process.stdout.write("✗")
      }
    }
  }

  console.log(`\n\nResult: ${successCount}/${totalShots} screenshots captured`)
  
  if (captureFailures.length > 0) {
    console.log("\nFailed captures:")
    captureFailures.slice(0, 5).forEach(f => console.log(`  - ${f}`))
    if (captureFailures.length > 5) console.log(`  ... and ${captureFailures.length - 5} more`)
  }

  await page.close()
  await browser.close()

} catch (err) {
  console.error("Screenshot error:", err.message)
}

const savedFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.png')).length
console.log(`\nSaved: ${savedFiles} PNG files`)
console.log(`Location: app_screenshots/Post_F6/`)

// STEP 4
console.log("\n[4/6] STOPPING DEV SERVER")
console.log("────────────────────────────────────────────────────────────────────────────────")

devProc.kill()
await new Promise(r => setTimeout(r, 2000))
console.log("✓ Dev server stopped")

// STEP 5
console.log("\n[5/6] RUNNING TESTS")
console.log("────────────────────────────────────────────────────────────────────────────────")

try {
  const result = execSync("npm run test 2>&1", {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer: 100 * 1024 * 1024,
    stdio: "pipe"
  })

  const lines = result.split('\n').filter(l => l.trim())
  
  // Find the summary section
  let summaryIdx = lines.findIndex(l => /Test Files|PASS|FAIL/.test(l))
  if (summaryIdx === -1) {
    summaryIdx = Math.max(0, lines.length - 15)
  }

  const summary = lines.slice(summaryIdx).slice(0, 12)
  console.log(summary.join('\n'))
} catch (err) {
  const output = err.stdout || err.message
  const lines = output.toString().split('\n').filter(l => l.trim())
  console.log(lines.slice(-20).join('\n'))
}

// STEP 6
console.log("\n[6/6] FINAL WORKING TREE STATUS")
console.log("────────────────────────────────────────────────────────────────────────────────")

try {
  const finalStatus = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" }).trim()

  if (!finalStatus) {
    console.log("✓ Working tree is clean")
  } else {
    const lines = finalStatus.split('\n').filter(l => l)
    const screenshots = lines.filter(l => l.includes('Post_F6'))
    const others = lines.filter(l => !l.includes('Post_F6'))

    console.log(`Total modified: ${lines.length} files`)
    console.log(`  • Screenshots: ${screenshots.length} (Post_F6)`)
    
    if (others.length > 0) {
      console.log(`  • ⚠ Other changes: ${others.length}`)
      others.slice(0, 3).forEach(l => console.log(`    ${l}`))
    } else {
      console.log("  • Other changes: None (only screenshots modified)")
    }
  }
} catch (err) {
  console.error("Status error:", err.message)
}

console.log("\n╔════════════════════════════════════════════════════════════════════════════════╗")
console.log("║ WORKFLOW COMPLETE                                                            ║")
console.log("╚════════════════════════════════════════════════════════════════════════════════╝\n")
