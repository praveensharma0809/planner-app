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
    transform: draggable ? CSS.Transform.toString(transform) : undefined,
    transition: draggable ? transition : undefined,
    opacity: draggable && isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      className={`rounded-xl p-1.5 transition-colors ${isActive ? "bg-[--accent-selected-bg]" : "hover:bg-surface-hover"}`}
      style={style}
    >
      <div className="flex items-start gap-1.5">
        {draggable && (
          <button
            type="button"
            aria-label={`Reorder ${item.label}`}
            className="mt-1 flex shrink-0 cursor-grab items-center justify-center rounded text-[10px] active:cursor-grabbing text-text-muted min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            {...attributes}
            {...listeners}
          >
            <span className="md:mt-0">⋮⋮</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left transition-colors min-h-[44px] md:min-h-0 flex flex-col justify-center"
        >
          <p
            className={`truncate text-sm font-medium ${isActive ? "text-[--accent-selected-fg] font-semibold" : "text-text-primary"}`}
          >
            {item.label}
          </p>
          {item.hint && (
            <p className="mt-0.5 text-[11px] text-text-muted">
              {item.hint}
            </p>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1 pt-0.5 md:pt-1">
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
      className="w-full lg:w-[200px] lg:min-w-[180px] h-full shrink-0 surface-card px-2 py-2 snap-start flex flex-col"
    >
      <div className="px-1.5 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {title}
        </p>
      </div>

      <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="px-2 py-4 text-sm text-text-muted">
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
        <div className="mt-2 space-y-1.5 border-t border-border-hairline px-1 pt-2">
          {footer}
        </div>
      )}
    </section>
  )
})

export { NavigationColumn, NavigationColumnRow }
export type { NavigationColumnProps, NavigationColumnRowProps }
