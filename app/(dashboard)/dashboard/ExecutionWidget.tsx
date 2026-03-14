"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import { toggleExecutionEntry } from "@/app/actions/execution/toggleExecutionEntry"
import { createExecutionCategory } from "@/app/actions/execution/createCategory"
import { createExecutionItem } from "@/app/actions/execution/createItem"
import type { ExecutionMonthData } from "@/app/actions/execution/getExecutionMonth"
import type { ExecutionItem } from "@/lib/types/db"
import Link from "next/link"

interface Props {
  data: ExecutionMonthData
}

export function ExecutionWidget({ data }: Props) {
  const { addToast } = useToast()
  const router = useRouter()
  const [entriesSet, setEntriesSet] = useState<Set<string>>(
    () => new Set(data.entries.map(e => `${e.item_id}|${e.entry_date}`))
  )
  const [items, setItems] = useState<ExecutionItem[]>(data.items)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState("")
  const [newCatName, setNewCatName] = useState("")
  const [showAddCat, setShowAddCat] = useState(false)

  const todayISO = data.today_iso
  const isCurrentMonth = todayISO.startsWith(data.month_key)

  // Build last 7 days including today
  const recentDays = useMemo(() => {
    const days: { dayISO: string; label: string; isToday: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayISO + "T12:00:00")
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().split("T")[0]
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" })
      days.push({ dayISO: iso, label: dayName, isToday: i === 0 })
    }
    return days
  }, [todayISO])

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
    map.forEach(list => list.sort((a, b) => a.sort_order - b.sort_order))
    return map
  }, [items])

  const todayCount = useMemo(() => {
    if (!isCurrentMonth) return 0
    let c = 0
    entriesSet.forEach(k => { if (k.endsWith(`|${todayISO}`)) c++ })
    return c
  }, [entriesSet, todayISO, isCurrentMonth])

  const handleToggle = async (itemId: string, dateISO: string) => {
    const key = `${itemId}|${dateISO}`
    const wasChecked = entriesSet.has(key)
    setEntriesSet(prev => {
      const n = new Set(prev)
      if (wasChecked) n.delete(key); else n.add(key)
      return n
    })
    const res = await toggleExecutionEntry({ item_id: itemId, entry_date: dateISO, completed: !wasChecked })
    if (res.status !== "SUCCESS") {
      setEntriesSet(prev => {
        const n = new Set(prev)
        if (wasChecked) n.add(key); else n.delete(key)
        return n
      })
      addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
      return
    }
    router.refresh()
  }

  const handleAddItem = async (categoryId: string) => {
    const title = newItemTitle.trim()
    if (!title) return
    setNewItemTitle("")
    setAddingItem(null)
    const res = await createExecutionItem({ category_id: categoryId, month_start: data.month_start, title })
    if (res.status === "SUCCESS") { setItems(prev => [...prev, res.item]); router.refresh() }
    else addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
  }

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    setNewCatName("")
    setShowAddCat(false)
    const res = await createExecutionCategory({ month_start: data.month_start, name })
    if (res.status === "SUCCESS") router.refresh()
    else addToast(res.status === "ERROR" ? res.message : "Session expired", "error")
  }

  if (data.categories.length === 0 && items.length === 0) {
    return (
      <section className="rounded-xl border border-white/5 bg-transparent p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Daily Habits
          </h2>
          <Link href="/execution" className="text-xs text-white/30 hover:text-white/60 transition-colors">
            Full board &rarr;
          </Link>
        </div>
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-white/35">Track daily habits to build consistency.</p>
          {showAddCat ? (
            <div className="flex gap-2 max-w-xs mx-auto">
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                placeholder="Category name..."
                autoFocus
                className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-white/25 focus:border-indigo-500/30 focus:outline-none"
              />
              <button onClick={handleAddCategory} className="px-3 py-2 bg-emerald-500/20 text-emerald-400 text-sm rounded-lg hover:bg-emerald-500/30 transition-colors">Add</button>
            </div>
          ) : (
            <button onClick={() => setShowAddCat(true)} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              + Create first habit category
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-white/5 bg-transparent p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Daily Habits
          <span className="text-[10px] text-white/20 font-normal ml-1">{todayCount}/{items.length} today</span>
        </h2>
        <Link href="/execution" className="text-xs text-white/30 hover:text-white/60 transition-colors">
          Full board &rarr;
        </Link>
      </div>

      {/* Compact grid: items as rows, last 7 days as columns */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="text-left text-[10px] text-white/25 font-medium uppercase tracking-wider pb-2 pr-3 whitespace-nowrap" style={{ minWidth: 120 }}>Habit</th>
              {recentDays.map(d => (
                <th key={d.dayISO} className={`text-center pb-2 w-8 ${d.isToday ? "text-indigo-400" : "text-white/25"}`}>
                  <div className="text-[10px] font-medium">{d.label}</div>
                  <div className="text-[9px] opacity-50">{d.dayISO.split("-")[2]}</div>
                </th>
              ))}
              <th className="text-center text-[10px] text-white/25 font-medium pb-2 w-9">🔥</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map(cat => (
                <tr key={`cat-${cat.id}`}>
                  <td colSpan={recentDays.length + 2} className="pt-2 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">{cat.name}</span>
                      <button
                        onClick={() => { setAddingItem(cat.id); setNewItemTitle("") }}
                        className="text-[10px] text-white/20 hover:text-emerald-400 transition-colors"
                      >
                        + add
                      </button>
                    </div>
                    {addingItem === cat.id && (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          value={newItemTitle}
                          onChange={e => setNewItemTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleAddItem(cat.id); if (e.key === "Escape") setAddingItem(null) }}
                          placeholder="Habit name..."
                          autoFocus
                          className="px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded text-[11px] text-white placeholder:text-white/20 focus:border-emerald-500/30 focus:outline-none w-36"
                        />
                        <button onClick={() => handleAddItem(cat.id)} className="text-[10px] text-emerald-400">add</button>
                      </div>
                    )}
                  </td>
                </tr>
            ))}
            {data.categories.flatMap(cat => {
              const catItems = itemsByCategory.get(cat.id) ?? []
              return catItems.map(item => {
                const metric = itemMetricMap.get(item.id)
                return (
                  <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-1 pr-3">
                      <span className="text-white/60 truncate block max-w-[140px]">{item.title}</span>
                    </td>
                    {recentDays.map(d => {
                      const checked = entriesSet.has(`${item.id}|${d.dayISO}`)
                      return (
                        <td key={d.dayISO} className="text-center py-1">
                          <button
                            onClick={() => handleToggle(item.id, d.dayISO)}
                            className={`w-5 h-5 rounded transition-all inline-flex items-center justify-center ${
                              checked
                                ? "bg-emerald-500/20 text-emerald-400"
                                : d.isToday
                                  ? "bg-white/[0.04] border border-dashed border-white/10 hover:border-emerald-500/30 text-transparent hover:text-white/20"
                                  : "bg-white/[0.02] text-transparent"
                            }`}
                            aria-label={`${item.title} ${d.dayISO}`}
                          >
                            {checked ? (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            ) : (
                              <span className="text-[8px]">&middot;</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-center py-1">
                      <span className={`text-[11px] font-medium ${(metric?.streak ?? 0) > 0 ? "text-orange-400/70" : "text-white/15"}`}>
                        {metric?.streak ?? 0}
                      </span>
                    </td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>

      {/* Add category button */}
      {showAddCat ? (
        <div className="flex gap-2">
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") setShowAddCat(false) }}
            placeholder="Category name..."
            autoFocus
            className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder:text-white/20 focus:border-emerald-500/30 focus:outline-none flex-1"
          />
          <button onClick={handleAddCategory} className="text-xs text-emerald-400 px-2">Add</button>
          <button onClick={() => setShowAddCat(false)} className="text-xs text-white/20 px-2">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowAddCat(true)} className="text-[11px] text-white/20 hover:text-white/40 transition-colors">
          + Add category
        </button>
      )}
    </section>
  )
}
