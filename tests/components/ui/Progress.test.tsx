import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Progress } from "@/app/components/ui/Progress"
import { TestProviders } from "@/tests/utils/testProviders"

describe("Progress", () => {
  it("renders progressbar with default 0%", () => {
    render(<Progress value={0} />, { wrapper: TestProviders })
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })

  it("renders correct percentage at 50%", () => {
    render(<Progress value={50} />, { wrapper: TestProviders })
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50")
  })

  it("renders 100% with correct aria attributes", () => {
    render(<Progress value={100} />, { wrapper: TestProviders })
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "100")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("has aria-valuemin=0 and aria-valuemax=100", () => {
    render(<Progress value={42} />, { wrapper: TestProviders })
    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("clamps values above 100 to 100%", () => {
    render(<Progress value={150} />, { wrapper: TestProviders })
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
  })

  it("zero state works with value 0", () => {
    render(<Progress value={0} />, { wrapper: TestProviders })
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
  })
})
