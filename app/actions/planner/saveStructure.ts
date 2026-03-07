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
