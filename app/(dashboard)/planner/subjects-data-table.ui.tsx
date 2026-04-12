import { useMemo, type FormEvent, type ReactNode } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button, Input, Modal } from "@/app/components/ui"

export interface ColumnItem {
  id: string
  label: string
  hint?: string
  onEdit?: () => void
  onDelete?: () => void
}

interface NavigationColumnProps {
  title: string
  items: ColumnItem[]
  activeId: string | null
  emptyMessage: string
  onSelect: (id: string) => void
  reorderEnabled?: boolean
  onReorder?: (orderedIds: string[]) => void
  footer?: ReactNode
}

export function NavigationColumn({
  title,
  items,
  activeId,
  emptyMessage,
  onSelect,
  reorderEnabled = false,
  onReorder,
  footer,
}: NavigationColumnProps) {
  const canReorder = reorderEnabled && Boolean(onReorder) && items.length > 1
  const itemIds = useMemo(() => items.map((item) => item.id), [items])

  const localSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleColumnDragEnd(event: DragEndEvent) {
    if (!canReorder || !onReorder) return

    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const oldIndex = itemIds.indexOf(activeId)
    const newIndex = itemIds.indexOf(overId)
    if (oldIndex === -1 || newIndex === -1) return

    onReorder(arrayMove(itemIds, oldIndex, newIndex))
  }

  return (
    <section
      className="w-[208px] min-w-[196px] h-full shrink-0 rounded-xl border px-2 py-2 snap-start flex flex-col overflow-hidden"
      style={{
        borderColor: "var(--sh-border)",
        background: "color-mix(in srgb, var(--sh-card) 94%, var(--foreground) 6%)",
      }}
    >
      <div className="px-1.5 pb-2 shrink-0">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--sh-text-muted)" }}
        >
          {title}
        </p>
      </div>

      <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="px-2 py-4 text-sm" style={{ color: "var(--sh-text-muted)" }}>
            {emptyMessage}
          </p>
        )}

        {canReorder ? (
          <DndContext
            sensors={localSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <DraggableNavigationItem
                    key={item.id}
                    item={item}
                    isActive={item.id === activeId}
                    onSelect={onSelect}
                    reorderEnabled={canReorder}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          items.map((item) => (
            <NavigationItemCard
              key={item.id}
              item={item}
              isActive={item.id === activeId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {footer && (
        <div
          className="mt-2 space-y-1.5 border-t px-1 pt-2 shrink-0"
          style={{ borderColor: "var(--sh-border)" }}
        >
          {footer}
        </div>
      )}
    </section>
  )
}

interface NavigationItemCardProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  dragEnabled?: boolean
  isDragging?: boolean
}

function NavigationItemCard({
  item,
  isActive,
  onSelect,
  dragAttributes,
  dragListeners,
  dragEnabled = false,
  isDragging = false,
}: NavigationItemCardProps) {
  return (
    <div
      className="rounded-lg border p-1.5 transition-colors"
      style={{
        borderColor: isDragging
          ? "var(--sh-primary-glow)"
          : isActive
            ? "var(--sh-primary-glow)"
            : "transparent",
        background: isDragging
          ? "rgba(124,108,255,0.16)"
          : isActive
            ? "var(--sh-primary-muted)"
            : "transparent",
        opacity: isDragging ? 0.88 : 1,
      }}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          {...(dragEnabled ? (dragAttributes as object) : {})}
          {...(dragEnabled ? (dragListeners as object) : {})}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[rgba(124,108,255,0.08)]"
          style={dragEnabled ? { touchAction: "none", cursor: isDragging ? "grabbing" : "grab" } : undefined}
          title={dragEnabled ? `Drag to reorder ${item.label}` : undefined}
        >
          <p
            className="truncate text-sm font-semibold"
            style={{
              color: isActive ? "var(--sh-primary-light)" : "var(--sh-text-primary)",
            }}
          >
            {item.label}
          </p>
          {item.hint && (
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
              {item.hint}
            </p>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1 pt-1">
          {item.onEdit && (
            <RowActionButton
              label={`Edit ${item.label}`}
              onClick={item.onEdit}
            />
          )}
          {item.onDelete && (
            <RowActionButton
              label={`Delete ${item.label}`}
              onClick={item.onDelete}
              danger
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface DraggableNavigationItemProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  reorderEnabled: boolean
}

function DraggableNavigationItem({
  item,
  isActive,
  onSelect,
  reorderEnabled,
}: DraggableNavigationItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !reorderEnabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <NavigationItemCard
        item={item}
        isActive={isActive}
        onSelect={onSelect}
        isDragging={isDragging}
        dragEnabled={reorderEnabled}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
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
}: NameModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form className="space-y-4" onSubmit={onSubmit}>
        <Input
          autoFocus
          required
          label={fieldLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface RowActionButtonProps {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function RowActionButton({ label, onClick, danger = false, disabled = false }: RowActionButtonProps) {
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
