"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Subtopic } from "@/lib/types/db"

// ── GET ──────────────────────────────────────────────────

export type GetSubtopicsResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; subtopics: Subtopic[] }

export async function getSubtopics(topicId: string): Promise<GetSubtopicsResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "UNAUTHORIZED" }

    const { data, error } = await supabase
      .from("subtopics")
      .select("id, user_id, topic_id, name, sort_order, created_at")
      .eq("topic_id", topicId)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })

    if (error) return { status: "SUCCESS", subtopics: [] }

    return { status: "SUCCESS", subtopics: (data ?? []) as Subtopic[] }
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
  topicId: string,
  name: string
): Promise<AddSubtopicResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: "UNAUTHORIZED" }

    if (!name.trim()) return { status: "ERROR", message: "Name is required" }

    // Verify topic ownership
    const { data: topic } = await supabase
      .from("topics")
      .select("id")
      .eq("id", topicId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!topic) return { status: "ERROR", message: "Topic not found" }

    // Get next sort_order
    const { data: existing } = await supabase
      .from("subtopics")
      .select("sort_order")
      .eq("topic_id", topicId)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

    const { data: created, error } = await supabase
      .from("subtopics")
      .insert({
        user_id: user.id,
        topic_id: topicId,
        name: name.trim(),
        sort_order: nextOrder,
      })
      .select("id, user_id, topic_id, name, sort_order, created_at")
      .single()

    if (error || !created) {
      return { status: "ERROR", message: error?.message ?? "Failed to create subtopic" }
    }

    revalidatePath("/dashboard/subjects")
    return { status: "SUCCESS", subtopic: created as Subtopic }
  } catch {
    return { status: "ERROR", message: "Failed to create subtopic." }
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
