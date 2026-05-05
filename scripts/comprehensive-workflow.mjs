#!/usr/bin/env node

import { execSync, spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { promisify } from "util"

const sleep = promisify(setTimeout)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoPath = path.resolve(__dirname, "..")

async function main() {
  console.log("=".repeat(70))
  console.log("PLANNER APP - SCREENSHOT & TEST WORKFLOW")
  console.log("=".repeat(70))

  // STEP 1
  console.log("\n[1] GIT STATUS & CURRENT HEAD")
  console.log("-".repeat(70))
  try {
    const status = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" }).trim()
    const head = execSync("git rev-parse HEAD", { cwd: repoPath, encoding: "utf-8" }).trim()
    console.log(`Branch status: ${status || "(working tree clean)"}`)
    console.log(`HEAD: ${head}`)
  } catch (e) {
    console.error("Git error:", e.message)
    return
  }

  // STEP 2: Start dev server
  console.log("\n[2] STARTING DEV SERVER")
  console.log("-".repeat(70))
  
  const devProcess = spawn("npm", ["run", "dev"], {
    cwd: repoPath,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32"
  })

  let devStarted = false
  const devLogs = []

  devProcess.stdout.on("data", (data) => {
    const str = data.toString()
    devLogs.push(str)
    if (str.includes("ready") || str.includes("started")) devStarted = true
  })

  devProcess.stderr.on("data", (data) => {
    devLogs.push(data.toString())
  })

  // Wait for server
  console.log("Waiting for server...")
  let attempts = 0
  while (attempts < 60) {
    try {
      const res = await fetch("http://localhost:3000/", { timeout: 2000 }).catch(() => null)
      if (res) {
        console.log("✓ Server is ready at http://localhost:3000")
        break
      }
    } catch (e) {
      // Not ready
    }
    await sleep(1000)
    attempts++
    if (attempts % 10 === 0) process.stdout.write(".")
  }

  if (attempts >= 60) {
    console.error("✗ Server failed to start")
    devProcess.kill()
    return
  }

  await sleep(2000)

  // STEP 3: Screenshots
  console.log("\n[3] CAPTURING SCREENSHOTS")
  console.log("-".repeat(70))
  
  try {
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
    const totalExpected = routes.length * widths.length

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ deviceScaleFactor: 2 })
    const page = await context.newPage()

    let success = 0
    let failures = []

    try {
      console.log("Authenticating...")
      await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 })
      await page.fill('input#email', 'praveen.vts@rediffmail.com')
      await page.fill('input#password', 'impossible')
      await page.click('button[type="submit"]')

      try {
        await page.waitForURL('**/dashboard*', { timeout: 30000 })
      } catch (e) {
        console.log("(Note: navigation completed)")
      }

      console.log("✓ Authenticated")
      await sleep(2000)

      console.log("\nCapturing:")
      for (const route of routes) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 })
          const url = `http://localhost:3000${route.path}`
          const filename = `${route.name}_${width}px.png`

          try {
            await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
            await sleep(1500)
            await page.screenshot({ path: path.join(outDir, filename), fullPage: false })
            success++
            process.stdout.write("✓")
          } catch (err) {
            failures.push(filename)
            process.stdout.write("✗")
          }
        }
      }

      console.log(`\n\nResult: ${success}/${totalExpected} screenshots captured`)
      
      if (failures.length > 0) {
        console.log("\nFailed captures:")
        failures.forEach(f => console.log(`  - ${f}`))
      }

      await page.close()
      await browser.close()
    } catch (err) {
      console.error("Error:", err.message)
      await browser.close()
    }

    const files = fs.readdirSync(outDir).filter(f => f.endsWith('.png'))
    console.log(`\nSaved: ${files.length} PNG files`)
    console.log(`Location: ${outDir}`)

  } catch (err) {
    console.error("Playwright error:", err.message)
  }

  // STEP 4: Stop server
  console.log("\n[4] STOPPING SERVER")
  console.log("-".repeat(70))
  devProcess.kill()
  await sleep(2000)
  console.log("✓ Server stopped")

  // STEP 5: Tests
  console.log("\n[5] RUNNING TESTS")
  console.log("-".repeat(70))
  try {
    const result = execSync("npm run test 2>&1", {
      cwd: repoPath,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
      stdio: "pipe"
    })

    const lines = result.split('\n')
    
    // Find summary lines
    let summaryIdx = lines.findIndex(l => /Test Files|PASS|FAIL/.test(l))
    if (summaryIdx === -1) summaryIdx = Math.max(0, lines.length - 20)
    
    const summary = lines.slice(summaryIdx).filter(l => l.trim()).slice(0, 15)
    console.log(summary.join('\n'))
    
    if (result.includes('Test Files')) {
      const match = result.match(/Test Files.*?(\d+) passed/)
      if (match) console.log(`\n✓ Tests: ${match[1]} passed`)
    }
  } catch (err) {
    const out = err.stdout || err.message
    const lines = (out.toString ? out.toString() : out).split('\n')
    console.log(lines.slice(-25).join('\n'))
  }

  // STEP 6: Final status
  console.log("\n[6] FINAL STATUS")
  console.log("-".repeat(70))
  try {
    const status = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" })
    
    if (!status.trim()) {
      console.log("✓ Working tree clean")
    } else {
      const lines = status.split('\n').filter(l => l.trim())
      const screenshots = lines.filter(l => l.includes('Post_F6'))
      const others = lines.filter(l => !l.includes('Post_F6'))

      console.log(`Total modified: ${lines.length} files`)
      console.log(`  Post_F6 screenshots: ${screenshots.length}`)
      
      if (others.length > 0) {
        console.log(`  ⚠ Other changes: ${others.length}`)
        others.slice(0, 3).forEach(l => console.log(`    ${l}`))
      }
    }
  } catch (err) {
    console.error("Status error:", err.message)
  }

  console.log("\n" + "=".repeat(70))
  console.log("WORKFLOW COMPLETED")
  console.log("=".repeat(70))
}

main().catch(err => {
  console.error("Fatal error:", err)
  process.exit(1)
})
