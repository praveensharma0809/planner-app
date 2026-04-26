import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Modal } from "@/app/components/ui/Modal"
import { TestProviders } from "@/tests/utils/testProviders"

function renderModal(open: boolean, onClose = vi.fn(), props: Partial<Parameters<typeof Modal>[0]> = {}) {
  return render(
    <Modal open={open} onClose={onClose} title="Test Modal" {...props}>
      <p>Modal content</p>
    </Modal>,
    { wrapper: TestProviders }
  )
}

describe("Modal", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("renders when open is true", () => {
    renderModal(true)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("does not render when open is false", () => {
    renderModal(false)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("renders title and children content", () => {
    renderModal(true)
    expect(screen.getByText("Test Modal")).toBeInTheDocument()
    expect(screen.getByText("Modal content")).toBeInTheDocument()
  })

  it("closes on Escape key press", async () => {
    const handleClose = vi.fn()
    renderModal(true, handleClose)
    await userEvent.keyboard("{Escape}")
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('has aria-modal="true" on the dialog', () => {
    renderModal(true)
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true")
  })

  it("calls onClose when backdrop is clicked", async () => {
    const handleClose = vi.fn()
    renderModal(true, handleClose)
    const backdrop = document.querySelector('[aria-hidden="true"]')!
    await userEvent.click(backdrop)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("does not call onClose on backdrop click when backdropClose=false", async () => {
    const handleClose = vi.fn()
    renderModal(true, handleClose, { backdropClose: false })
    const backdrop = document.querySelector('[aria-hidden="true"]')!
    await userEvent.click(backdrop)
    expect(handleClose).not.toHaveBeenCalled()
  })

  it("locks body scroll when modal is open", () => {
    renderModal(true)
    expect(document.body.style.overflow).toBe("hidden")
  })
})
