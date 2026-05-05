import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TestProviders } from "@/tests/utils/testProviders"
import { MobileTabBar } from "@/app/components/layout/MobileTabBar"

const mockPathname = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe("MobileTabBar", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockPathname.mockReturnValue("/dashboard")
  })

  it("renders 5 navigation tabs", () => {
    render(<MobileTabBar />, { wrapper: TestProviders })
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(5)
  })

  it("has correct ARIA label on nav element", () => {
    render(<MobileTabBar />, { wrapper: TestProviders })
    expect(screen.getByRole("navigation")).toHaveAttribute("aria-label", "Primary mobile")
  })

  it("marks Overview as active when on /dashboard", () => {
    mockPathname.mockReturnValue("/dashboard")
    render(<MobileTabBar />, { wrapper: TestProviders })
    expect(screen.getByLabelText("Overview")).toHaveAttribute("aria-current", "page")
  })

  it("marks Subjects as active when on /dashboard/subjects", () => {
    mockPathname.mockReturnValue("/dashboard/subjects")
    render(<MobileTabBar />, { wrapper: TestProviders })
    expect(screen.getByLabelText("Subjects")).toHaveAttribute("aria-current", "page")
  })

  it("marks Calendar as active when on /dashboard/calendar", () => {
    mockPathname.mockReturnValue("/dashboard/calendar")
    render(<MobileTabBar />, { wrapper: TestProviders })
    expect(screen.getByLabelText("Calendar")).toHaveAttribute("aria-current", "page")
  })

  it("marks Schedule as active when on /schedule", () => {
    mockPathname.mockReturnValue("/schedule/test")
    render(<MobileTabBar />, { wrapper: TestProviders })
    expect(screen.getByLabelText("Schedule")).toHaveAttribute("aria-current", "page")
  })

  it("marks Planner as active when on /planner", () => {
    mockPathname.mockReturnValue("/planner/edit")
    render(<MobileTabBar />, { wrapper: TestProviders })
    expect(screen.getByLabelText("Planner")).toHaveAttribute("aria-current", "page")
  })

  it("does not mark non-exact match for Overview (prefix match only for exact)", () => {
    mockPathname.mockReturnValue("/dashboard/subjects")
    render(<MobileTabBar />, { wrapper: TestProviders })
    // Overview uses exact: true, so /dashboard/subjects should NOT mark it active
    expect(screen.getByLabelText("Overview")).not.toHaveAttribute("aria-current")
  })

  it("each tab has an aria-label", () => {
    render(<MobileTabBar />, { wrapper: TestProviders })
    const labels = ["Overview", "Subjects", "Calendar", "Schedule", "Planner"]
    for (const label of labels) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })
})
