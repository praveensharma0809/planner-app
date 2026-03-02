"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ExecutionItem } from "@/lib/types/db"

export type CreateExecutionItemResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; item: ExecutionItem }

interface CreateItemInput {
  category_id: string
  month_start: string
  title: string
}

export async function createExecutionItem(
  input: CreateItemInput
): Promise<CreateExecutionItemResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const title = input.title.trim()
  if (!title) return { status: "ERROR", message: "Item title is required" }

  const { count } = await supabase
    .from("execution_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("month_start", input.month_start)
    .is("deleted_at", null)

  if ((count ?? 0) >= 50) {
    return { status: "ERROR", message: "Monthly limit reached (50 items)" }
  }

  const { data: lastItem } = await supabase
    .from("execution_items")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("category_id", input.category_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (lastItem?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from("execution_items")
    .insert({
      user_id: user.id,
      category_id: input.category_id,
      month_start: input.month_start,
      title,
      sort_order: sortOrder
    })
    .select("id, user_id, category_id, series_id, month_start, title, sort_order, deleted_at, created_at, updated_at")
    .single()

  if (error || !data) {
    return { status: "ERROR", message: error?.message ?? "Failed to create item" }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS", item: data as ExecutionItem }
}
