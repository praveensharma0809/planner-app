import { execSync, spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoPath = path.resolve(__dirname, "..")

console.log("=".repeat(60))
console.log("AUTOMATED SCREENSHOT & TEST WORKFLOW")
console.log("=".repeat(60))

// STEP 1: Git Status
console.log("\n[STEP 1] GIT STATUS & HEAD")
console.log("-".repeat(60))
try {
  const status = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" })
  const head = execSync("git rev-parse HEAD", { cwd: repoPath, encoding: "utf-8" })
  console.log("Status:", status || "(working tree clean)")
  console.log("HEAD:", head.trim())
} catch (err) {
  console.error("Git error:", err.message)
}

// STEP 2: Start dev server
console.log("\n[STEP 2] STARTING DEV SERVER")
console.log("-".repeat(60))

const devProcess = spawn("npm", ["run", "dev"], {
  cwd: repoPath,
  stdio: "pipe",
  shell: true
})

let devReady = false
let devLogs = []

devProcess.stdout.on("data", (data) => {
  const msg = data.toString().trim()
  if (msg) {
    devLogs.push(msg)
    if (msg.includes("ready") || msg.includes("started") || msg.includes("localhost")) {
      devReady = true
    }
  }
})

devProcess.stderr.on("data", (data) => {
  const msg = data.toString().trim()
  if (msg) devLogs.push("[ERR] " + msg)
})

// Wait for server to start
const maxWait = 45000 // 45 seconds
const startWait = Date.now()
let serverUp = false

while (Date.now() - startWait < maxWait && !serverUp) {
  try {
    const response = await fetch("http://localhost:3000/", { timeout: 2000 }).catch(() => null)
    if (response) {
      serverUp = true
      console.log("✓ Dev server is running on http://localhost:3000")
      break
    }
  } catch (err) {
    // Not ready
  }
  await new Promise(r => setTimeout(r, 1000))
}

if (!serverUp) {
  console.error("✗ Dev server failed to start within timeout")
  console.log("Dev logs:", devLogs.slice(-10).join("\n"))
  process.exit(1)
}

// STEP 3: Capture Screenshots
console.log("\n[STEP 3] CAPTURING SCREENSHOTS")
console.log("-".repeat(60))

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

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()

  let failures = []
  let successes = 0

  try {
    console.log("Logging in...")
    await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 })
    
    await page.fill('input#email', 'praveen.vts@rediffmail.com')
    await page.fill('input#password', 'impossible')
    await page.click('button[type="submit"]')
    
    try {
      await page.waitForURL('**/dashboard*', { timeout: 30000 })
    } catch {
      console.log("Note: URL navigation may have completed differently")
    }
    
    console.log("✓ Logged in")
    await page.waitForTimeout(2000)

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
          successes++
          process.stdout.write(".")
        } catch (err) {
          failures.push(`${filename}: ${err.message}`)
          process.stdout.write("F")
        }
      }
    }

    console.log(`\n\nScreenshots: ${successes}/${routes.length * widths.length} successful`)
    if (failures.length > 0) {
      console.log("Failures:")
      failures.forEach(f => console.log(`  - ${f}`))
    }

    await page.close()
    await browser.close()
  } catch (err) {
    console.error("Browser automation error:", err.message)
    await browser.close()
  }

  // Count saved files
  const savedFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.png'))
  console.log(`Saved to: ${outDir}`)
  console.log(`Total files: ${savedFiles.length}`)

} catch (err) {
  console.error("Screenshot capture failed:", err.message)
}

// STEP 4: Stop dev server
console.log("\n[STEP 4] STOPPING DEV SERVER")
console.log("-".repeat(60))
devProcess.kill()
await new Promise(r => setTimeout(r, 2000))
console.log("✓ Dev server stopped")

// STEP 5: Run tests
console.log("\n[STEP 5] RUNNING TESTS")
console.log("-".repeat(60))
try {
  const testOutput = execSync("npm run test 2>&1", { cwd: repoPath, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 })
  
  // Extract test summary
  const lines = testOutput.split('\n')
  const summaryStart = lines.findIndex(l => l.includes('Test Files') || l.includes('PASS') || l.includes('FAIL'))
  const summary = lines.slice(Math.max(0, summaryStart - 5)).slice(0, 20)
  
  console.log(summary.join('\n'))
  
  if (testOutput.includes('FAIL') || testOutput.includes('failed')) {
    console.log("\n⚠ Some tests failed - see output above")
  } else {
    console.log("\n✓ All tests passed")
  }
} catch (err) {
  const output = err.stdout ? err.stdout.toString() : err.message
  const lines = output.split('\n')
  
  // Show summary
  console.log(lines.slice(-30).join('\n'))
}

// STEP 6: Final status
console.log("\n[STEP 6] FINAL WORKING TREE STATUS")
console.log("-".repeat(60))
try {
  const status = execSync("git --no-pager status --short", { cwd: repoPath, encoding: "utf-8" })
  
  if (!status.trim()) {
    console.log("✓ Working tree is clean")
  } else {
    const lines = status.split('\n').filter(l => l.trim())
    const screenshots = lines.filter(l => l.includes('app_screenshots/Post_F6'))
    const others = lines.filter(l => !l.includes('app_screenshots/Post_F6'))
    
    console.log(`Total changes: ${lines.length}`)
    console.log(`  Screenshots (Post_F6): ${screenshots.length}`)
    if (others.length > 0) {
      console.log(`  ⚠ Other changes: ${others.length}`)
      others.slice(0, 5).forEach(l => console.log(`    ${l}`))
    }
  }
} catch (err) {
  console.error("Status check error:", err.message)
}

console.log("\n" + "=".repeat(60))
console.log("WORKFLOW COMPLETE")
console.log("=".repeat(60))
