import { createServerSupabaseClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SubjectsDataTable, type SubjectTableRow } from "./subjects-data-table"

interface SubjectRow {
  id: string
  name: string
  archived: boolean
}

interface TopicRow {
  id: string
  subject_id: string
}

interface TopicParamsRow {
  topic_id: string
  estimated_hours: number
  priority: number
  deadline: string | null
}

interface TaskRow {
  subject_id: string
  completed: boolean
}

export default async function SubjectsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: subjectRows } = await supabase
    .from("subjects")
    .select("id, name, archived")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })

  const subjects = (subjectRows ?? []) as SubjectRow[]
  if (subjects.length === 0) {
    return <SubjectsDataTable initialSubjects={[]} />
  }

  const subjectIds = subjects.map((s) => s.id)

  const { data: topicRows } = await supabase
    .from("topics")
    .select("id, subject_id")
    .eq("user_id", user.id)
    .in("subject_id", subjectIds)

  const topics = (topicRows ?? []) as TopicRow[]
  const topicIds = topics.map((t) => t.id)

  const { data: topicParamRows } = await supabase
    .from("topic_params")
    .select("topic_id, estimated_hours, priority, deadline")
    .eq("user_id", user.id)
    .in("topic_id", topicIds.length > 0 ? topicIds : ["__none__"])

  const params = (topicParamRows ?? []) as TopicParamsRow[]

  const { data: taskRows } = await supabase
    .from("tasks")
    .select("subject_id, completed")
    .eq("user_id", user.id)
    .in("subject_id", subjectIds)

  const tasks = (taskRows ?? []) as TaskRow[]

  const topicToSubject = new Map<string, string>()
  for (const topic of topics) {
    topicToSubject.set(topic.id, topic.subject_id)
  }

  const summaryBySubject = new Map<
    string,
    {
      topicCount: number
      estimatedHours: number
      totalTasks: number
      completedTasks: number
      earliestDeadline: string | null
      priority: number | null
    }
  >()

  for (const subject of subjects) {
    summaryBySubject.set(subject.id, {
      topicCount: 0,
      estimatedHours: 0,
      totalTasks: 0,
      completedTasks: 0,
      earliestDeadline: null,
      priority: null,
    })
  }

  for (const topic of topics) {
    const summary = summaryBySubject.get(topic.subject_id)
    if (!summary) continue
    summary.topicCount += 1
  }

  for (const param of params) {
    const subjectId = topicToSubject.get(param.topic_id)
    if (!subjectId) continue

    const summary = summaryBySubject.get(subjectId)
    if (!summary) continue

    summary.estimatedHours += param.estimated_hours

    if (summary.priority === null || param.priority < summary.priority) {
      summary.priority = param.priority
    }

    if (param.deadline) {
      if (!summary.earliestDeadline || param.deadline < summary.earliestDeadline) {
        summary.earliestDeadline = param.deadline
      }
    }
  }

  for (const task of tasks) {
    const summary = summaryBySubject.get(task.subject_id)
    if (!summary) continue

    summary.totalTasks += 1
    if (task.completed) {
      summary.completedTasks += 1
    }
  }

  const rows: SubjectTableRow[] = subjects.map((subject) => {
    const summary = summaryBySubject.get(subject.id)

    return {
      id: subject.id,
      name: subject.name,
      archived: subject.archived,
      topicCount: summary?.topicCount ?? 0,
      estimatedHours: summary?.estimatedHours ?? 0,
      totalTasks: summary?.totalTasks ?? 0,
      completedTasks: summary?.completedTasks ?? 0,
      earliestDeadline: summary?.earliestDeadline ?? null,
      priority: summary?.priority ?? null,
    }
  })

  return <SubjectsDataTable initialSubjects={rows} />
}
