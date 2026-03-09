"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface SubjectInput {
  id?: string
  name: string
  sort_order: number
  topics: TopicInput[]
}

interface TopicInput {
  id?: string
  name: string
  sort_order: number
  subtopics: SubtopicInput[]
}

interface SubtopicInput {
  id?: string
  name: string
  sort_order: number
}

export type SaveStructureResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "ERROR"; message: string }
  | { status: "SUCCESS" }

export async function saveStructure(
  subjects: SubjectInput[]
): Promise<SaveStructureResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  // Collect all IDs that should survive (sent from UI)
  const keepSubjectIds = new Set<string>()
  const keepTopicIds = new Set<string>()
  const keepSubtopicIds = new Set<string>()

  for (const subj of subjects) {
    if (subj.id) keepSubjectIds.add(subj.id)
    for (const topic of subj.topics) {
      if (topic.id) keepTopicIds.add(topic.id)
      for (const st of topic.subtopics) {
        if (st.id) keepSubtopicIds.add(st.id)
      }
    }
  }

  // ── Delete removed items ──────────────────────────────────────────────────
  // 1. Archive subjects the user removed
  const { data: existingSubjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .eq("archived", false)

  for (const s of existingSubjects ?? []) {
    if (!keepSubjectIds.has(s.id)) {
      await supabase
        .from("subjects")
        .update({ archived: true })
        .eq("id", s.id)
        .eq("user_id", user.id)
    }
  }

  // 2. Delete topics that were removed
  const existingSubjectIds = (existingSubjects ?? []).map((s) => s.id)
  if (existingSubjectIds.length > 0) {
    const { data: existingTopics } = await supabase
      .from("topics")
      .select("id")
      .eq("user_id", user.id)
      .in("subject_id", existingSubjectIds)

    for (const t of existingTopics ?? []) {
      if (!keepTopicIds.has(t.id)) {
        // Delete subtopics of this topic first
        await supabase
          .from("subtopics")
          .delete()
          .eq("topic_id", t.id)
          .eq("user_id", user.id)
        // Delete topic_params
        await supabase
          .from("topic_params")
          .delete()
          .eq("topic_id", t.id)
          .eq("user_id", user.id)
        // Delete the topic
        await supabase
          .from("topics")
          .delete()
          .eq("id", t.id)
          .eq("user_id", user.id)
      }
    }

    // 3. Delete subtopics that were removed (but topic still exists)
    const survivingTopicIds = Array.from(keepTopicIds)
    if (survivingTopicIds.length > 0) {
      const { data: existingSubtopics } = await supabase
        .from("subtopics")
        .select("id")
        .eq("user_id", user.id)
        .in("topic_id", survivingTopicIds)

      for (const st of existingSubtopics ?? []) {
        if (!keepSubtopicIds.has(st.id)) {
          await supabase
            .from("subtopics")
            .delete()
            .eq("id", st.id)
            .eq("user_id", user.id)
        }
      }
    }
  }

  // ── Upsert surviving / new items ──────────────────────────────────────────
  for (const subj of subjects) {
    if (!subj.name.trim()) {
      return { status: "ERROR", message: "Subject name is required." }
    }

    let subjectId = subj.id

    if (subjectId) {
      const { error } = await supabase
        .from("subjects")
        .update({ name: subj.name.trim(), sort_order: subj.sort_order })
        .eq("id", subjectId)
        .eq("user_id", user.id)
      if (error) return { status: "ERROR", message: error.message }
    } else {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          user_id: user.id,
          name: subj.name.trim(),
          sort_order: subj.sort_order,
          archived: false,
        })
        .select("id")
        .single()
      if (error || !data) return { status: "ERROR", message: error?.message ?? "Failed to create subject" }
      subjectId = data.id
    }

    for (const topic of subj.topics) {
      if (!topic.name.trim()) {
        return { status: "ERROR", message: "Topic name is required." }
      }

      let topicId = topic.id

      if (topicId) {
        const { error } = await supabase
          .from("topics")
          .update({ name: topic.name.trim(), sort_order: topic.sort_order })
          .eq("id", topicId)
          .eq("user_id", user.id)
        if (error) return { status: "ERROR", message: error.message }
      } else {
        const { data, error } = await supabase
          .from("topics")
          .insert({
            user_id: user.id,
            subject_id: subjectId,
            name: topic.name.trim(),
            sort_order: topic.sort_order,
          })
          .select("id")
          .single()
        if (error || !data) return { status: "ERROR", message: error?.message ?? "Failed to create topic" }
        topicId = data.id
      }

      for (const st of topic.subtopics) {
        if (!st.name.trim()) continue

        if (st.id) {
          await supabase
            .from("subtopics")
            .update({ name: st.name.trim(), sort_order: st.sort_order })
            .eq("id", st.id)
            .eq("user_id", user.id)
        } else {
          await supabase.from("subtopics").insert({
            user_id: user.id,
            topic_id: topicId,
            name: st.name.trim(),
            sort_order: st.sort_order,
          })
        }
      }
    }
  }

  revalidatePath("/planner")
  return { status: "SUCCESS" }
}
