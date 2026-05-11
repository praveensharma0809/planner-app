import { useId, useMemo, type ReactNode } from "react"
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
import { RowActionButton, type ColumnItem, type SortDir } from "@/app/components/subjects-data-table/shared"

interface NavigationItemCardProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  dragAttributes?: DraggableAttributes
  dragListeners?: DraggableSyntheticListeners
  dragEnabled?: boolean
  isDragging?: boolean
  expanded?: boolean
  onToggleExpand?: (id: string) => void
}

export function NavigationItemCard({
  item,
  isActive,
  onSelect,
  dragAttributes,
  dragListeners,
  dragEnabled = false,
  isDragging = false,
  expanded = false,
  onToggleExpand,
}: NavigationItemCardProps) {
  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <div
        className={`group rounded-lg p-1 transition-colors ${isDragging ? "bg-surface-hover opacity-90" : isActive ? "bg-[--accent-selected-bg]" : "hover:bg-surface-hover"}`}
      >
        <div className="flex items-start gap-1">
          {dragEnabled && (
            <button
              type="button"
              aria-label={`Reorder ${item.label}`}
              className="mt-0.5 flex shrink-0 cursor-grab items-center justify-center rounded text-[10px] active:cursor-grabbing text-text-muted opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
              style={{ touchAction: "none" }}
              {...(dragAttributes as object)}
              {...(dragListeners as object)}
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3 3h2v2H3V3zm0 4h2v2H3V7zm0 4h2v2H3v-2zm4-8h2v2H7V3zm0 4h2v2H7V7zm0 4h2v2H7v-2zm4-8h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2z" />
              </svg>
            </button>
          )}

          {hasChildren && (
            <button
              type="button"
              aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
              onClick={(e) => { e.stopPropagation(); onToggleExpand?.(item.id) }}
              className="mt-0.5 flex shrink-0 items-center justify-center rounded text-text-muted hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            >
              <svg
                className={`h-3 w-3 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {!hasChildren && !dragEnabled && (
            <div className="w-0 md:w-4 shrink-0" />
          )}
          {!hasChildren && dragEnabled && (
            <div className="w-4 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left transition-colors min-h-[44px] md:min-h-0 flex flex-col justify-center"
          >
            <p
              className={`truncate text-[13px] font-medium ${isActive ? "text-[--accent-selected-fg] font-semibold" : "text-text-primary"}`}
            >
              {item.label}
            </p>
            {item.hint && (
              <p className="mt-0.5 text-[11px] text-text-muted">
                {item.hint}
              </p>
            )}
          </button>

          <div className="flex shrink-0 items-center gap-0.5 pt-0.5 md:pt-1">
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

      {/* Children (collapsible chapters) */}
      {hasChildren && (
        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            expanded ? "max-h-[2000px] opacity-100 mt-0.5" : "max-h-0 opacity-0"
          }`}
        >
          <div className="ml-4 border-l border-border-hairline pl-2">
            {item.children!.map((child) => (
              <div
                key={child.id}
                className="rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-hover"
              >
                <button
                  type="button"
                  onClick={() => onSelect(child.id)}
                  className="w-full text-left min-h-[44px] md:min-h-0"
                >
                  <p className="truncate text-[12px] text-text-secondary">
                    {child.label}
                  </p>
                  {child.hint && (
                    <p className="mt-0.5 text-[10px] text-text-muted">{child.hint}</p>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DraggableNavigationItemProps {
  item: ColumnItem
  isActive: boolean
  onSelect: (id: string) => void
  reorderEnabled: boolean
  expanded?: boolean
  onToggleExpand?: (id: string) => void
}

export function DraggableNavigationItem({
  item,
  isActive,
  onSelect,
  reorderEnabled,
  expanded = false,
  onToggleExpand,
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
        expanded={expanded}
        onToggleExpand={onToggleExpand}
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
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
  sortDir?: SortDir
  onToggleSort?: () => void
  sortEnabled?: boolean
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
  expandedIds,
  onToggleExpand,
  sortDir = "none",
  onToggleSort,
  sortEnabled = false,
}: NavigationColumnProps) {
  const dndId = useId()
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
      className="w-full lg:w-[200px] lg:min-w-[180px] h-full shrink-0 surface-card px-1.5 py-1.5 snap-start flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-1 pb-1.5 shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {title}
        </p>
        {sortEnabled && onToggleSort && (
          <button
            type="button"
            onClick={onToggleSort}
            className="flex items-center justify-center rounded p-0.5 text-text-muted hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            aria-label={`Sort ${title} ${sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : "none"}`}
            title={`Sort: ${sortDir === "none" ? "Default" : sortDir === "asc" ? "A→Z" : "Z→A"}`}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {sortDir === "asc" ? (
                <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              ) : sortDir === "desc" ? (
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <>
                  <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 space-y-0.5 overflow-y-auto pr-0.5">
        {items.length === 0 && (
          <p className="px-2 py-4 text-sm text-text-muted">
            {emptyMessage}
          </p>
        )}

        {canReorder ? (
          <DndContext
            id={dndId}
            sensors={localSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <DraggableNavigationItem
                    key={item.id}
                    item={item}
                    isActive={item.id === activeId}
                    onSelect={onSelect}
                    reorderEnabled={canReorder}
                    expanded={expandedIds?.has(item.id) ?? false}
                    onToggleExpand={onToggleExpand}
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
              expanded={expandedIds?.has(item.id) ?? false}
              onToggleExpand={onToggleExpand}
            />
          ))
        )}
      </div>

      {footer && (
        <div className="mt-1.5 space-y-1 border-t border-border-hairline px-1 pt-1.5 shrink-0">
          {footer}
        </div>
      )}
    </section>
  )
}
