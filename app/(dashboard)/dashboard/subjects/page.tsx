import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Subject, Subtopic, Task, Topic } from "@/lib/types/db"
import { redirect } from "next/navigation"
import {
  SubjectsDataTable,
  type SubjectNavItem,
  type TopicTaskItem,
} from "./subjects-data-table"

type SubjectRow = Pick<Subject, "id" | "name" | "archived" | "sort_order">
type TopicRow = Pick<Topic, "id" | "subject_id" | "name" | "sort_order" | "archived">
type SubtopicRow = Pick<Subtopic, "id" | "topic_id" | "name" | "sort_order">
type TaskRow = Pick<Task, "id" | "topic_id" | "subtopic_id" | "title" | "completed" | "sort_order" | "created_at">

export default async function SubjectsPage() {
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
  if (subjects.length === 0) {
    return <SubjectsDataTable initialSubjects={[]} initialTasksByChapter={{}} />
  }

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

  if (topicIds.length > 0) {
    const [{ data: subtopicRows }, { data: taskRows }] = await Promise.all([
      supabase
        .from("subtopics")
        .select("id, topic_id, name, sort_order")
        .eq("user_id", user.id)
        .in("topic_id", topicIds)
        .order("sort_order", { ascending: true }),
      supabase
        .from("tasks")
        .select("id, topic_id, subtopic_id, title, completed, sort_order, created_at")
        .eq("user_id", user.id)
        .in("topic_id", topicIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ])

    subtopics = (subtopicRows ?? []) as SubtopicRow[]
    tasks = (taskRows ?? []) as TaskRow[]
  }

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
    })
    initialTasksByChapter[task.topic_id] = list
  }

  return (
    <SubjectsDataTable
      initialSubjects={initialSubjects}
      initialTasksByChapter={initialTasksByChapter}
    />
  )
}
