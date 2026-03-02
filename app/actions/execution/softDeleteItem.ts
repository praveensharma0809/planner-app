"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type SoftDeleteExecutionItemResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; deleted_at: string }

export async function softDeleteExecutionItem(itemId: string): Promise<SoftDeleteExecutionItemResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const deletedAt = new Date().toISOString()

  const { error } = await supabase
    .from("execution_items")
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq("id", itemId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS", deleted_at: deletedAt }
}
