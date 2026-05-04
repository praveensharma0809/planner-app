import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef } from "react"
import { Modal } from "@/app/components/ui/Modal"
import { TestProviders } from "@/tests/utils/testProviders"

/**
 * Regression suite for the Modal focus-stealing bug (Cluster P, Phase 0).
 *
 * The original bug:
 * - `handleKey` closed over `onClose` directly, so any inline arrow passed by
 *   the parent (e.g. `() => { if (saving) return; setOpen(false) }`) produced
 *   a new function reference on every parent render.
 * - That made `handleKey` unstable, which re-ran the main `useEffect`, which
 *   re-fired `requestAnimationFrame(() => focus first focusable)` — and the
 *   "first focusable" was the X button, stealing focus from whatever the user
 *   was typing into.
 *
 * The fix is layered:
 *   1. `hasInitiallyFocusedRef` — one-shot focus per open transition.
 *   2. `onCloseRef` — keeps `handleKey`'s deps empty (stable forever).
 *   3. `data-modal-close="true"` — excludes the X button from the focusable
 *      selector so the fallback "first focusable" never lands on Close.
 *
 * These tests guard each layer.
 */

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function SimpleModal({ onClose = vi.fn() }: { onClose?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Modal open={true} onClose={onClose} title="Simple" initialFocusRef={inputRef}>
      <input ref={inputRef} placeholder="focus-target" />
    </Modal>
  )
}

// Re-renders with a fresh inline `onClose` arrow each time `version` changes —
// the exact pattern that triggered the original focus-steal regression.
function VersionedModal({ version }: { version: number }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Modal
      open={true}
      onClose={() => {
        // Closure captures `version` so the arrow is a new function each render.
        void version
      }}
      title={`Versioned ${version}`}
      initialFocusRef={inputRef}
    >
      <input ref={inputRef} placeholder="versioned-target" />
    </Modal>
  )
}

function TypingModal() {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Modal open={true} onClose={vi.fn()} title="Typing" initialFocusRef={inputRef}>
      <input ref={inputRef} placeholder="typing-target" />
    </Modal>
  )
}

// ---------------------------------------------------------------------------

describe("Modal — focus stability", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("initial focus lands on the initialFocusRef target", async () => {
    render(<SimpleModal />, { wrapper: TestProviders })

    await waitFor(() => {
      expect(screen.getByPlaceholderText("focus-target")).toBe(document.activeElement)
    })
  })

  it("close button does not receive initial focus when initialFocusRef is provided", async () => {
    render(<SimpleModal />, { wrapper: TestProviders })

    await waitFor(() => {
      expect(screen.getByPlaceholderText("focus-target")).toBe(document.activeElement)
    })

    expect(screen.getByLabelText("Close modal")).not.toBe(document.activeElement)
  })

  it("close button is excluded from fallback focus when no initialFocusRef is provided", async () => {
    // No `initialFocusRef` — Modal falls back to "first focusable in panel".
    // The `data-modal-close` attribute on the X button must keep it out of
    // that selector; otherwise the X button would steal focus on open.
    render(
      // eslint-disable-next-line local/require-modal-initial-focus-ref -- intentionally omitted to validate the no-ref fallback path
      <Modal open={true} onClose={vi.fn()} title="No-Ref">
        <button type="button">first-focusable</button>
        <input placeholder="second-focusable" />
      </Modal>,
      { wrapper: TestProviders }
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "first-focusable" })).toBe(
        document.activeElement
      )
    })

    expect(screen.getByLabelText("Close modal")).not.toBe(document.activeElement)
  })

  it("focus is not stolen after multiple parent re-renders with an inline onClose arrow", async () => {
    // This is the core regression test. Each `rerender` produces a new
    // `onClose` arrow. Before the `onCloseRef` fix, the new arrow would
    // destabilize `handleKey`, the main useEffect would re-run, and focus
    // would jump to the close button. With the fix in place, focus must
    // stay on the input across any number of parent re-renders.
    const { rerender } = render(<VersionedModal version={0} />, { wrapper: TestProviders })

    const input = screen.getByPlaceholderText("versioned-target")
    await waitFor(() => {
      expect(input).toBe(document.activeElement)
    })

    rerender(<VersionedModal version={1} />)
    rerender(<VersionedModal version={2} />)
    rerender(<VersionedModal version={3} />)

    expect(input).toBe(document.activeElement)
    expect(screen.getByLabelText("Close modal")).not.toBe(document.activeElement)
  })

  it("focus stays on the title input while typing 10 characters", async () => {
    const user = userEvent.setup()

    render(<TypingModal />, { wrapper: TestProviders })

    const input = screen.getByPlaceholderText("typing-target")
    await waitFor(() => {
      expect(input).toBe(document.activeElement)
    })

    // userEvent.type fires real keydown/keypress/input/keyup events, which
    // re-render the parent (state update) on every keystroke. If Modal's
    // useEffect were sensitive to those re-renders, focus would jump to the
    // close button mid-string and the value would end up shorter than 10.
    await user.type(input, "helloworld")

    expect(input).toBe(document.activeElement)
    expect(input).toHaveValue("helloworld")
    expect(screen.getByLabelText("Close modal")).not.toBe(document.activeElement)
  })

  it("re-opening the modal re-fires initial focus exactly once per open transition", async () => {
    // Validates the `hasInitiallyFocusedRef` + `prevOpenRef` reset logic:
    // close → re-open should land focus back on the initialFocusRef target.
    function Toggleable({ open }: { open: boolean }) {
      const inputRef = useRef<HTMLInputElement>(null)
      return (
        <Modal open={open} onClose={vi.fn()} title="Toggle" initialFocusRef={inputRef}>
          <input ref={inputRef} placeholder="toggle-target" />
        </Modal>
      )
    }

    const { rerender } = render(<Toggleable open={true} />, { wrapper: TestProviders })

    await waitFor(() => {
      expect(screen.getByPlaceholderText("toggle-target")).toBe(document.activeElement)
    })

    // Close
    rerender(<Toggleable open={false} />)
    expect(screen.queryByPlaceholderText("toggle-target")).not.toBeInTheDocument()

    // Re-open — focus should return to the target input
    rerender(<Toggleable open={true} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText("toggle-target")).toBe(document.activeElement)
    })
  })
})
