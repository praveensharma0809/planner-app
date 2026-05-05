import { useMemo, type ReactNode } from "react"
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
import { RowActionButton, type ColumnItem } from "@/app/components/subjects-data-table/shared"

interface NavigationItemCardProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  dragEnabled?: boolean
  isDragging?: boolean
}

export function NavigationItemCard({
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
      className={`rounded-xl p-1.5 transition-colors ${isDragging ? "bg-surface-hover opacity-90" : isActive ? "bg-pastel-lilac/60" : "hover:bg-surface-hover"}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          {...(dragEnabled ? (dragAttributes as object) : {})}
          {...(dragEnabled ? (dragListeners as object) : {})}
          className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left transition-colors min-h-[44px] md:min-h-0 flex flex-col justify-center"
          style={dragEnabled ? { touchAction: "none", cursor: isDragging ? "grabbing" : "grab" } : undefined}
          title={dragEnabled ? `Drag to reorder ${item.label}` : undefined}
        >
          <p
            className={`truncate text-sm font-medium ${isActive ? "text-pastel-lilac-text" : "text-text-primary"}`}
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

interface DraggableNavigationItemProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  reorderEnabled: boolean
}

export function DraggableNavigationItem({
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
      className="w-full lg:w-[208px] lg:min-w-[196px] h-full shrink-0 rounded-2xl border border-border-hairline bg-surface-panel px-2 py-2 snap-start flex flex-col overflow-hidden shadow-card"
    >
      <div className="px-1.5 pb-2 shrink-0">
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

        {canReorder ? (
          <DndContext
            sensors={localSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              <div className="space-y-1">
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
        <div className="mt-2 space-y-1.5 border-t border-border-hairline px-1 pt-2 shrink-0">
          {footer}
        </div>
      )}
    </section>
  )
}
