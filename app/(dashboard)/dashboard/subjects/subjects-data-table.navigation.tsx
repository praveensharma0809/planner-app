import { memo, type CSSProperties, type ReactNode } from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import type { useSensors } from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { RowActionButton, type ColumnItem } from "@/app/components/subjects-data-table/shared"

interface NavigationColumnRowProps {
  item: ColumnItem
  isActive: boolean
  draggable: boolean
  onSelect: (id: string) => void
}

function NavigationColumnRow({ item, isActive, draggable, onSelect }: NavigationColumnRowProps) {
  const sortable = useSortable({ id: item.id, disabled: !draggable })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const style: CSSProperties = {
    borderColor: isActive ? "var(--sh-primary-glow)" : "transparent",
    background: isActive ? "var(--sh-primary-muted)" : "transparent",
    transform: draggable ? CSS.Transform.toString(transform) : undefined,
    transition: draggable ? transition : undefined,
    opacity: draggable && isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      className="rounded-lg border p-1.5 transition-colors"
      style={style}
    >
      <div className="flex items-start gap-1.5">
        {draggable && (
          <button
            type="button"
            aria-label={`Reorder ${item.label}`}
            className="mt-1 flex h-5 w-3 shrink-0 cursor-grab items-center justify-center rounded text-[10px] active:cursor-grabbing"
            style={{ color: "var(--sh-text-muted)" }}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[rgba(124,108,255,0.08)]"
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

interface NavigationColumnProps {
  title: string
  items: ColumnItem[]
  activeId: string | null
  emptyMessage: string
  onSelect: (id: string) => void
  footer?: ReactNode
  onReorder?: (newOrderIds: string[]) => void
  sensors?: ReturnType<typeof useSensors>
}

const NavigationColumn = memo(function NavigationColumn({
  title,
  items,
  activeId,
  emptyMessage,
  onSelect,
  footer,
  onReorder,
  sensors,
}: NavigationColumnProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorder) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = items.map((item) => item.id)
    const fromIndex = ids.indexOf(String(active.id))
    const toIndex = ids.indexOf(String(over.id))
    if (fromIndex < 0 || toIndex < 0) return

    onReorder(arrayMove(ids, fromIndex, toIndex))
  }

  const renderRow = (item: ColumnItem) => {
    const isActive = item.id === activeId
    return (
      <NavigationColumnRow
        key={item.id}
        item={item}
        isActive={isActive}
        draggable={Boolean(onReorder)}
        onSelect={onSelect}
      />
    )
  }

  return (
    <section
      className="w-[220px] min-w-[208px] h-full shrink-0 rounded-xl border px-2 py-2 snap-start flex flex-col"
      style={{
        borderColor: "var(--sh-border)",
        background: "color-mix(in srgb, var(--sh-card) 94%, var(--foreground) 6%)",
      }}
    >
      <div className="px-1.5 pb-2">
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

        {items.length > 0 && onReorder && sensors ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={rectSortingStrategy}
            >
              {items.map(renderRow)}
            </SortableContext>
          </DndContext>
        ) : (
          items.map(renderRow)
        )}
      </div>

      {footer && (
        <div
          className="mt-2 space-y-1.5 border-t px-1 pt-2"
          style={{ borderColor: "var(--sh-border)" }}
        >
          {footer}
        </div>
      )}
    </section>
  )
})

export { NavigationColumn, NavigationColumnRow }
export type { NavigationColumnProps, NavigationColumnRowProps }
