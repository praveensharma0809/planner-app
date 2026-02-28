"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

export interface SubjectProgress {
  id: string
  name: string
  total_items: number
  completed_items: number
  deadline: string
  priority: number
  mandatory: boolean
  /** 0–100 */
  percent: number
  /** days until deadline (negative = overdue) */
  daysLeft: number
  /** "on_track" | "behind" | "at_risk" | "overdue" */
  health: "on_track" | "behind" | "at_risk" | "overdue"
}

export type GetSubjectProgressResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; subjects: SubjectProgress[] }

export async function getSubjectProgress(): Promise<GetSubjectProgressResponse> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "UNAUTHORIZED" }
  }

  const { data } = await supabase
    .from("subjects")
    .select("id, name, total_items, completed_items, deadline, priority, mandatory")
    .eq("user_id", user.id)
    .order("deadline", { ascending: true })

  if (!data || data.length === 0) {
    return { status: "SUCCESS", subjects: [] }
  }

  const todayMs = new Date().setHours(0, 0, 0, 0)

  const subjects: SubjectProgress[] = data.map((s) => {
    const percent =
      s.total_items === 0 ? 100 : Math.round((s.completed_items / s.total_items) * 100)

    const deadlineMs = new Date(s.deadline + "T23:59:59").getTime()
    const daysLeft = Math.ceil((deadlineMs - todayMs) / 86_400_000)

    // Health logic:
    // overdue: past deadline and not 100%
    // at_risk: ≤3 days left and < 80% done
    // behind: ≤7 days left and < 60% done, OR progress is very low relative to time spent
    // on_track: everything else
    let health: SubjectProgress["health"] = "on_track"
    if (daysLeft < 0 && percent < 100) {
      health = "overdue"
    } else if (daysLeft <= 3 && percent < 80) {
      health = "at_risk"
    } else if (daysLeft <= 7 && percent < 60) {
      health = "behind"
    }

    return {
      id: s.id,
      name: s.name,
      total_items: s.total_items,
      completed_items: s.completed_items,
      deadline: s.deadline,
      priority: s.priority,
      mandatory: s.mandatory,
      percent,
      daysLeft,
      health,
    }
  })

  return { status: "SUCCESS", subjects }
}
