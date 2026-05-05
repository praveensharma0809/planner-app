#!/usr/bin/env node

/**
 * Comprehensive workflow for capturing screenshots and running tests
 * Handles: git status, start dev server, playwright screenshots, stop server, run tests
 */

import { execSync, spawnSync } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import http from "http"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoPath = path.resolve(__dirname, "..")

function log(section, msg) {
  console.log(`[${section}] ${msg}`)
}

function cmd(command, cwd = repoPath, silent = false) {
  try {
    const result = execSync(command, {
      cwd,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: silent ? "pipe" : "inherit"
    })
    return { success: true, output: result }
  } catch (err) {
    return { success: false, output: err.stdout || "", error: err.stderr || err.message }
  }
}

async function serverReady(timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch("http://localhost:3000/", {
        method: "HEAD",
        timeout: 2000
      }).catch(() => null)
      if (res) return true
    } catch (e) {
      // Not ready
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

console.log("\n" + "█".repeat(80))
console.log("█ PLANNER APP: SCREENSHOT & TEST WORKFLOW")
console.log("█".repeat(80))

// === STEP 1: Git Status ===
console.log("\n[STEP 1] GIT STATUS & HEAD")
console.log("─".repeat(80))

let gitStatus = ""
let gitHead = ""
try {
  const statusCmd = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" })
  const headCmd = execSync("git rev-parse HEAD", { cwd: repoPath, encoding: "utf-8" })
  gitStatus = statusCmd.trim()
  gitHead = headCmd.trim()
  
  console.log(`Branch: design-v2`)
  console.log(`HEAD: ${gitHead.substring(0, 10)}`)
  console.log(`Status: ${gitStatus ? `${gitStatus.split('\n').length} files modified` : "Clean"}`)
} catch (err) {
  console.error("Error getting git status:", err.message)
  process.exit(1)
}

// === STEP 2: Start Dev Server ===
console.log("\n[STEP 2] STARTING DEV SERVER")
console.log("─".repeat(80))

const { spawn } = await import("child_process")
const dev = spawn("npm", ["run", "dev"], {
  cwd: repoPath,
  stdio: "pipe",
  shell: process.platform === "win32"
})

let devOutput = []
dev.stdout.on("data", d => devOutput.push(d.toString()))
dev.stderr.on("data", d => devOutput.push(d.toString()))

console.log("Starting server...")
let serverUp = await serverReady(60000)

if (!serverUp) {
  console.error("✗ Server failed to start within 60 seconds")
  dev.kill()
  console.log("Dev output:", devOutput.slice(-20).join(""))
  process.exit(1)
}

console.log("✓ Server is running at http://localhost:3000")
await new Promise(r => setTimeout(r, 2000))

// === STEP 3: Capture Screenshots ===
console.log("\n[STEP 3] CAPTURING SCREENSHOTS")
console.log("─".repeat(80))

const outDir = path.resolve(repoPath, "app_screenshots", "Post_F6")
fs.mkdirSync(outDir, { recursive: true })

let screenshotStats = {
  total: 0,
  success: 0,
  failures: []
}

try {
  const { chromium } = await import("playwright")

  const routes = [
    { name: "dashboard", path: "/dashboard" },
    { name: "dashboard/subjects", path: "/dashboard/subjects" },
    { name: "dashboard/calendar", path: "/dashboard/calendar" },
    { name: "schedule", path: "/schedule" },
    { name: "planner", path: "/planner" },
    { name: "dashboard/settings", path: "/dashboard/settings" },
  ]

  const widths = [375, 768, 1024, 1440, 1600]
  screenshotStats.total = routes.length * widths.length

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()

  try {
    // Login
    console.log("Authenticating...")
    await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 })
    await page.fill('input#email', 'praveen.vts@rediffmail.com')
    await page.fill('input#password', 'impossible')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(3000) // Wait for auth
    console.log("✓ Authentication successful")

    // Capture screenshots
    console.log(`\nCapturing ${screenshotStats.total} screenshots...`)
    for (const route of routes) {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        const url = `http://localhost:3000${route.path}`
        const filename = `${route.name}_${width}px.png`

        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
          await page.waitForTimeout(1500)
          const filepath = path.join(outDir, filename)
          await page.screenshot({ path: filepath, fullPage: false })
          screenshotStats.success++
          process.stdout.write(".")
        } catch (err) {
          screenshotStats.failures.push(`${filename}: ${err.message}`)
          process.stdout.write("F")
        }
      }
    }

    console.log(`\n\nScreenshots captured: ${screenshotStats.success}/${screenshotStats.total}`)
    if (screenshotStats.failures.length > 0) {
      console.log("Failures:")
      screenshotStats.failures.slice(0, 5).forEach(f => console.log(`  ✗ ${f}`))
      if (screenshotStats.failures.length > 5) console.log(`  ... and ${screenshotStats.failures.length - 5} more`)
    }

    await page.close()
    await browser.close()
  } catch (err) {
    console.error("Automation error:", err.message)
    await browser.close()
  }

  const savedFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.png'))
  console.log(`\nSaved: ${savedFiles.length} PNG files to Post_F6/`)
} catch (err) {
  console.error("Screenshot error:", err.message)
}

// === STEP 4: Stop Dev Server ===
console.log("\n[STEP 4] STOPPING DEV SERVER")
console.log("─".repeat(80))

dev.kill()
await new Promise(r => setTimeout(r, 2000))
console.log("✓ Dev server stopped")

// === STEP 5: Run Tests ===
console.log("\n[STEP 5] RUNNING TESTS")
console.log("─".repeat(80))

let testResult = cmd("npm run test 2>&1", repoPath, false)
const testOutput = testResult.output

// Extract key info
let testSummary = ""
if (testOutput.includes("Test Files")) {
  const lines = testOutput.split('\n')
  const summaryIdx = lines.findIndex(l => l.includes("Test Files"))
  if (summaryIdx >= 0) {
    testSummary = lines.slice(summaryIdx, summaryIdx + 5).join('\n')
  }
} else {
  const lines = testOutput.split('\n')
  testSummary = lines.slice(-10).filter(l => l.trim()).join('\n')
}

if (testSummary) console.log(testSummary)

// === STEP 6: Final Status ===
console.log("\n[STEP 6] FINAL WORKING TREE STATUS")
console.log("─".repeat(80))

let finalStatus = ""
let onlyScreenshots = true

try {
  const statusCmd = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" })
  finalStatus = statusCmd.trim()

  if (!finalStatus) {
    console.log("✓ Working tree is clean")
  } else {
    const lines = finalStatus.split('\n').filter(l => l.trim())
    const screenshots = lines.filter(l => l.includes('Post_F6'))
    const others = lines.filter(l => !l.includes('Post_F6'))

    console.log(`Modified files: ${lines.length}`)
    console.log(`  • Screenshots (Post_F6): ${screenshots.length} files`)
    
    if (others.length > 0) {
      onlyScreenshots = false
      console.log(`  • ⚠ Other changes: ${others.length} files`)
      others.slice(0, 3).forEach(l => console.log(`      ${l}`))
      if (others.length > 3) console.log(`      ... and ${others.length - 3} more`)
    }
  }
} catch (err) {
  console.error("Error:", err.message)
}

// === FINAL SUMMARY ===
console.log("\n" + "█".repeat(80))
console.log("█ SUMMARY")
console.log("█".repeat(80))

console.log(`\nScreenshots:`)
console.log(`  Location: app_screenshots/Post_F6/`)
console.log(`  Count: ${screenshotStats.success}/${screenshotStats.total} successful`)
console.log(`  Failures: ${screenshotStats.failures.length}`)

console.log(`\nWorking Tree:`)
console.log(`  Only screenshot changes: ${onlyScreenshots ? "✓ Yes" : "✗ No (other changes present)"}`)

console.log(`\n` + "█".repeat(80))
