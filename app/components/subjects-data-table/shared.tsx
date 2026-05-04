// Cross-page primitives shared by both the planner and dashboard
// `subjects-data-table.tsx` files.

import { memo, useRef, type FormEvent } from "react"
import { Button, Input, Modal } from "@/app/components/ui"

interface RowActionButtonProps {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export const RowActionButton = memo(function RowActionButton({
  label,
  onClick,
  danger = false,
  disabled = false,
}: RowActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border p-1 transition-colors hover:bg-white/5 disabled:opacity-50"
      style={{ borderColor: "var(--sh-border)", color: danger ? "#f87171" : "var(--sh-text-muted)" }}
      aria-label={label}
      title={label}
    >
      {danger ? (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
})

export interface ColumnItem {
  id: string
  label: string
  hint?: string
  onEdit?: () => void
  onDelete?: () => void
}

interface NameModalProps {
  open: boolean
  title: string
  fieldLabel: string
  value: string
  placeholder: string
  submitLabel: string
  loading: boolean
  onChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  destructiveActionLabel?: string
  onDestructiveAction?: () => void
  destructiveDisabled?: boolean
}

export function NameModal({
  open,
  title,
  fieldLabel,
  value,
  placeholder,
  submitLabel,
  loading,
  onChange,
  onClose,
  onSubmit,
  destructiveActionLabel,
  onDestructiveAction,
  destructiveDisabled = false,
}: NameModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" initialFocusRef={inputRef}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          required
          ref={inputRef}
          label={fieldLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {destructiveActionLabel && onDestructiveAction && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onDestructiveAction}
              disabled={destructiveDisabled}
            >
              {destructiveActionLabel}
            </Button>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
