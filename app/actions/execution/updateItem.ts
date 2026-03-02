"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ExecutionItem } from "@/lib/types/db"

export type UpdateExecutionItemResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; item: ExecutionItem }

interface UpdateItemInput {
  id: string
  title: string
}

export async function updateExecutionItem(
  input: UpdateItemInput
): Promise<UpdateExecutionItemResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const title = input.title.trim()
  if (!title) return { status: "ERROR", message: "Item title is required" }

  const { data, error } = await supabase
    .from("execution_items")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select("id, user_id, category_id, series_id, month_start, title, sort_order, deleted_at, created_at, updated_at")
    .single()

  if (error || !data) {
    return { status: "ERROR", message: error?.message ?? "Failed to update item" }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS", item: data as ExecutionItem }
}
