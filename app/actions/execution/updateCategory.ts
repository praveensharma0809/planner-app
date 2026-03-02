"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ExecutionCategory } from "@/lib/types/db"

export type UpdateExecutionCategoryResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; category: ExecutionCategory }

interface UpdateCategoryInput {
  id: string
  name: string
}

export async function updateExecutionCategory(
  input: UpdateCategoryInput
): Promise<UpdateExecutionCategoryResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const name = input.name.trim()
  if (!name) return { status: "ERROR", message: "Category name is required" }

  const { data, error } = await supabase
    .from("execution_categories")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select("id, user_id, month_start, name, sort_order, deleted_at, created_at, updated_at")
    .single()

  if (error || !data) {
    return { status: "ERROR", message: error?.message ?? "Failed to update category" }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS", category: data as ExecutionCategory }
}
