import { afterEach, vi } from "vitest"

process.env.TZ = "UTC"

// next/cache functions (revalidatePath, revalidateTag) require a Next.js
// request context that doesn't exist in the test environment. Mock them so
// server actions can be unit-tested without throwing invariant errors.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
