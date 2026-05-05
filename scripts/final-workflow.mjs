#!/usr/bin/env node

import { execSync, spawn, spawnSync } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoPath = path.resolve(__dirname, "..")

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function waitForServer(maxWait = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch("http://localhost:3000/", { timeout: 2000 })
      return true
    } catch (e) {
      process.stdout.write(".")
    }
    await sleep(1000)
  }
  return false
}

console.log("\n╔════════════════════════════════════════════════════════════════════════════╗")
console.log("║ PLANNER APP: SCREENSHOT & TEST EXECUTION                                 ║")
console.log("╚════════════════════════════════════════════════════════════════════════════╝\n")

// BEFORE: Initial git status
console.log("[BEFORE] Getting initial git status...")
const beforeStatus = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" }).trim()
const beforeHead = execSync("git rev-parse HEAD", { cwd: repoPath, encoding: "utf-8" }).trim()

console.log(`Current HEAD: ${beforeHead.substring(0, 10)}...`)
console.log(`Initial changes: ${beforeStatus ? beforeStatus.split('\n').length + ' files' : 'none'}`)

// STEP 1: Start Dev Server
console.log("\n[STEP 1] STARTING DEV SERVER...")
const devServer = spawn("npm", ["run", "dev"], {
  cwd: repoPath,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
  detached: false
})

const serverReady = await waitForServer(65000)
console.log("")
if (!serverReady) {
  console.error("✗ Dev server failed to start")
  devServer.kill()
  process.exit(1)
}
console.log("✓ Dev server is running")

await sleep(2000)

// STEP 2: Capture Screenshots
console.log("\n[STEP 2] CAPTURING SCREENSHOTS...")

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
let screenshotStats = { total: routes.length * widths.length, success: 0, failed: [] }

try {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()

  try {
    console.log("Authenticating...")
    await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 })
    
    await page.fill('input#email', 'praveen.vts@rediffmail.com')
    await page.fill('input#password', 'impossible')
    await page.click('button[type="submit"]')
    
    await sleep(3000)
    console.log("✓ Authentication complete\n")

    for (const route of routes) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        const filename = `${route.name}_${width}px.png`

        try {
          await page.goto(`http://localhost:3000${route.path}`, { waitUntil: "networkidle", timeout: 30000 })
          await sleep(1500)
          await page.screenshot({ path: path.join(outDir, filename), fullPage: false })
          screenshotStats.success++
          process.stdout.write("✓")
        } catch (err) {
          screenshotStats.failed.push(filename)
          process.stdout.write("✗")
        }
      }
    }

    console.log(`\n\n✓ Screenshots: ${screenshotStats.success}/${screenshotStats.total} successful`)
    if (screenshotStats.failed.length > 0) {
      console.log(`✗ Failed: ${screenshotStats.failed.length}`)
      screenshotStats.failed.slice(0, 3).forEach(f => console.log(`   - ${f}`))
    }

    await page.close()
    await browser.close()
  } catch (err) {
    console.error("Capture error:", err.message)
    await browser.close()
  }
} catch (err) {
  console.error("Playwright error:", err.message)
}

// STEP 3: Stop Dev Server
console.log("\n[STEP 3] STOPPING DEV SERVER...")
devServer.kill()
await sleep(2000)
console.log("✓ Dev server stopped")

// STEP 4: Run Tests
console.log("\n[STEP 4] RUNNING TESTS...")
console.log("-".repeat(80))

try {
  const testResult = spawnSync("npm", ["run", "test"], {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer: 100 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180000
  })

  const output = testResult.stdout || testResult.stderr || ""
  const lines = output.split('\n')

  // Find and display test summary
  let summaryFound = false
  for (let i = 0; i < lines.length; i++) {
    if (/Test Files|PASS|FAIL/.test(lines[i])) {
      const summary = lines.slice(i, Math.min(i + 12, lines.length)).filter(l => l.trim())
      console.log(summary.join('\n'))
      summaryFound = true
      break
    }
  }

  if (!summaryFound) {
    const lastLines = lines.filter(l => l.trim()).slice(-10)
    console.log(lastLines.join('\n'))
  }
} catch (err) {
  console.error("Test error:", err.message)
}

// AFTER: Final git status
console.log("\n[AFTER] FINAL GIT STATUS")
console.log("-".repeat(80))

const afterStatus = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" }).trim()
const statusLines = afterStatus.split('\n').filter(l => l.trim())
const screenshots = statusLines.filter(l => l.includes('Post_F6'))
const others = statusLines.filter(l => !l.includes('Post_F6'))

console.log(`Total modified: ${statusLines.length} files`)
console.log(`  • Screenshots (Post_F6): ${screenshots.length}`)

if (others.length > 0) {
  console.log(`  • ⚠ Other changes: ${others.length}`)
  others.slice(0, 3).forEach(l => console.log(`    ${l}`))
} else {
  console.log(`  • Only screenshot changes: YES ✓`)
}

// SUMMARY
console.log("\n╔════════════════════════════════════════════════════════════════════════════╗")
console.log("║ EXECUTION SUMMARY                                                        ║")
console.log("╠════════════════════════════════════════════════════════════════════════════╣")
console.log(`║ Screenshots:       ${screenshotStats.success}/${screenshotStats.total} captured to Post_F6/`)
console.log(`║ Capture Failures:  ${screenshotStats.failed.length}`)
console.log(`║ Working Tree Only: ${others.length === 0 ? "Screenshots only ✓" : `${others.length} other files ✗`}`)
console.log("╚════════════════════════════════════════════════════════════════════════════╝\n")
