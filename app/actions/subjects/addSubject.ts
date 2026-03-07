"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface AddSubjectInput {
  name: string
  sort_order?: number
}

export async function addSubject(input: AddSubjectInput) {
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

  const { data, error } = await supabase.from("subjects").insert({
    user_id: user.id,
    name: input.name.trim(),
    sort_order: input.sort_order ?? 0,
    archived: false,
  }).select("id").single()

  if (error) {
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard/subjects")
  return { status: "SUCCESS" as const, id: data.id }
}
