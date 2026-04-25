// Cross-page primitives shared by both the planner and dashboard
// `subjects-data-table.tsx` files. Kept intentionally small — only
// truly identical pieces live here. Page-specific NavigationColumn /
// NameModal implementations stay in their owning files because their
// drag-handle UX, column widths, and footer affordances diverge.

interface RowActionButtonProps {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function RowActionButton({
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
}

export interface ColumnItem {
  id: string
  label: string
  hint?: string
  onEdit?: () => void
  onDelete?: () => void
}
