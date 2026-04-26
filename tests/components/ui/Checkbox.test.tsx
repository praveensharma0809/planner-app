import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Checkbox } from "@/app/components/ui/Checkbox"
import { TestProviders } from "@/tests/utils/testProviders"

describe("Checkbox", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("uncontrolled: click toggles checked state", async () => {
    render(<Checkbox label="Agree" />, { wrapper: TestProviders })
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it("controlled: checked prop drives display, onChange fires", async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Opt in" checked={false} onChange={onChange} />, { wrapper: TestProviders })
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)
    expect(onChange).toHaveBeenCalled()
  })

  it("disabled: click does nothing, onChange does not fire", async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Locked" disabled onChange={onChange} />, { wrapper: TestProviders })
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).toBeDisabled()
    expect(checkbox).not.toBeChecked()
    try { await userEvent.click(checkbox) } catch { /* userEvent rejects disabled elements */ }
    expect(onChange).not.toHaveBeenCalled()
  })

  it("space key toggles checkbox", async () => {
    render(<Checkbox label="Toggle" />, { wrapper: TestProviders })
    const checkbox = screen.getByRole("checkbox")
    expect(checkbox).not.toBeChecked()
    checkbox.focus()
    await userEvent.keyboard(" ")
    expect(checkbox).toBeChecked()
  })
})
