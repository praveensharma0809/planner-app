import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Badge } from "@/app/components/ui/Badge"
import { TestProviders } from "@/tests/utils/testProviders"

function renderBadge(props: Partial<Parameters<typeof Badge>[0]> = {}) {
  return render(<Badge {...props}>Label</Badge>, { wrapper: TestProviders })
}

describe("Badge", () => {
  it("renders children text", () => {
    renderBadge()
    expect(screen.getByText("Label")).toBeInTheDocument()
  })

  it("renders with default variant class", () => {
    renderBadge()
    expect(screen.getByText("Label")).toHaveClass("ui-badge-default")
  })

  it("renders success variant class", () => {
    renderBadge({ variant: "success" })
    expect(screen.getByText("Label")).toHaveClass("ui-badge-success")
  })

  it("renders warning variant class", () => {
    renderBadge({ variant: "warning" })
    expect(screen.getByText("Label")).toHaveClass("ui-badge-warning")
  })

  it("renders danger variant class", () => {
    renderBadge({ variant: "danger" })
    expect(screen.getByText("Label")).toHaveClass("ui-badge-danger")
  })

  it("applies custom className", () => {
    renderBadge({ className: "my-custom" })
    expect(screen.getByText("Label")).toHaveClass("my-custom")
  })

  it("renders sm size class", () => {
    renderBadge({ size: "sm" })
    expect(screen.getByText("Label")).toHaveClass("ui-badge-sm")
  })

  it("renders lg size class", () => {
    renderBadge({ size: "lg" })
    expect(screen.getByText("Label")).toHaveClass("ui-badge-lg")
  })

  it("renders md size with no extra size class", () => {
    renderBadge({ size: "md" })
    const badge = screen.getByText("Label")
    expect(badge).not.toHaveClass("ui-badge-sm")
    expect(badge).not.toHaveClass("ui-badge-lg")
  })
})
