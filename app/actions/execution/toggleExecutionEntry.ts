"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ToggleExecutionEntryResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; completed: boolean }

interface ToggleExecutionEntryInput {
  item_id: string
  entry_date: string
  completed: boolean
}

function parseMonthEnd(monthStartISO: string) {
  const [year, month] = monthStartISO.split("-").map(Number)
  const monthEnd = new Date(Date.UTC(year, month, 0))
  return monthEnd.toISOString().split("T")[0]
}

export async function toggleExecutionEntry(
  input: ToggleExecutionEntryInput
): Promise<ToggleExecutionEntryResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.entry_date)) {
    return { status: "ERROR", message: "Invalid date" }
  }

  const { data: item, error: itemError } = await supabase
    .from("execution_items")
    .select("id, month_start, deleted_at")
    .eq("id", input.item_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (itemError || !item) {
    return { status: "ERROR", message: "Item not found" }
  }

  if (item.deleted_at) {
    return { status: "ERROR", message: "Item is deleted" }
  }

  const monthStart = item.month_start
  const monthEnd = parseMonthEnd(monthStart)

  if (input.entry_date < monthStart || input.entry_date > monthEnd) {
    return { status: "ERROR", message: "Date is outside the month" }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("execution_entries")
    .upsert(
      {
        user_id: user.id,
        item_id: input.item_id,
        entry_date: input.entry_date,
        completed: input.completed,
        updated_at: now
      },
      { onConflict: "user_id,item_id,entry_date" }
    )

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS", completed: input.completed }
}
