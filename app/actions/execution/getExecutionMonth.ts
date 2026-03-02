"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ExecutionCategory, ExecutionEntry, ExecutionItem } from "@/lib/types/db"

export interface ExecutionItemMetric {
  item_id: string
  completion_percent: number
  streak_current: number
}

export interface ExecutionGlobalMetrics {
  global_streak: number
  monthly_completion_percent: number
  today_completion_count: number
}

export interface ExecutionMonthData {
  month_start: string
  month_end: string
  month_label: string
  month_key: string
  days_in_month: number
  is_past_month: boolean
  today_iso: string
  categories: ExecutionCategory[]
  items: ExecutionItem[]
  entries: ExecutionEntry[]
  item_metrics: ExecutionItemMetric[]
  global_metrics: ExecutionGlobalMetrics
}

export type GetExecutionMonthResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; data: ExecutionMonthData }

interface MonthMeta {
  monthStartISO: string
  monthEndISO: string
  monthKey: string
  monthLabel: string
  daysInMonth: number
}

function toISODate(date: Date) {
  return date.toISOString().split("T")[0]
}

function buildMonthMeta(monthKey?: string): MonthMeta {
  const now = new Date()
  let year = now.getUTCFullYear()
  let month = now.getUTCMonth() + 1

  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const [y, m] = monthKey.split("-").map(Number)
    if (y >= 1970 && m >= 1 && m <= 12) {
      year = y
      month = m
    }
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0))
  const monthStartISO = toISODate(monthStart)
  const monthEndISO = toISODate(monthEnd)
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const monthKeyResolved = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`

  return {
    monthStartISO,
    monthEndISO,
    monthKey: monthKeyResolved,
    monthLabel,
    daysInMonth: monthEnd.getUTCDate()
  }
}

function calculateCurrentStreak(completedDates: Set<string>, todayISO: string) {
  let streak = 0
  const cursor = new Date(todayISO + "T12:00:00")
  while (true) {
    const iso = toISODate(cursor)
    if (!completedDates.has(iso)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

async function cloneMonthStructure(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  monthStartISO: string
) {
  const { data: prevMonthRows } = await supabase
    .from("execution_categories")
    .select("month_start")
    .eq("user_id", userId)
    .lt("month_start", monthStartISO)
    .order("month_start", { ascending: false })
    .limit(1)

  const prevMonthStart = prevMonthRows?.[0]?.month_start
  if (!prevMonthStart) return

  const { data: prevCategories } = await supabase
    .from("execution_categories")
    .select("id, name, sort_order")
    .eq("user_id", userId)
    .eq("month_start", prevMonthStart)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (!prevCategories || prevCategories.length === 0) return

  const { data: newCategories, error: catError } = await supabase
    .from("execution_categories")
    .insert(
      prevCategories.map(category => ({
        user_id: userId,
        month_start: monthStartISO,
        name: category.name,
        sort_order: category.sort_order,
      }))
    )
    .select("id, name, sort_order, month_start, user_id, deleted_at, created_at, updated_at")

  if (catError || !newCategories) return

  const categoryMap = new Map<string, string>()
  prevCategories.forEach((category, index) => {
    const newCategory = newCategories[index]
    if (newCategory) categoryMap.set(category.id, newCategory.id)
  })

  const { data: prevItems } = await supabase
    .from("execution_items")
    .select("category_id, title, sort_order, series_id")
    .eq("user_id", userId)
    .eq("month_start", prevMonthStart)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (!prevItems || prevItems.length === 0) return

  const itemsToInsert = prevItems
    .map(item => {
      const newCategoryId = categoryMap.get(item.category_id)
      if (!newCategoryId) return null
      return {
        user_id: userId,
        category_id: newCategoryId,
        month_start: monthStartISO,
        series_id: item.series_id,
        title: item.title,
        sort_order: item.sort_order,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (itemsToInsert.length > 0) {
    await supabase.from("execution_items").insert(itemsToInsert)
  }
}

export async function getExecutionMonth(monthKey?: string): Promise<GetExecutionMonthResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { monthStartISO, monthEndISO, monthKey: resolvedKey, monthLabel, daysInMonth } = buildMonthMeta(monthKey)
  const todayISO = toISODate(new Date())

  const { data: existingCategories } = await supabase
    .from("execution_categories")
    .select("id")
    .eq("user_id", user.id)
    .eq("month_start", monthStartISO)
    .limit(1)

  if (!existingCategories || existingCategories.length === 0) {
    await cloneMonthStructure(supabase, user.id, monthStartISO)
  }

  const [categoryRes, itemRes] = await Promise.all([
    supabase
      .from("execution_categories")
      .select("id, user_id, month_start, name, sort_order, deleted_at, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("month_start", monthStartISO)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("execution_items")
      .select("id, user_id, category_id, series_id, month_start, title, sort_order, deleted_at, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("month_start", monthStartISO)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
  ])

  const categories = (categoryRes.data ?? []) as ExecutionCategory[]
  const items = (itemRes.data ?? []) as ExecutionItem[]
  const itemIds = items.map(item => item.id)
  const seriesIds = Array.from(new Set(items.map(item => item.series_id)))

  let entries: ExecutionEntry[] = []
  let allEntriesForStreak: Array<Pick<ExecutionEntry, "item_id" | "entry_date">> = []
  const seriesIdByItemId = new Map<string, string>()

  if (itemIds.length > 0) {
    const [entriesRes, seriesItemsRes] = await Promise.all([
      supabase
        .from("execution_entries")
        .select("id, user_id, item_id, entry_date, completed, created_at, updated_at")
        .eq("user_id", user.id)
        .in("item_id", itemIds)
        .gte("entry_date", monthStartISO)
        .lte("entry_date", monthEndISO)
        .eq("completed", true),
      seriesIds.length > 0
        ? supabase
            .from("execution_items")
            .select("id, series_id")
            .eq("user_id", user.id)
            .in("series_id", seriesIds)
        : Promise.resolve({ data: [] })
    ])

    entries = (entriesRes.data ?? []) as ExecutionEntry[]

    const seriesItems = (seriesItemsRes.data ?? []) as Array<Pick<ExecutionItem, "id" | "series_id">>
    const allSeriesItemIds: string[] = []

    seriesItems.forEach(item => {
      seriesIdByItemId.set(item.id, item.series_id)
      allSeriesItemIds.push(item.id)
    })

    if (allSeriesItemIds.length > 0) {
      const { data: streakRes } = await supabase
        .from("execution_entries")
        .select("item_id, entry_date")
        .eq("user_id", user.id)
        .in("item_id", allSeriesItemIds)
        .lte("entry_date", todayISO)
        .eq("completed", true)

      allEntriesForStreak = (streakRes ?? []) as Array<Pick<ExecutionEntry, "item_id" | "entry_date">>
    }
  }

  const monthEntriesByItem = new Map<string, Set<string>>()
  const streakEntriesBySeries = new Map<string, Set<string>>()

  entries.forEach(entry => {
    const set = monthEntriesByItem.get(entry.item_id) ?? new Set<string>()
    set.add(entry.entry_date)
    monthEntriesByItem.set(entry.item_id, set)
  })

  allEntriesForStreak.forEach(entry => {
    const seriesId = seriesIdByItemId.get(entry.item_id)
    if (!seriesId) return
    const set = streakEntriesBySeries.get(seriesId) ?? new Set<string>()
    set.add(entry.entry_date)
    streakEntriesBySeries.set(seriesId, set)
  })

  const itemMetrics: ExecutionItemMetric[] = items.map(item => {
    const monthSet = monthEntriesByItem.get(item.id) ?? new Set<string>()
    const streakSet = streakEntriesBySeries.get(item.series_id) ?? new Set<string>()
    const completionPercent = daysInMonth > 0
      ? Math.round((monthSet.size / daysInMonth) * 100)
      : 0
    const streakCurrent = calculateCurrentStreak(streakSet, todayISO)

    return {
      item_id: item.id,
      completion_percent: completionPercent,
      streak_current: streakCurrent
    }
  })

  const totalMonthlyCompleted = entries.length
  const totalItemSlots = daysInMonth * items.length
  const monthlyCompletionPercent = totalItemSlots > 0
    ? Math.round((totalMonthlyCompleted / totalItemSlots) * 100)
    : 0

  const todayCompletionCount = entries.filter(entry => entry.entry_date === todayISO).length

  const { data: globalDates } = await supabase
    .from("execution_entries")
    .select("entry_date")
    .eq("user_id", user.id)
    .lte("entry_date", todayISO)
    .eq("completed", true)

  const globalDateSet = new Set((globalDates ?? []).map(row => row.entry_date))
  const globalStreak = calculateCurrentStreak(globalDateSet, todayISO)

  const currentMonthStart = toISODate(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)))
  const isPastMonth = monthStartISO < currentMonthStart

  return {
    status: "SUCCESS",
    data: {
      month_start: monthStartISO,
      month_end: monthEndISO,
      month_label: monthLabel,
      month_key: resolvedKey,
      days_in_month: daysInMonth,
      is_past_month: isPastMonth,
      today_iso: todayISO,
      categories,
      items,
      entries,
      item_metrics: itemMetrics,
      global_metrics: {
        global_streak: globalStreak,
        monthly_completion_percent: monthlyCompletionPercent,
        today_completion_count: todayCompletionCount
      }
    }
  }
}
