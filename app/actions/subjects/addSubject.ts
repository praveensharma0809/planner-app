"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface AddSubjectInput {
  name: string
  sort_order?: number
  deadline?: string | null
}

function normalizeOptionalDate(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

  const deadline = normalizeOptionalDate(input.deadline)

  const { data, error } = await supabase.from("subjects").insert({
    user_id: user.id,
    name: input.name.trim(),
    sort_order: input.sort_order ?? 0,
    deadline,
    archived: false,
  }).select("id").single()

  if (error) {
    return { status: "ERROR" as const, message: error.message }
  }

  revalidatePath("/dashboard/subjects")
  revalidatePath("/dashboard")
  revalidatePath("/planner")
  return { status: "SUCCESS" as const, id: data.id }
}
