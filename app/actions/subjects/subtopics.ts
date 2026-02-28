"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Subtopic } from "@/lib/types/db"

// ── GET ──────────────────────────────────────────────────

export type GetSubtopicsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; subtopics: Subtopic[] }

export async function getSubtopics(subjectId: string): Promise<GetSubtopicsResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "UNAUTHORIZED" }

    const { data, error } = await supabase
      .from("subtopics")
      .select("id, user_id, subject_id, name, total_items, completed_items, sort_order, created_at")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })

    // Table may not exist yet — return empty gracefully
    if (error) return { status: "SUCCESS", subtopics: [] }

    return { status: "SUCCESS", subtopics: data ?? [] }
  } catch {
    return { status: "SUCCESS", subtopics: [] }
  }
}

// ── ADD ──────────────────────────────────────────────────

export type AddSubtopicResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS"; subtopic: Subtopic }

export async function addSubtopic(
  subjectId: string,
  name: string,
  totalItems: number
): Promise<AddSubtopicResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "UNAUTHORIZED" }

    if (!name.trim()) return { status: "ERROR", message: "Name is required" }
    if (totalItems < 0) return { status: "ERROR", message: "Items must be non-negative" }

    // Verify subject ownership
    const { data: subject } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", subjectId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!subject) return { status: "ERROR", message: "Subject not found" }

    // Get next sort_order
    const { data: existing } = await supabase
      .from("subtopics")
      .select("sort_order")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

    const { data: created, error } = await supabase
      .from("subtopics")
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        name: name.trim(),
        total_items: totalItems,
        completed_items: 0,
        sort_order: nextOrder,
      })
      .select("id, user_id, subject_id, name, total_items, completed_items, sort_order, created_at")
      .single()

    if (error || !created) {
      // Table may not exist yet
      if (error?.message?.includes("subtopics") || error?.message?.includes("relation")) {
        return { status: "ERROR", message: "Subtopics feature requires a database migration. Please run the latest migration SQL." }
      }
      return { status: "ERROR", message: error?.message ?? "Failed to create subtopic" }
    }

    revalidatePath("/dashboard/subjects")
    return { status: "SUCCESS", subtopic: created }
  } catch {
    return { status: "ERROR", message: "Subtopics feature is not available yet. Please run the database migration." }
  }
}

// ── DELETE ────────────────────────────────────────────────

export type DeleteSubtopicResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function deleteSubtopic(subtopicId: string): Promise<DeleteSubtopicResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "UNAUTHORIZED" }

    const { error } = await supabase
      .from("subtopics")
      .delete()
      .eq("id", subtopicId)
      .eq("user_id", user.id)

    if (error) return { status: "ERROR", message: error.message }

    revalidatePath("/dashboard/subjects")
    return { status: "SUCCESS" }
  } catch {
    return { status: "ERROR", message: "Failed to delete subtopic." }
  }
}
