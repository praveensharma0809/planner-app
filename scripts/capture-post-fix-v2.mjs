import { chromium } from "playwright"
import path from "path"
import { fileURLToPath } from "url"
import { mkdirSync } from "fs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, "..", "app_screenshots", "Post_Fix_V2")
mkdirSync(outDir, { recursive: true })

const routes = [
  { name: "Overview", path: "/dashboard" },
  { name: "Subjects", path: "/dashboard/subjects" },
  { name: "Calendar", path: "/dashboard/calendar" },
  { name: "Schedule", path: "/schedule" },
  { name: "Planner", path: "/planner" },
  { name: "Settings", path: "/dashboard/settings" },
]

const widths = [375, 768, 1024, 1440, 1600]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()

  console.log("Logging in...")
  await page.goto("http://localhost:3000/auth/login", { waitUntil: "networkidle" })
  await page.fill('input#email', 'praveen.vts@rediffmail.com')
  await page.fill('input#password', 'impossible')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard*', { timeout: 30000 })
  console.log("Logged in successfully.")
  await page.waitForTimeout(2000)

  for (const route of routes) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      const url = `http://localhost:3000${route.path}`
      console.log(`Capturing ${route.name} at ${width}px...`)
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
        await page.waitForTimeout(1500)
        const filename = `${route.name}_${width}px.png`
        await page.screenshot({ path: path.join(outDir, filename), fullPage: false })
        console.log(`  \u2713 ${filename}`)
      } catch (err) {
        console.error(`  \u2717 FAILED ${route.name} at ${width}px: ${err.message}`)
      }
    }
  }

  await page.close()
  await browser.close()
  console.log(`\nDone. ${routes.length * widths.length} screenshots saved to app_screenshots/Post_Fix_V2/`)
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
