import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Tabs } from "@/app/components/ui/Tabs"
import { TestProviders } from "@/tests/utils/testProviders"

const sampleTabs = [
  { id: "tab1", label: "First", content: <p>Content one</p> },
  { id: "tab2", label: "Second", content: <p>Content two</p> },
  { id: "tab3", label: "Third", content: <p>Content three</p> },
]

function renderTabs(props: Partial<Parameters<typeof Tabs>[0]> = {}) {
  return render(<Tabs tabs={sampleTabs} {...props} />, { wrapper: TestProviders })
}

describe("Tabs", () => {
  it("renders all tab triggers", () => {
    renderTabs()
    expect(screen.getByRole("tab", { name: "First" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Second" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Third" })).toBeInTheDocument()
  })

  it("shows content for the default tab (first tab)", () => {
    renderTabs()
    expect(screen.getByText("Content one")).toBeInTheDocument()
  })

  it("shows content for an explicit defaultTab", () => {
    renderTabs({ defaultTab: "tab2" })
    expect(screen.getByText("Content two")).toBeInTheDocument()
  })

  it("clicking a tab switches the content panel", async () => {
    renderTabs()
    await userEvent.click(screen.getByRole("tab", { name: "Second" }))
    expect(screen.getByText("Content two")).toBeInTheDocument()
    expect(screen.queryByText("Content one")).not.toBeInTheDocument()
  })

  it("aria-selected is set on the active tab", () => {
    renderTabs({ defaultTab: "tab2" })
    expect(screen.getByRole("tab", { name: "Second" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "First" })).toHaveAttribute("aria-selected", "false")
  })

})
