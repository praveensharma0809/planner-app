"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Subject, Topic, Subtopic } from "@/lib/types/db"

export interface StructureTree {
  subjects: (Subject & { topics: (Topic & { subtopics: Subtopic[] })[] })[]
}

export type GetStructureResponse =
  | { status: "UNAUTHORIZED" }
  | { status: "SUCCESS"; tree: StructureTree }

export async function getStructure(): Promise<GetStructureResponse> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: "UNAUTHORIZED" }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, user_id, name, sort_order, archived, deadline, created_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true })

  if (!subjects) return { status: "SUCCESS", tree: { subjects: [] } }

  const subjectIds = subjects.map((s) => s.id)

  const { data: topics } = await supabase
    .from("topics")
    .select("id, user_id, subject_id, name, sort_order, created_at")
    .eq("user_id", user.id)
    .in("subject_id", subjectIds.length > 0 ? subjectIds : ["__none__"])
    .order("sort_order", { ascending: true })

  const topicIds = (topics ?? []).map((t) => t.id)

  const { data: subtopics } = await supabase
    .from("subtopics")
    .select("id, user_id, topic_id, name, sort_order, created_at")
    .eq("user_id", user.id)
    .in("topic_id", topicIds.length > 0 ? topicIds : ["__none__"])
    .order("sort_order", { ascending: true })

  const subtopicsByTopic = new Map<string, Subtopic[]>()
  for (const st of subtopics ?? []) {
    const list = subtopicsByTopic.get(st.topic_id) ?? []
    list.push(st)
    subtopicsByTopic.set(st.topic_id, list)
  }

  const topicsBySubject = new Map<string, (Topic & { subtopics: Subtopic[] })[]>()
  for (const t of topics ?? []) {
    const list = topicsBySubject.get(t.subject_id) ?? []
    list.push({ ...t, subtopics: subtopicsByTopic.get(t.id) ?? [] })
    topicsBySubject.set(t.subject_id, list)
  }

  const tree: StructureTree = {
    subjects: subjects.map((s) => ({
      ...s,
      topics: topicsBySubject.get(s.id) ?? [],
    })),
  }

  return { status: "SUCCESS", tree }
}
