"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type UndoDeleteExecutionItemResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function undoDeleteExecutionItem(itemId: string): Promise<UndoDeleteExecutionItemResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { error } = await supabase
    .from("execution_items")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR", message: error.message }
  }

  revalidatePath("/execution")
  return { status: "SUCCESS" }
}
