import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Input } from "@/app/components/ui/Input"
import { TestProviders } from "@/tests/utils/testProviders"

describe("Input", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("renders input element", () => {
    render(<Input />, { wrapper: TestProviders })
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  it("renders label when provided", () => {
    render(<Input label="Email" />, { wrapper: TestProviders })
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
  })

  it("fires onChange with the new value", async () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />, { wrapper: TestProviders })
    await userEvent.type(screen.getByRole("textbox"), "hello")
    expect(onChange).toHaveBeenCalled()
    expect(screen.getByRole("textbox")).toHaveValue("hello")
  })

  it("shows error styling when error prop is set", () => {
    render(<Input error="Required field" />, { wrapper: TestProviders })
    expect(screen.getByText("Required field")).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveClass("border-[#EF4444]")
  })

  it("disables input when disabled prop is set", () => {
    render(<Input disabled />, { wrapper: TestProviders })
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  it("renders placeholder", () => {
    render(<Input placeholder="Enter name" />, { wrapper: TestProviders })
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument()
  })

  it("renders without label gracefully", () => {
    render(<Input />, { wrapper: TestProviders })
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(document.querySelector("label")).not.toBeInTheDocument()
  })
})
