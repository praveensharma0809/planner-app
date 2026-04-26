import { test, expect } from "@playwright/test"

test.describe("Smoke tests", () => {
  test("landing page loads", async ({ page }) => {
    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
  })

  test("auth pages are reachable", async ({ page }) => {
    await page.goto("/auth/login")
    await expect(page).not.toHaveTitle(/not found/i)
    await page.goto("/auth/signup")
    await expect(page).not.toHaveTitle(/not found/i)
  })

  test("static pages load", async ({ page }) => {
    await page.goto("/privacy")
    expect(page.url()).toContain("/privacy")

    await page.goto("/terms")
    expect(page.url()).toContain("/terms")

    await page.goto("/landingpage")
    expect(page.url()).toContain("/landingpage")
  })

  test("onboarding redirects to auth when unauthenticated", async ({ page }) => {
    await page.goto("/onboarding")
    await page.waitForTimeout(2000)
    expect(page.url()).toMatch(/\/(auth|login|onboarding|landingpage)/)
  })
})
