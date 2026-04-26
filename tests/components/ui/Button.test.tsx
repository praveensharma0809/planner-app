import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button } from "@/app/components/ui/Button"
import { TestProviders } from "@/tests/utils/testProviders"

describe("Button", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("renders with default variant ghost", () => {
    render(<Button>Click</Button>, { wrapper: TestProviders })
    expect(screen.getByRole("button")).toHaveClass("ui-btn-ghost")
  })

  it("renders each variant with correct class", () => {
    const { rerender } = render(<Button variant="primary">P</Button>, { wrapper: TestProviders })
    expect(screen.getByRole("button")).toHaveClass("ui-btn-primary")
    rerender(<Button variant="ghost">G</Button>)
    expect(screen.getByRole("button")).toHaveClass("ui-btn-ghost")
    rerender(<Button variant="danger">D</Button>)
    expect(screen.getByRole("button")).toHaveClass("ui-btn-danger")
    rerender(<Button variant="success">S</Button>)
    expect(screen.getByRole("button")).toHaveClass("ui-btn-success")
  })

  it("renders each size with correct class", () => {
    const { rerender } = render(<Button size="sm">S</Button>, { wrapper: TestProviders })
    expect(screen.getByRole("button")).toHaveClass("ui-btn-sm")
    rerender(<Button size="md">M</Button>)
    expect(screen.getByRole("button")).toHaveClass("ui-btn-md")
    rerender(<Button size="lg">L</Button>)
    expect(screen.getByRole("button")).toHaveClass("ui-btn-lg")
  })

  it("fires onClick handler when clicked", async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>, { wrapper: TestProviders })
    await userEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("disabled button does not fire onClick", async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click</Button>, { wrapper: TestProviders })
    await userEvent.click(screen.getByRole("button"))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("renders children", () => {
    render(<Button>Save</Button>, { wrapper: TestProviders })
    expect(screen.getByRole("button")).toHaveTextContent("Save")
  })

  it("renders with type attribute", () => {
    render(<Button type="submit">Submit</Button>, { wrapper: TestProviders })
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit")
  })

  it("applies custom className", () => {
    render(<Button className="my-btn">Btn</Button>, { wrapper: TestProviders })
    expect(screen.getByRole("button")).toHaveClass("my-btn")
  })
})
