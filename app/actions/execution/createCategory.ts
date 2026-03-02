"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ExecutionCategory } from "@/lib/types/db"

export type CreateExecutionCategoryResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; category: ExecutionCategory }

interface CreateCategoryInput {
  month_start: string
  name: string
}

export async function createExecutionCategory(
  input: CreateCategoryInput
): Promise<CreateExecutionCategoryResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const name = input.name.trim()
  if (!name) return { status: "ERROR", message: "Category name is required" }

  const { data: lastCategory } = await supabase
    .from("execution_categories")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("month_start", input.month_start)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (lastCategory?.sort_order ?? 0) + 1

  const { data, error } = await supabase
    .from("execution_categories")
    .insert({
      user_id: user.id,
      month_start: input.month_start,
      name,
      sort_order: sortOrder
    })
    .select("id, user_id, month_start, name, sort_order, deleted_at, created_at, updated_at")
    .single()

  if (error || !data) {
    return { status: "ERROR", message: error?.message ?? "Failed to create category" }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS", category: data as ExecutionCategory }
}
