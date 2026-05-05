#!/usr/bin/env node

import { execSync, spawn } from "child_process"
import { chromium } from "playwright"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")
const outDir = path.resolve(projectRoot, "app_screenshots", "Post_F6")

// Step 1: Check git status
console.log("\n=== STEP 1: GIT STATUS ===")
try {
  const status = execSync("git --no-pager status --short", { cwd: projectRoot, encoding: "utf-8" })
  console.log(status)
  const head = execSync("git --no-pager rev-parse --short HEAD", { cwd: projectRoot, encoding: "utf-8" })
  console.log("HEAD: " + head.trim())
} catch (err) {
  console.error("Git error:", err.message)
}

// Step 2: Create output directory
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
  console.log(`\n=== STEP 2: CREATED OUTPUT DIR ===`)
  console.log(`Directory: ${outDir}`)
}

// Step 3: Start dev server
console.log("\n=== STEP 3: STARTING DEV SERVER ===")
let devServer = null
const devPromise = new Promise((resolve) => {
  devServer = spawn("npm", ["run", "dev"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  })
  
  let output = ""
  devServer.stdout.on("data", (data) => {
    output += data.toString()
    if (output.includes("ready") || output.includes("started") || output.includes("http://localhost")) {
      console.log("Dev server started")
      resolve()
    }
  })
  
  // Wait max 15 seconds
  setTimeout(() => {
    console.log("Dev server startup timeout (continuing anyway)")
    resolve()
  }, 15000)
})

await devPromise
await new Promise(r => setTimeout(r, 2000))

// Step 4: Capture screenshots
console.log("\n=== STEP 4: CAPTURING SCREENSHOTS ===")

const routes = [
  { name: "Overview", path: "/dashboard" },
  { name: "Subjects", path: "/dashboard/subjects" },
  { name: "Calendar", path: "/dashboard/calendar" },
  { name: "Schedule", path: "/schedule" },
  { name: "Planner", path: "/planner" },
  { name: "Settings", path: "/dashboard/settings" },
]

const widths = [375, 768, 1024, 1440, 1600]

let capturedCount = 0
const failedCaptures = []

try {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()

  console.log("Logging in...")
  try {
    await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 })
    
    await page.fill('input#email', 'praveen.vts@rediffmail.com')
    await page.fill('input#password', 'impossible')
    await page.click('button[type="submit"]')
    
    await page.waitForURL('**/dashboard*', { timeout: 30000 })
    console.log("Logged in successfully.")
    await page.waitForTimeout(2000)
  } catch (err) {
    console.error("Login failed:", err.message)
    failedCaptures.push(`Login: ${err.message}`)
    await page.close()
    await browser.close()
    throw err
  }

  for (const route of routes) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      const url = `http://localhost:3000${route.path}`
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
        await page.waitForTimeout(2000)
        const filename = `${route.name.replace(/\s+/g, "_")}_${width}px.png`
        await page.screenshot({ path: path.join(outDir, filename), fullPage: false })
        capturedCount++
        console.log(`  ✓ ${filename}`)
      } catch (err) {
        const filename = `${route.name.replace(/\s+/g, "_")}_${width}px.png`
        failedCaptures.push(`${filename}: ${err.message}`)
        console.error(`  ✗ ${filename}: ${err.message}`)
      }
    }
  }

  await page.close()
  await browser.close()
  console.log(`Screenshot capture complete: ${capturedCount}/${routes.length * widths.length}`)
} catch (err) {
  console.error("Screenshot error:", err.message)
}

// Step 5: Stop dev server
console.log("\n=== STEP 5: STOPPING DEV SERVER ===")
if (devServer) {
  devServer.kill()
  console.log("Dev server stopped")
}
await new Promise(r => setTimeout(r, 2000))

// Step 6: Run tests
console.log("\n=== STEP 6: RUNNING TESTS ===")
let testOutput = ""
try {
  testOutput = execSync("npm run test 2>&1", { cwd: projectRoot, encoding: "utf-8", stdio: "pipe" })
  console.log(testOutput)
} catch (err) {
  testOutput = err.stdout ? err.stdout.toString() : err.message
  console.log(testOutput)
}

// Step 7: Final status and summary
console.log("\n=== FINAL REPORT ===")
console.log(`Screenshot folder: ${outDir}`)
const files = fs.readdirSync(outDir).filter(f => f.endsWith('.png'))
console.log(`File count: ${files.length}/${routes.length * widths.length}`)

if (failedCaptures.length > 0) {
  console.log("\nFailed captures:")
  failedCaptures.forEach(f => console.log(`  - ${f}`))
}

// Test summary
const testLines = testOutput.split('\n')
const testSummary = testLines.filter(line => 
  line.includes('passed') || line.includes('failed') || line.includes('error') || line.includes('test')
).slice(-5)
console.log("\nTest summary (last lines):")
testSummary.forEach(line => {
  if (line.trim()) console.log(line)
})

console.log("\n=== FINAL GIT STATUS ===")
try {
  const finalStatus = execSync("git --no-pager status --short", { cwd: projectRoot, encoding: "utf-8" })
  console.log(finalStatus || "(no changes)")
} catch (err) {
  console.error("Error:", err.message)
}
