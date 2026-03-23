import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Subject, Subtopic, Task, Topic, TopicParams } from "@/lib/types/db"
import { redirect } from "next/navigation"
import type { SubjectNavItem, TopicTaskItem } from "./subjects-data-table"
import PlannerWizardClient from "./PlannerWizardClient"

type SubjectRow = Pick<Subject, "id" | "name" | "archived" | "sort_order">
type TopicRow = Pick<Topic, "id" | "subject_id" | "name" | "sort_order" | "archived">
type SubtopicRow = Pick<Subtopic, "id" | "topic_id" | "name" | "sort_order">
type TaskRow = Pick<Task, "id" | "topic_id" | "subtopic_id" | "title" | "completed" | "duration_minutes" | "sort_order" | "created_at">
type TopicMetaRow = Pick<TopicParams, "topic_id" | "deadline" | "earliest_start" | "rest_after_days">

export default async function PlannerPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: subjectRows } = await supabase
    .from("subjects")
    .select("id, name, archived, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })

  const subjects = (subjectRows ?? []) as SubjectRow[]

  const subjectIds = subjects.map((subject) => subject.id)

  let topics: TopicRow[] = []
  if (subjectIds.length > 0) {
    const { data: topicRows } = await supabase
      .from("topics")
      .select("id, subject_id, name, sort_order, archived")
      .eq("user_id", user.id)
      .in("subject_id", subjectIds)
      .order("sort_order", { ascending: true })

    topics = (topicRows ?? []) as TopicRow[]
  }

  const topicIds = topics.map((topic) => topic.id)

  let subtopics: SubtopicRow[] = []
  let tasks: TaskRow[] = []
  let topicMetaRows: TopicMetaRow[] = []

  if (topicIds.length > 0) {
    const [{ data: subtopicRows }, { data: taskRows }, { data: topicParamRows }] = await Promise.all([
      supabase
        .from("subtopics")
        .select("id, topic_id, name, sort_order")
        .eq("user_id", user.id)
        .in("topic_id", topicIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("tasks")
        .select("id, topic_id, subtopic_id, title, completed, duration_minutes, sort_order, created_at")
        .eq("user_id", user.id)
        .in("topic_id", topicIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("topic_params")
        .select("topic_id, deadline, earliest_start, rest_after_days")
        .eq("user_id", user.id)
        .in("topic_id", topicIds),
    ])

    subtopics = (subtopicRows ?? []) as SubtopicRow[]
    tasks = (taskRows ?? []) as TaskRow[]
    topicMetaRows = (topicParamRows ?? []) as TopicMetaRow[]
  }

  const topicMetaMap = new Map(topicMetaRows.map((row) => [row.topic_id, row]))

  const subtopicsByTopic = new Map<string, { id: string; name: string }[]>()
  for (const subtopic of subtopics) {
    const list = subtopicsByTopic.get(subtopic.topic_id) ?? []
    list.push({ id: subtopic.id, name: subtopic.name })
    subtopicsByTopic.set(subtopic.topic_id, list)
  }

  const chaptersBySubject = new Map<string, SubjectNavItem["chapters"]>()
  for (const topic of topics) {
    const list = chaptersBySubject.get(topic.subject_id) ?? []
    list.push({
      id: topic.id,
      name: topic.name,
      archived: topic.archived ?? false,
      topics: subtopicsByTopic.get(topic.id) ?? [],
      earliestStart: topicMetaMap.get(topic.id)?.earliest_start ?? null,
      deadline: topicMetaMap.get(topic.id)?.deadline ?? null,
      restAfterDays: topicMetaMap.get(topic.id)?.rest_after_days ?? 0,
    })
    chaptersBySubject.set(topic.subject_id, list)
  }

  const initialSubjects: SubjectNavItem[] = subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    archived: subject.archived,
    chapters: chaptersBySubject.get(subject.id) ?? [],
  }))

  const initialTasksByChapter: Record<string, TopicTaskItem[]> = {}
  for (const task of tasks) {
    if (!task.topic_id) continue

    const list = initialTasksByChapter[task.topic_id] ?? []
    list.push({
      id: task.id,
      topicId: task.topic_id,
      clusterId: task.subtopic_id,
      title: task.title,
      completed: task.completed,
      durationMinutes: task.duration_minutes,
    })
    initialTasksByChapter[task.topic_id] = list
  }

  return (
    <PlannerWizardClient
      initialSubjects={initialSubjects}
      initialTasksByChapter={initialTasksByChapter}
    />
  )
}
