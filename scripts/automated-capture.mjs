import { chromium } from "playwright"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { spawn } from "child_process"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, "..", "app_screenshots", "Post_F6")

// Ensure output directory exists
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

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch("http://localhost:3000/", { timeout: 5000 })
      if (response.ok || response.status === 307) {
        console.log("Dev server is ready!")
        return true
      }
    } catch (err) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error("Dev server failed to start within timeout")
}

async function main() {
  console.log("\n=== STEP 1: Git Status ===")
  try {
    const { stdout: status } = await execAsync("git --no-pager status --short", { cwd: path.resolve(__dirname, "..") })
    const { stdout: head } = await execAsync("git rev-parse HEAD", { cwd: path.resolve(__dirname, "..") })
    console.log("Status:", status || "(clean)")
    console.log("HEAD:", head.trim())
  } catch (err) {
    console.error("Git error:", err.message)
  }

  console.log("\n=== STEP 2: Starting Dev Server ===")
  const devProcess = spawn("npm", ["run", "dev"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: ["ignore", "pipe", "pipe"],
    detached: false
  })

  let devOutput = ""
  let devErrors = ""
  
  devProcess.stdout.on("data", (data) => {
    devOutput += data.toString()
    console.log("[DEV]", data.toString().trim())
  })
  
  devProcess.stderr.on("data", (data) => {
    devErrors += data.toString()
    console.log("[DEV-ERR]", data.toString().trim())
  })

  try {
    await waitForServer()
    console.log("Proceeding with screenshot capture...")
    
    console.log("\n=== STEP 3: Capturing Screenshots ===")
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ deviceScaleFactor: 2 })
    const page = await context.newPage()

    let captureFailures = []
    
    try {
      console.log("Logging in...")
      await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle", timeout: 30000 })
      
      await page.fill('input#email', 'praveen.vts@rediffmail.com')
      await page.fill('input#password', 'impossible')
      await page.click('button[type="submit"]')
      
      await page.waitForURL('**/dashboard*', { timeout: 30000 })
      console.log("Logged in successfully.")
      await page.waitForTimeout(2000)

      let successCount = 0
      for (const route of routes) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 })
          const url = `http://localhost:3000${route.path}`
          const filename = `${route.name}_${width}px.png`
          try {
            await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
            await page.waitForTimeout(2000)
            await page.screenshot({ path: path.join(outDir, filename), fullPage: false })
            successCount++
            console.log(`✓ ${filename}`)
          } catch (err) {
            const msg = `${filename}: ${err.message}`
            captureFailures.push(msg)
            console.error(`✗ ${msg}`)
          }
        }
      }

      console.log(`\nCapture Summary: ${successCount}/${routes.length * widths.length} successful`)
      if (captureFailures.length > 0) {
        console.log("Failures:")
        captureFailures.forEach(f => console.log(`  - ${f}`))
      }

      await page.close()
      await browser.close()
    } catch (err) {
      console.error("Capture error:", err.message)
      await browser.close()
    }

    // Count files
    const files = fs.readdirSync(outDir).filter(f => f.endsWith('.png'))
    console.log(`\nScreenshots saved: ${files.length} files in ${outDir}`)

  } finally {
    console.log("\n=== STEP 4: Stopping Dev Server ===")
    devProcess.kill()
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log("\n=== STEP 5: Running Tests ===")
  try {
    const { stdout: testOutput } = await execAsync("npm run test", {
      cwd: path.resolve(__dirname, "..")
    })
    console.log(testOutput)
  } catch (err) {
    console.log("Test output:", err.stdout || "")
    if (err.stderr) console.log("Test errors:", err.stderr)
  }

  console.log("\n=== STEP 6: Final Git Status ===")
  try {
    const { stdout: finalStatus } = await execAsync("git --no-pager status --short", { cwd: path.resolve(__dirname, "..") })
    const { stdout: filesChanged } = await execAsync("git diff --name-only --cached", { cwd: path.resolve(__dirname, "..") })
    
    if (!finalStatus) {
      console.log("✓ Working tree is clean")
    } else {
      const lines = finalStatus.split('\n').filter(l => l)
      const screenshotChanges = lines.filter(l => l.includes('app_screenshots/Post_F6'))
      const otherChanges = lines.filter(l => !l.includes('app_screenshots/Post_F6'))
      
      console.log(`Changes: ${lines.length} file(s)`)
      if (screenshotChanges.length > 0) {
        console.log(`  Screenshot changes: ${screenshotChanges.length}`)
      }
      if (otherChanges.length > 0) {
        console.log(`  ⚠ Other changes: ${otherChanges.length}`)
        otherChanges.forEach(l => console.log(`    ${l}`))
      }
    }
  } catch (err) {
    console.error("Final status check error:", err.message)
  }
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
