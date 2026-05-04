import { test, expect } from "@playwright/test"

/**
 * E2E regression test for the Add-Task modal focus-steal bug (Cluster P).
 *
 * Before the Modal fix, typing into the title input would re-render the
 * AddTaskButton parent (`setTitle` state update), which produced a new inline
 * `onClose` arrow on every keystroke. That destabilized Modal's `handleKey`
 * dependency, re-ran the focus effect, and yanked focus to the X button —
 * meaning every keystroke after the first vanished into the void.
 *
 * This test types 10 characters one at a time and asserts that focus never
 * leaves the title input. The final value check is the strongest gate:
 * if focus jumped at any point, the typed string would be shorter than 10
 * characters (the missing keystrokes went elsewhere).
 *
 * Auth: requires E2E_TEST_EMAIL / E2E_TEST_PASSWORD to reach the dashboard.
 * Skipped automatically when those env vars are absent so CI without
 * credentials still passes the suite.
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD
const HAVE_CREDENTIALS = Boolean(TEST_EMAIL && TEST_PASSWORD)

test.describe("Add Task modal — title input focus retention", () => {
  test.skip(
    !HAVE_CREDENTIALS,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run this suite"
  )

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login")
    await page.locator('input[type="email"]').first().fill(TEST_EMAIL!)
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD!)
    await page.locator('button[type="submit"]').first().click()

    // Wait until we're off the auth pages (could land on /dashboard,
    // /onboarding, or any other authed route depending on user state).
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 15_000,
    })
  })

  test("title input gets initial focus and retains it through 10 keystrokes", async ({
    page,
  }) => {
    await page.goto("/dashboard")

    // Open the Add Task modal
    await page.getByRole("button", { name: /add task/i }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()

    const titleInput = page.getByPlaceholder("Enter task title")
    const closeButton = page.getByLabel("Close modal")

    // Initial focus must be on the title input (via initialFocusRef), NOT the
    // close button (which is excluded via data-modal-close).
    await expect(titleInput).toBeFocused({ timeout: 2_000 })
    await expect(closeButton).not.toBeFocused()

    // Type 10 characters one at a time. After every keystroke, focus must
    // still be on the title input. Pre-fix, the second keystroke onward
    // would land on the X button instead of the input.
    const characters = "helloworld"
    for (const char of characters) {
      await page.keyboard.type(char)
      await expect(titleInput).toBeFocused()
    }

    // Final state checks
    await expect(titleInput).toHaveValue(characters)
    await expect(closeButton).not.toBeFocused()
  })

  test("title input retains focus when opening Add Task from the Calendar page", async ({
    page,
  }) => {
    // Same regression on a different host route — the bug was in Modal, not
    // in any one caller, so we cover both Overview and Calendar entry points.
    await page.goto("/dashboard/calendar")

    await page.getByRole("button", { name: /add task/i }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()

    const titleInput = page.getByPlaceholder("Enter task title")
    await expect(titleInput).toBeFocused({ timeout: 2_000 })

    for (const char of "calendar10") {
      await page.keyboard.type(char)
      await expect(titleInput).toBeFocused()
    }

    await expect(titleInput).toHaveValue("calendar10")
    await expect(page.getByLabel("Close modal")).not.toBeFocused()
  })
})
