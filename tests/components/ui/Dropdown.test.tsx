import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Dropdown } from "@/app/components/ui/Dropdown"
import { TestProviders } from "@/tests/utils/testProviders"

const items = [
  { id: "1", label: "Option 1", onClick: vi.fn() },
  { id: "2", label: "Option 2", onClick: vi.fn() },
  { id: "sep", separator: true as const },
  { id: "3", label: "Option 3", onClick: vi.fn() },
]

describe("Dropdown", () => {
  beforeEach(() => {
    items.forEach((item) => {
      if ("onClick" in item && item.onClick) item.onClick.mockReset()
    })
  })

  it("opens dropdown on trigger click", async () => {
    render(<Dropdown trigger="Menu" items={items} />, { wrapper: TestProviders })
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByText("Menu"))
    expect(screen.getByRole("menu")).toBeInTheDocument()
  })

  it("renders all options", async () => {
    render(<Dropdown trigger="Menu" items={items} />, { wrapper: TestProviders })
    await userEvent.setup().click(screen.getByText("Menu"))
    expect(screen.getAllByRole("menuitem")).toHaveLength(3)
  })

  it("fires option onClick with correct value", async () => {
    const onClick = vi.fn()
    const opts = [{ id: "1", label: "Pick Me", onClick }]
    render(<Dropdown trigger="Menu" items={opts} />, { wrapper: TestProviders })
    const user = userEvent.setup()
    await user.click(screen.getByText("Menu"))
    await user.click(screen.getByText("Pick Me"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("closes on Escape key press", async () => {
    render(<Dropdown trigger="Menu" items={items} />, { wrapper: TestProviders })
    const user = userEvent.setup()
    await user.click(screen.getByText("Menu"))
    expect(screen.getByRole("menu")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("closes on click outside", async () => {
    render(<Dropdown trigger="Menu" items={items} />, { wrapper: TestProviders })
    const user = userEvent.setup()
    await user.click(screen.getByText("Menu"))
    expect(screen.getByRole("menu")).toBeInTheDocument()
    await user.click(document.body)
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("keyboard navigation: Enter selects focused menuitem", async () => {
    const onClick = vi.fn()
    const opts = [{ id: "1", label: "Enter Me", onClick }]
    render(<Dropdown trigger="Menu" items={opts} />, { wrapper: TestProviders })
    const user = userEvent.setup()
    await user.click(screen.getByText("Menu"))
    screen.getByText("Enter Me").focus()
    await user.keyboard("{Enter}")
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
