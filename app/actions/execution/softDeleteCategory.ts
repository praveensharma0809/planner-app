"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type SoftDeleteExecutionCategoryResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; deleted_at: string }

export async function softDeleteExecutionCategory(
  categoryId: string
): Promise<SoftDeleteExecutionCategoryResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const deletedAt = new Date().toISOString()

  const { data: activeItems } = await supabase
    .from("execution_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", categoryId)
    .is("deleted_at", null)

  const itemIds = activeItems?.map(item => item.id) ?? []

  const { error: categoryError } = await supabase
    .from("execution_categories")
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq("id", categoryId)
    .eq("user_id", user.id)

  if (categoryError) {
    return { status: "ERROR", message: categoryError.message }
  }

  if (itemIds.length > 0) {
    const { error: itemError } = await supabase
      .from("execution_items")
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .in("id", itemIds)
      .eq("user_id", user.id)

    if (itemError) {
      return { status: "ERROR", message: itemError.message }
    }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS", deleted_at: deletedAt }
}
