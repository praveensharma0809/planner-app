"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface UpdateSubjectInput {
  id: string
  name: string
  sort_order?: number
}

export async function updateSubject(input: UpdateSubjectInput) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" as const }
  }

  if (!input.name.trim()) {
    return { status: "ERROR" as const, message: "Subject name is required." }
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      name: input.name.trim(),
      sort_order: input.sort_order,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)

  if (error) {
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard/subjects")
  return { status: "SUCCESS" as const }
}
