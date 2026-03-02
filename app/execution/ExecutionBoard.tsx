"use client"

import { useMemo, useState, useEffect, Fragment } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import { createExecutionCategory } from "@/app/actions/execution/createCategory"
import { createExecutionItem } from "@/app/actions/execution/createItem"
import { reorderExecutionItems } from "@/app/actions/execution/reorderItems"
import { softDeleteExecutionCategory } from "@/app/actions/execution/softDeleteCategory"
import { softDeleteExecutionItem } from "@/app/actions/execution/softDeleteItem"
import { undoDeleteExecutionCategory } from "@/app/actions/execution/undoDeleteCategory"
import { undoDeleteExecutionItem } from "@/app/actions/execution/undoDeleteItem"
import { toggleExecutionEntry } from "@/app/actions/execution/toggleExecutionEntry"
import type { ExecutionMonthData } from "@/app/actions/execution/getExecutionMonth"
import type { ExecutionCategory, ExecutionItem } from "@/lib/types/db"

interface Props {
  data: ExecutionMonthData
}

interface UndoState {
  type: "category" | "item"
  id: string
  deleted_at?: string
  label: string
  timer: number
}

type SortMode = "manual" | "streak" | "percent"

/* ── Geometry ── */
const ROW_NUM_W = 36
const COL_CAT_W = 120
const COL_ITEM_W = 160
const DAY_W = 32
const PCT_W = 44
const STREAK_W = 38
const LETTER_ROW_H = 18
const LABEL_ROW_H = 24
const ROW_H = 24

/* ── Colors ── */
const BG = "#0d0d14"
const GUTTER = "#111120"
const BORDER_CLR = "#252538"
const CAT_ROW_BG = "#101020"
const EVEN_ROW_BG = "#0e0e1a"
const ODD_ROW_BG = BG

function buildMonthDays(monthKey: string, daysInMonth: number) {
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dayISO = `${monthKey}-${String(day).padStart(2, "0")}`
    return { day, dayISO }
  })
}

function colLetter(index: number): string {
  let s = "", n = index
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 }
  return s
}

/* neutral — no accent colours */

export function ExecutionBoard({ data }: Props) {
  const { addToast } = useToast()
  const router = useRouter()
  const [categories, setCategories] = useState<ExecutionCategory[]>(data.categories)
  const [items, setItems] = useState<ExecutionItem[]>(data.items)
  const [entriesSet, setEntriesSet] = useState<Set<string>>(
    () => new Set(data.entries.map(e => `${e.item_id}|${e.entry_date}`))
  )
  const [newCategoryName, setNewCategoryName] = useState("")
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({})
  const [sortMode, setSortMode] = useState<SortMode>("manual")
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)

  // Countdown timer for undo
  useEffect(() => {
    if (!undo) return
    const id = window.setInterval(() => {
      setUndo(prev => {
        if (!prev) return null
        if (prev.timer <= 1) return null
        return { ...prev, timer: prev.timer - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [undo?.id])

  const monthDays = useMemo(
    () => buildMonthDays(data.month_key, data.days_in_month),
    [data.month_key, data.days_in_month]
  )

  const itemMetricMap = useMemo(() => {
    const map = new Map<string, { percent: number; streak: number }>()
    data.item_metrics.forEach(m => {
      map.set(m.item_id, { percent: m.completion_percent, streak: m.streak_current })
    })
    return map
  }, [data.item_metrics])

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ExecutionItem[]>()
    items.forEach(item => {
      const list = map.get(item.category_id) ?? []
      list.push(item)
      map.set(item.category_id, list)
    })
    map.forEach(list => {
      if (sortMode === "manual") {
        list.sort((a, b) => a.sort_order - b.sort_order)
      } else {
        list.sort((a, b) => {
          const am = itemMetricMap.get(a.id)
          const bm = itemMetricMap.get(b.id)
          const av = sortMode === "streak" ? (am?.streak ?? 0) : (am?.percent ?? 0)
          const bv = sortMode === "streak" ? (bm?.streak ?? 0) : (bm?.percent ?? 0)
          return bv - av
        })
      }
    })
    return map
  }, [items, sortMode, itemMetricMap])

  const todayInMonth = data.today_iso.startsWith(data.month_key)
  const todayCompletionCount = useMemo(() => {
    if (!todayInMonth) return 0
    let c = 0
    entriesSet.forEach(k => { if (k.endsWith(`|${data.today_iso}`)) c++ })
    return c
  }, [entriesSet, data.today_iso, todayInMonth])

  const isTodayZero = todayInMonth && todayCompletionCount === 0

  const totalDataCols = 2 + monthDays.length + 2
  const colLetters = useMemo(
    () => Array.from({ length: totalDataCols }, (_, i) => colLetter(i)),
    [totalDataCols]
  )

  /* ── handlers (logic unchanged) ── */

  const handleAddCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    setNewCategoryName("")
    const res = await createExecutionCategory({ month_start: data.month_start, name })
    if (res.status === "SUCCESS") { setCategories(prev => [...prev, res.category]); router.refresh() }
    else if (res.status === "ERROR") addToast(res.message, "error")
    else addToast("Session expired", "error")
  }

  const handleAddItem = async (categoryId: string) => {
    const title = (itemDrafts[categoryId] ?? "").trim()
    if (!title) return
    setItemDrafts(prev => ({ ...prev, [categoryId]: "" }))
    const res = await createExecutionItem({ category_id: categoryId, month_start: data.month_start, title })
    if (res.status === "SUCCESS") { setItems(prev => [...prev, res.item]); router.refresh() }
    else if (res.status === "ERROR") addToast(res.message, "error")
    else addToast("Session expired", "error")
  }

  const handleToggleEntry = async (itemId: string, dateISO: string) => {
    const key = `${itemId}|${dateISO}`
    const wasChecked = entriesSet.has(key)
    setEntriesSet(prev => { const n = new Set(prev); wasChecked ? n.delete(key) : n.add(key); return n })
    const res = await toggleExecutionEntry({ item_id: itemId, entry_date: dateISO, completed: !wasChecked })
    if (res.status !== "SUCCESS") {
      setEntriesSet(prev => { const n = new Set(prev); wasChecked ? n.add(key) : n.delete(key); return n })
      addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
      return
    }
    router.refresh()
  }

  const handleDeleteItem = async (itemId: string, label: string) => {
    const res = await softDeleteExecutionItem(itemId)
    if (res.status === "SUCCESS") { setItems(prev => prev.filter(i => i.id !== itemId)); setUndo({ type: "item", id: itemId, label, timer: 8 }); return }
    addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
  }

  const handleDeleteCategory = async (categoryId: string, label: string) => {
    const res = await softDeleteExecutionCategory(categoryId)
    if (res.status === "SUCCESS") {
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      setItems(prev => prev.filter(i => i.category_id !== categoryId))
      setUndo({ type: "category", id: categoryId, deleted_at: res.deleted_at, label, timer: 8 })
      return
    }
    addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
  }

  const handleUndo = async () => {
    if (!undo) return
    if (undo.type === "category") {
      const res = await undoDeleteExecutionCategory({ category_id: undo.id, deleted_at: undo.deleted_at ?? "" })
      if (res.status === "SUCCESS") { setUndo(null); router.refresh(); return }
      addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
      return
    }
    const res = await undoDeleteExecutionItem(undo.id)
    if (res.status === "SUCCESS") { setUndo(null); router.refresh(); return }
    addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
  }

  const handleDragStart = (itemId: string) => { if (sortMode === "manual") setDragItemId(itemId) }

  const handleDrop = async (categoryId: string, targetItemId: string) => {
    setDragOverId(null)
    if (sortMode !== "manual" || !dragItemId || dragItemId === targetItemId) return
    const list = (itemsByCategory.get(categoryId) ?? []).map(i => i.id)
    const from = list.indexOf(dragItemId)
    const to = list.indexOf(targetItemId)
    if (from === -1 || to === -1) return
    const updated = [...list]; updated.splice(from, 1); updated.splice(to, 0, dragItemId)
    setItems(prev => prev.map(item => {
      if (item.category_id !== categoryId) return item
      const idx = updated.indexOf(item.id)
      return idx === -1 ? item : { ...item, sort_order: idx + 1 }
    }))
    const res = await reorderExecutionItems({ category_id: categoryId, ordered_item_ids: updated })
    if (res.status !== "SUCCESS") { addToast(res.status === "ERROR" ? res.message : "Session expired", "error"); router.refresh() }
  }

  /* ── Shared styles ── */
  const BD = { border: `1px solid ${BORDER_CLR}` }

  return (
    <div className="flex flex-col h-full" style={{ background: BG }}>
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 h-7 px-2" style={{ background: GUTTER, borderBottom: `1px solid ${BORDER_CLR}` }}>
        <input
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory() } }}
          placeholder="+ Category"
          className="w-32 px-1.5 py-0.5 bg-transparent text-[11px] focus:outline-none"
          style={{ border: `1px solid ${BORDER_CLR}`, color: "rgba(255,255,255,0.5)" }}
        />
        <button onClick={handleAddCategory} className="hover:text-white/60" style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Add</button>
        <div className="flex-1" />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>{items.length}/50</span>
        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value as SortMode)}
          className="bg-transparent focus:outline-none"
          style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", border: `1px solid ${BORDER_CLR}`, padding: "1px 4px" }}
        >
          <option value="manual">Manual</option>
          <option value="streak">Sort: streak</option>
          <option value="percent">Sort: %</option>
        </select>
      </div>

      {/* Sheet scroll area */}
      <div className="flex-1 min-h-0 overflow-auto" style={{ background: BG }}>
        <table className="border-collapse min-w-max" style={{ background: BG, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" }}>
          <thead>
            {/* Column letters row */}
            <tr>
              <th style={{ ...BD, position: "sticky", top: 0, left: 0, zIndex: 50, background: GUTTER, width: ROW_NUM_W, minWidth: ROW_NUM_W, height: LETTER_ROW_H }} />
              <th style={{ ...BD, position: "sticky", top: 0, left: ROW_NUM_W, zIndex: 50, background: GUTTER, width: COL_CAT_W, minWidth: COL_CAT_W, height: LETTER_ROW_H }} className="text-[10px] font-normal text-center">
                <span style={{ color: "rgba(255,255,255,0.22)" }}>{colLetters[0]}</span>
              </th>
              <th style={{ ...BD, position: "sticky", top: 0, left: ROW_NUM_W + COL_CAT_W, zIndex: 50, background: GUTTER, width: COL_ITEM_W, minWidth: COL_ITEM_W, height: LETTER_ROW_H }} className="text-[10px] font-normal text-center">
                <span style={{ color: "rgba(255,255,255,0.22)" }}>{colLetters[1]}</span>
              </th>
              {monthDays.map((_, i) => (
                <th key={`lt-${i}`} style={{ ...BD, position: "sticky", top: 0, zIndex: 40, background: GUTTER, width: DAY_W, minWidth: DAY_W, height: LETTER_ROW_H }} className="text-[10px] font-normal text-center">
                  <span style={{ color: "rgba(255,255,255,0.22)" }}>{colLetters[2 + i]}</span>
                </th>
              ))}
              <th style={{ ...BD, position: "sticky", top: 0, zIndex: 40, background: GUTTER, width: PCT_W, minWidth: PCT_W, height: LETTER_ROW_H }} className="text-[10px] font-normal text-center">
                <span style={{ color: "rgba(255,255,255,0.22)" }}>{colLetters[2 + monthDays.length]}</span>
              </th>
              <th style={{ ...BD, position: "sticky", top: 0, zIndex: 40, background: GUTTER, width: STREAK_W, minWidth: STREAK_W, height: LETTER_ROW_H }} className="text-[10px] font-normal text-center">
                <span style={{ color: "rgba(255,255,255,0.22)" }}>{colLetters[3 + monthDays.length]}</span>
              </th>
            </tr>
            {/* Labels row */}
            <tr>
              <th style={{ ...BD, position: "sticky", top: LETTER_ROW_H, left: 0, zIndex: 50, background: GUTTER, width: ROW_NUM_W, height: LABEL_ROW_H }} />
              <th style={{ ...BD, position: "sticky", top: LETTER_ROW_H, left: ROW_NUM_W, zIndex: 50, background: GUTTER, width: COL_CAT_W, height: LABEL_ROW_H }} className="text-[11px] font-normal text-left px-2 whitespace-nowrap">
                <span style={{ color: "rgba(255,255,255,0.45)" }}>Category</span>
              </th>
              <th style={{ ...BD, position: "sticky", top: LETTER_ROW_H, left: ROW_NUM_W + COL_CAT_W, zIndex: 50, background: GUTTER, width: COL_ITEM_W, height: LABEL_ROW_H }} className="text-[11px] font-normal text-left px-2 whitespace-nowrap">
                <span style={{ color: "rgba(255,255,255,0.45)" }}>Item</span>
              </th>
              {monthDays.map(d => {
                const isToday = d.dayISO === data.today_iso
                const todayBg = isToday && isTodayZero ? "rgba(239,68,68,0.12)" : isToday ? "rgba(59,130,246,0.08)" : GUTTER
                const todayClr = isToday && isTodayZero ? "rgba(252,165,165,0.9)" : isToday ? "rgba(147,197,253,0.9)" : "rgba(255,255,255,0.4)"
                return (
                  <th key={`lb-${d.dayISO}`} style={{ ...BD, position: "sticky", top: LETTER_ROW_H, zIndex: 40, background: todayBg, width: DAY_W, height: LABEL_ROW_H }} className="text-[11px] font-normal text-center">
                    <span style={{ color: todayClr }}>{d.day}</span>
                  </th>
                )
              })}
              <th style={{ ...BD, position: "sticky", top: LETTER_ROW_H, zIndex: 40, background: GUTTER, width: PCT_W, height: LABEL_ROW_H }} className="text-[11px] font-normal text-center">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>%</span>
              </th>
              <th style={{ ...BD, position: "sticky", top: LETTER_ROW_H, zIndex: 40, background: GUTTER, width: STREAK_W, height: LABEL_ROW_H }} className="text-[11px] font-normal text-center">
                <span style={{ color: "rgba(255,255,255,0.4)" }}>🔥</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td style={{ ...BD, background: GUTTER, width: ROW_NUM_W }} className="text-center text-[10px]"><span style={{ color: "rgba(255,255,255,0.15)" }}>1</span></td>
                <td colSpan={totalDataCols} style={BD} className="px-3 py-3 text-center text-[11px]"><span style={{ color: "rgba(255,255,255,0.25)" }}>No categories yet &mdash; type a name in the toolbar above.</span></td>
              </tr>
            )}

            {(() => {
              let rn = 0
              return categories.map((cat) => {
                const catItems = itemsByCategory.get(cat.id) ?? []
                return (
                  <Fragment key={cat.id}>
                    {(() => { rn++; const n = rn; return (
                      <tr>
                        <td style={{ ...BD, position: "sticky", left: 0, zIndex: 20, background: GUTTER, width: ROW_NUM_W, height: ROW_H }} className="text-center text-[10px]">
                          <span style={{ color: "rgba(255,255,255,0.18)" }}>{n}</span>
                        </td>
                        <td style={{ ...BD, position: "sticky", left: ROW_NUM_W, zIndex: 20, width: COL_CAT_W, height: ROW_H, background: CAT_ROW_BG }} className="px-2 text-[11px] font-normal whitespace-nowrap">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{cat.name}</span>
                            <button onClick={() => handleDeleteCategory(cat.id, cat.name)} style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }} className="shrink-0" title="Delete category"
                              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.15)")}>×</button>
                          </div>
                        </td>
                        <td style={{ ...BD, position: "sticky", left: ROW_NUM_W + COL_CAT_W, zIndex: 20, width: COL_ITEM_W, height: ROW_H, background: CAT_ROW_BG }} className="px-1">
                          <input
                            value={itemDrafts[cat.id] ?? ""}
                            onChange={e => setItemDrafts(prev => ({ ...prev, [cat.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddItem(cat.id) } }}
                            placeholder="+ add item..."
                            className="w-full px-1 py-0 bg-transparent text-[11px] focus:outline-none"
                            style={{ color: "rgba(255,255,255,0.45)", height: 22 }}
                          />
                        </td>
                        {monthDays.map(d => (
                          <td key={`${cat.id}-h-${d.day}`} style={{ ...BD, width: DAY_W, height: ROW_H, background: CAT_ROW_BG }} />
                        ))}
                        <td style={{ ...BD, width: PCT_W, height: ROW_H, background: CAT_ROW_BG }} />
                        <td style={{ ...BD, width: STREAK_W, height: ROW_H, background: CAT_ROW_BG }} />
                      </tr>
                    )})()}

                    {catItems.map((item, itemIdx) => {
                      rn++; const n = rn
                      const metric = itemMetricMap.get(item.id)
                      const rowCompletion = monthDays.length > 0
                        ? Math.round((monthDays.filter(d => entriesSet.has(`${item.id}|${d.dayISO}`)).length / monthDays.length) * 100)
                        : 0
                      const rowBg = itemIdx % 2 === 0 ? EVEN_ROW_BG : ODD_ROW_BG
                      const stickyItemBg = itemIdx % 2 === 0 ? EVEN_ROW_BG : ODD_ROW_BG
                      const isDragOver = dragOverId === item.id
                      return (
                        <tr
                          key={item.id}
                          className={isDragOver ? "outline outline-1 outline-blue-500/30" : ""}
                          draggable={sortMode === "manual"}
                          onDragStart={() => handleDragStart(item.id)}
                          onDragOver={e => { if (sortMode === "manual") { e.preventDefault(); setDragOverId(item.id) } }}
                          onDragLeave={() => setDragOverId(null)}
                          onDrop={() => handleDrop(cat.id, item.id)}
                          onDragEnd={() => { setDragItemId(null); setDragOverId(null) }}
                        >
                          <td style={{ ...BD, position: "sticky", left: 0, zIndex: 20, background: GUTTER, width: ROW_NUM_W, height: ROW_H }} className="text-center text-[10px]">
                            <span style={{ color: "rgba(255,255,255,0.18)" }}>{n}</span>
                          </td>
                          <td style={{ ...BD, position: "sticky", left: ROW_NUM_W, zIndex: 20, width: COL_CAT_W, height: ROW_H, background: stickyItemBg }} className="px-2">
                            <div className="flex items-center justify-end">
                              <button onClick={() => handleDeleteItem(item.id, item.title)} style={{ color: "rgba(255,255,255,0.1)", fontSize: 10 }} title="Delete item"
                                onMouseEnter={e => (e.currentTarget.style.color = "#f87171")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.1)")}>×</button>
                            </div>
                          </td>
                          <td style={{ ...BD, position: "sticky", left: ROW_NUM_W + COL_CAT_W, zIndex: 20, width: COL_ITEM_W, height: ROW_H, background: stickyItemBg }} className="px-2">
                            <div className="flex items-center gap-1">
                              {sortMode === "manual" && <span className="cursor-grab select-none" style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>⠿</span>}
                              <span className="truncate leading-none" style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{item.title}</span>
                            </div>
                          </td>
                          {monthDays.map(d => {
                            const checked = entriesSet.has(`${item.id}|${d.dayISO}`)
                            const isToday = d.dayISO === data.today_iso
                            let cellBg = rowBg
                            if (isToday && isTodayZero) cellBg = "rgba(239,68,68,0.06)"
                            else if (isToday) cellBg = "rgba(59,130,246,0.04)"
                            return (
                              <td key={d.dayISO} style={{ ...BD, width: DAY_W, height: ROW_H, background: cellBg }} className="text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleEntry(item.id, d.dayISO)}
                                  aria-label={`${item.title} ${d.dayISO}`}
                                  style={{ width: 12, height: 12, cursor: 'pointer', accentColor: '#34d399', display: 'block', margin: 'auto' }}
                                />
                              </td>
                            )
                          })}
                          <td style={{ ...BD, width: PCT_W, height: ROW_H, background: rowBg }} className="text-center text-[11px]">
                            <span style={{ color: "rgba(255,255,255,0.4)" }}>{rowCompletion}</span>
                          </td>
                          <td style={{ ...BD, width: STREAK_W, height: ROW_H, background: rowBg }} className="text-center text-[11px]">
                            <span style={{ color: "rgba(255,255,255,0.4)" }}>{metric?.streak ?? 0}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })
            })()}
          </tbody>
        </table>
      </div>

      {/* Floating undo bar */}
      {undo && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-3 py-1 backdrop-blur-sm" style={{ background: "rgba(17,17,32,0.95)", border: `1px solid ${BORDER_CLR}` }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Deleted &quot;{undo.label}&quot;</span>
          <button onClick={handleUndo} style={{ color: "#60a5fa", fontSize: 11 }} className="font-medium hover:text-blue-300">Undo</button>
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>{undo.timer}s</span>
          <button onClick={() => setUndo(null)} style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }} className="hover:text-white/50">×</button>
        </div>
      )}
    </div>
  )
}
