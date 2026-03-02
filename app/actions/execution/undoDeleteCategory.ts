"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type UndoDeleteExecutionCategoryResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

interface UndoCategoryInput {
  category_id: string
  deleted_at: string
}

export async function undoDeleteExecutionCategory(
  input: UndoCategoryInput
): Promise<UndoDeleteExecutionCategoryResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { error: categoryError } = await supabase
    .from("execution_categories")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", input.category_id)
    .eq("user_id", user.id)

  if (categoryError) {
    return { status: "ERROR", message: categoryError.message }
  }

  const { error: itemError } = await supabase
    .from("execution_items")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("category_id", input.category_id)
    .eq("deleted_at", input.deleted_at)

  if (itemError) {
    return { status: "ERROR", message: itemError.message }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS" }
}
