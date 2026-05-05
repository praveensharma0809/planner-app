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

  it("renders with default neutral variant class", () => {
    renderBadge()
    expect(screen.getByText("Label")).toHaveClass("chip-neutral")
  })

  it("renders success variant class (legacy → chip-mint)", () => {
    renderBadge({ variant: "success" })
    expect(screen.getByText("Label")).toHaveClass("chip-mint")
  })

  it("renders warning variant class (legacy → chip-peach)", () => {
    renderBadge({ variant: "warning" })
    expect(screen.getByText("Label")).toHaveClass("chip-peach")
  })

  it("renders danger variant class (legacy → chip-rose)", () => {
    renderBadge({ variant: "danger" })
    expect(screen.getByText("Label")).toHaveClass("chip-rose")
  })

  it("renders mint variant class", () => {
    renderBadge({ variant: "mint" })
    expect(screen.getByText("Label")).toHaveClass("chip-mint")
  })

  it("renders lilac variant class", () => {
    renderBadge({ variant: "lilac" })
    expect(screen.getByText("Label")).toHaveClass("chip-lilac")
  })

  it("applies custom className", () => {
    renderBadge({ className: "my-custom" })
    expect(screen.getByText("Label")).toHaveClass("my-custom")
  })

  it("renders sm size with smaller text and padding", () => {
    renderBadge({ size: "sm" })
    const badge = screen.getByText("Label")
    expect(badge).toHaveClass("text-[11px]")
    expect(badge).toHaveClass("px-2")
  })

  it("renders lg size with larger text", () => {
    renderBadge({ size: "lg" })
    const badge = screen.getByText("Label")
    expect(badge).toHaveClass("text-[13px]")
  })

  it("renders md size with default chip classes only", () => {
    renderBadge({ size: "md" })
    const badge = screen.getByText("Label")
    expect(badge).toHaveClass("chip-neutral")
  })

  it("renders dot when dot prop is true", () => {
    renderBadge({ dot: true })
    const badge = screen.getByText("Label")
    const dot = badge.querySelector('span[aria-hidden="true"]')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveClass("rounded-full")
  })
})
