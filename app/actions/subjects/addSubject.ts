"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { isISODate, normalizeOptionalDate } from "@/lib/planner/contracts"

interface AddSubjectInput {
  name: string
  sort_order?: number
  deadline?: string | null
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
  if (deadline && !isISODate(deadline)) {
    return { status: "ERROR" as const, message: "Deadline must be a valid date." }
  }

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
