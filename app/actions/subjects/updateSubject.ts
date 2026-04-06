"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { isReservedSubjectName } from "@/lib/constants"
import { normalizeOptionalDate } from "@/lib/planner/contracts"

interface UpdateSubjectInput {
  id: string
  name: string
  sort_order?: number
  deadline?: string | null
}

export async function updateSubject(input: UpdateSubjectInput) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { status: "UNAUTHORIZED" as const }
    }

    const subjectName = input.name.trim()

    if (!subjectName) {
      return { status: "ERROR" as const, message: "Subject name is required." }
    }

    if (isReservedSubjectName(subjectName)) {
      return { status: "ERROR" as const, message: "'Others' is reserved for standalone tasks." }
    }

    const deadline = normalizeOptionalDate(input.deadline)

    const { error } = await supabase
      .from("subjects")
      .update({
        name: subjectName,
        sort_order: input.sort_order,
        deadline,
      })
      .eq("id", input.id)
      .eq("user_id", user.id)

    if (error) {
      return { status: "ERROR" as const, message: error.message }
    }

    revalidatePath("/dashboard/subjects")
    revalidatePath("/dashboard")
    revalidatePath("/planner")
    return { status: "SUCCESS" as const }
  } catch (error) {
    return {
      status: "ERROR" as const,
      message: error instanceof Error ? error.message : "Unexpected error",
    }
  }
}
