"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ReorderExecutionItemsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

interface ReorderItemsInput {
  category_id: string
  ordered_item_ids: string[]
}

export async function reorderExecutionItems(
  input: ReorderItemsInput
): Promise<ReorderExecutionItemsResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  if (input.ordered_item_ids.length === 0) {
    return { status: "ERROR", message: "No items to reorder" }
  }

  const { data: items } = await supabase
    .from("execution_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", input.category_id)
    .in("id", input.ordered_item_ids)

  if (!items || items.length !== input.ordered_item_ids.length) {
    return { status: "ERROR", message: "Invalid items for reorder" }
  }

  const updates = input.ordered_item_ids.map((id, index) =>
    supabase
      .from("execution_items")
      .update({ sort_order: index + 1, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
  )

  const results = await Promise.all(updates)
  const failed = results.find(result => result.error)
  if (failed?.error) {
    return { status: "ERROR", message: failed.error.message }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS" }
}
