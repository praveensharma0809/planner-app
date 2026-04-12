import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Subject, Topic, TopicTask } from "@/lib/types/db"
import { redirect } from "next/navigation"
import type { IntakeImportMode } from "@/app/actions/planner/setup"
import type { SubjectNavItem, TopicTaskItem } from "./subjects-data-table"
import PlannerWizardClient from "./PlannerWizardClient"

type SubjectRow = Pick<Subject, "id" | "name" | "archived" | "sort_order">
type TopicRow = Pick<Topic, "id" | "subject_id" | "name" | "sort_order" | "archived" | "earliest_start" | "rest_after_days">
type TaskRow = Pick<TopicTask, "id" | "topic_id" | "title" | "completed" | "duration_minutes" | "sort_order" | "created_at">

export default async function PlannerPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: settingsRow } = await supabase
    .from("planner_settings")
    .select("intake_import_mode")
    .eq("user_id", user.id)
    .maybeSingle()

  const intakeImportMode: IntakeImportMode =
    settingsRow?.intake_import_mode === "undone" ? "undone" : "all"

  const { data: subjectRows } = await supabase
    .from("subjects")
    .select("id, name, archived, sort_order")
    .eq("user_id", user.id)
    .eq("archived", false)
    .not("name", "ilike", "others")
    .not("name", "ilike", "__deprecated_others__")
    .order("sort_order", { ascending: true })

  const subjects = (subjectRows ?? []) as SubjectRow[]

  const subjectIds = subjects.map((subject) => subject.id)

  let topics: TopicRow[] = []
  if (subjectIds.length > 0) {
    const { data: topicRows } = await supabase
      .from("topics")
      .select("id, subject_id, name, sort_order, archived, earliest_start, rest_after_days")
      .eq("user_id", user.id)
      .in("subject_id", subjectIds)
      .eq("archived", false)
      .order("sort_order", { ascending: true })

    topics = (topicRows ?? []) as TopicRow[]
  }

  const topicIds = topics.map((topic) => topic.id)

  let tasks: TaskRow[] = []

  if (topicIds.length > 0) {
    let taskQuery = supabase
      .from("topic_tasks")
      .select("id, topic_id, title, completed, duration_minutes, sort_order, created_at")
      .eq("user_id", user.id)
      .in("topic_id", topicIds)

    if (intakeImportMode === "undone") {
      taskQuery = taskQuery.eq("completed", false)
    }

    const { data: taskRows } = await taskQuery
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    tasks = (taskRows ?? []) as TaskRow[]
  }

  const chaptersBySubject = new Map<string, SubjectNavItem["chapters"]>()
  const topicHasTasks = new Set(tasks.map((task) => task.topic_id).filter(Boolean))

  for (const topic of topics) {
    if (intakeImportMode === "undone" && !topicHasTasks.has(topic.id)) {
      continue
    }

    const list = chaptersBySubject.get(topic.subject_id) ?? []
    list.push({
      id: topic.id,
      name: topic.name,
      archived: topic.archived ?? false,
      topics: [],
      earliestStart: topic.earliest_start ?? null,
      deadline: null,
      restAfterDays: topic.rest_after_days ?? 0,
    })
    chaptersBySubject.set(topic.subject_id, list)
  }

  const initialSubjects: SubjectNavItem[] = subjects
    .map((subject) => ({
      id: subject.id,
      name: subject.name,
      archived: subject.archived,
      chapters: chaptersBySubject.get(subject.id) ?? [],
    }))
    .filter((subject) => intakeImportMode !== "undone" || subject.chapters.length > 0)

  const initialTasksByChapter: Record<string, TopicTaskItem[]> = {}
  for (const task of tasks) {
    if (!task.topic_id) continue

    const list = initialTasksByChapter[task.topic_id] ?? []
    list.push({
      id: task.id,
      topicId: task.topic_id,
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
      initialImportMode={intakeImportMode}
    />
  )
}
