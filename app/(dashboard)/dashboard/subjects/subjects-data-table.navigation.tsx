import { memo, useCallback, type CSSProperties, type ReactNode } from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import type { useSensors } from "@dnd-kit/core"
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { RowActionButton, type ColumnItem, type SortDir } from "@/app/components/subjects-data-table/shared"

interface NavigationColumnRowProps {
  item: ColumnItem
  isActive: boolean
  draggable: boolean
  expanded: boolean
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
}

function NavigationColumnRow({ item, isActive, draggable, expanded, onSelect, onToggleExpand }: NavigationColumnRowProps) {
  const sortable = useSortable({ id: item.id, disabled: !draggable })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const style: CSSProperties = {
    transform: draggable ? CSS.Transform.toString(transform) : undefined,
    transition: draggable ? transition : undefined,
    opacity: draggable && isDragging ? 0.6 : 1,
  }

  const hasChildren = item.children && item.children.length > 0

  return (
    <div>
      <div
        ref={draggable ? setNodeRef : undefined}
        className={`group rounded-lg p-1 transition-colors ${isActive ? "bg-[--accent-selected-bg]" : "hover:bg-surface-hover"}`}
        style={style}
      >
        <div className="flex items-start gap-1">
          {draggable && (
            <button
              type="button"
              aria-label={`Reorder ${item.label}`}
              className="mt-0.5 flex shrink-0 cursor-grab items-center justify-center rounded text-[10px] active:cursor-grabbing text-text-muted opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
              style={{ touchAction: "none" }}
              {...attributes}
              {...listeners}
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
              onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id) }}
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
          {!hasChildren && (
            <div className="w-0 md:w-4 shrink-0" />
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
                className={`rounded-lg px-1.5 py-1 transition-colors ${child.id === item.id ? "" : "hover:bg-surface-hover"}`}
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

interface NavigationColumnProps {
  title: string
  items: ColumnItem[]
  activeId: string | null
  emptyMessage: string
  onSelect: (id: string) => void
  footer?: ReactNode
  onReorder?: (newOrderIds: string[]) => void
  sensors?: ReturnType<typeof useSensors>
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
  sortDir?: SortDir
  onToggleSort?: () => void
  sortEnabled?: boolean
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
  expandedIds,
  onToggleExpand,
  sortDir = "none",
  onToggleSort,
  sortEnabled = false,
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

  const isExpanded = useCallback(
    (id: string) => expandedIds?.has(id) ?? false,
    [expandedIds]
  )

  const renderRow = (item: ColumnItem) => {
    const isActive = item.id === activeId
    return (
      <NavigationColumnRow
        key={item.id}
        item={item}
        isActive={isActive}
        draggable={Boolean(onReorder)}
        expanded={isExpanded(item.id)}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand ?? (() => {})}
      />
    )
  }

  return (
    <section
      className="w-full lg:w-[200px] lg:min-w-[180px] h-full shrink-0 surface-card px-1.5 py-1.5 snap-start flex flex-col"
    >
      <div className="flex items-center justify-between px-1 pb-1.5">
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
        <div className="mt-1.5 space-y-1 border-t border-border-hairline px-1 pt-1.5">
          {footer}
        </div>
      )}
    </section>
  )
})

export { NavigationColumn, NavigationColumnRow }
export type { NavigationColumnProps, NavigationColumnRowProps }
