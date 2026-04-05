import type { PlannableUnit, ScheduledSession } from "@/lib/planner/engine"
import { inferSessionLengthMinutes } from "@/lib/planner/draft"
import type { Topic } from "@/lib/types/db"

export interface TopicParams {
  topic_id: string
  estimated_hours: number
  deadline: string | null
  earliest_start: string | null
  depends_on: string[]
  session_length_minutes: number
  rest_after_days: number
  max_sessions_per_day: number
  study_frequency: string
}

export interface PlannerTaskSourceRow {
  id: string
  topic_id: string | null
  title: string
  duration_minutes: number
  sort_order?: number | null
  created_at?: string
}

export interface PlannerTaskSourceItem {
  id: string
  title: string
  durationMinutes: number
  sortOrder: number
  createdAt: string
}

export interface SubjectRow {
  id: string
  name: string
  sort_order: number
  deadline?: string | null
  archived?: boolean | null
}

export interface TaskToMove {
  id?: string
  subject_id: string
  topic_id: string | null
  title: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  session_number: number | null
  total_sessions: number | null
  scheduled_date: string
  source_topic_task_id?: string | null
}

export interface PendingUnitMeta {
  unitId: string
  topicId: string | null
  subjectId: string
  subjectName: string
  topicName: string
  titleFallback: string
  sessionType: "core" | "revision" | "practice"
  remainingSessionTitles: string[]
  remainingSessionTypes: Array<"core" | "revision" | "practice">
  expectedSessions: number
  originalTotalSessions: number
  remainingSessionNumbers: number[]
  sourceTaskIds: Array<string | null>
  sessionLengthMinutes: number
  dependsOn: string[]
}

export interface SnapshotTask {
  subject_id: string
  topic_id: string | null
  title: string
  scheduled_date: string
  duration_minutes: number
  session_type: "core" | "revision" | "practice"
  session_number: number
  total_sessions: number
  source_topic_task_id: string | null
}

export interface DroppedReason {
  topicId: string | null
  title: string
  droppedSessions: number
  reason: string
}

export function mapStudyFrequency(
  value: string | null | undefined
): PlannableUnit["study_frequency"] {
  if (!value) return undefined
  return value === "spaced" ? "spaced" : "daily"
}

export function buildSubjectMaps(subjects: SubjectRow[]) {
  const subjectNameMap = new Map<string, string>()
  const subjectOrderMap = new Map<string, number>()
  const subjectDeadlineMap = new Map<string, string>()

  for (const subject of subjects) {
    subjectNameMap.set(subject.id, subject.name)
    subjectOrderMap.set(subject.id, subject.sort_order ?? 0)
    if (subject.deadline) subjectDeadlineMap.set(subject.id, subject.deadline)
  }

  return {
    subjectNameMap,
    subjectOrderMap,
    subjectDeadlineMap,
  }
}

export function sortTopicsBySubjectOrder(
  topics: Topic[],
  subjectOrderMap: Map<string, number>
): Topic[] {
  return [...topics].sort((aTopic, bTopic) => {
    const subjectA = subjectOrderMap.get(aTopic.subject_id) ?? Number.MAX_SAFE_INTEGER
    const subjectB = subjectOrderMap.get(bTopic.subject_id) ?? Number.MAX_SAFE_INTEGER
    if (subjectA !== subjectB) return subjectA - subjectB
    if (aTopic.sort_order !== bTopic.sort_order) return aTopic.sort_order - bTopic.sort_order
    if (aTopic.created_at !== bTopic.created_at) {
      return aTopic.created_at.localeCompare(bTopic.created_at)
    }
    return aTopic.id.localeCompare(bTopic.id)
  })
}

export function buildTopicParamMap(rows: Array<Record<string, unknown>>): Map<string, TopicParams> {
  const paramMap = new Map<string, TopicParams>()

  for (const row of rows) {
    const id = String(row.id)
    paramMap.set(id, {
      topic_id: id,
      estimated_hours: Number(row.estimated_hours ?? 0),
      deadline: (row.deadline as string | null) ?? null,
      earliest_start: (row.earliest_start as string | null) ?? null,
      depends_on: (row.depends_on as string[] | null) ?? [],
      session_length_minutes: Number(row.session_length_minutes ?? 0),
      rest_after_days: Number(row.rest_after_days ?? 0),
      max_sessions_per_day: Number(row.max_sessions_per_day ?? 0),
      study_frequency: String(row.study_frequency ?? "daily"),
    })
  }

  return paramMap
}

export function buildTaskSourceByTopic(
  tasks: PlannerTaskSourceRow[]
): Map<string, PlannerTaskSourceItem[]> {
  const byTopic = new Map<string, PlannerTaskSourceItem[]>()

  for (const task of tasks) {
    if (!task.topic_id) continue
    if (!task.id) continue
    const title = task.title?.trim() ?? ""
    if (!title) continue

    const durationMinutes = Math.max(0, task.duration_minutes ?? 0)
    if (durationMinutes <= 0) continue

    const list = byTopic.get(task.topic_id) ?? []
    list.push({
      id: task.id,
      title,
      durationMinutes,
      sortOrder: task.sort_order ?? Number.MAX_SAFE_INTEGER,
      createdAt: task.created_at ?? "",
    })
    byTopic.set(task.topic_id, list)
  }

  for (const [topicId, list] of byTopic.entries()) {
    list.sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
      if (left.createdAt !== right.createdAt) {
        return left.createdAt.localeCompare(right.createdAt)
      }
      return left.title.localeCompare(right.title)
    })
    byTopic.set(topicId, list)
  }

  return byTopic
}

function formatPlannedSessionTitle(topicName: string, taskTitle: string): string {
  const cleanTopic = topicName.trim()
  const cleanTask = taskTitle.trim()
  if (!cleanTask) return cleanTopic
  return `${cleanTopic} - ${cleanTask}`
}

export function resolveSessionSourceTask(
  sourceTasks: PlannerTaskSourceItem[],
  sessionNumber: number,
  totalSessions: number
): PlannerTaskSourceItem | null {
  if (sourceTasks.length === 0) return null

  const normalizedTotal = Math.max(1, totalSessions)
  const normalizedNumber = Math.min(normalizedTotal, Math.max(1, sessionNumber))
  const totalMinutes = sourceTasks.reduce((sum, task) => sum + Math.max(1, task.durationMinutes), 0)

  if (totalMinutes <= 0) {
    return sourceTasks[(normalizedNumber - 1) % sourceTasks.length] ?? sourceTasks[0]
  }

  const target = ((normalizedNumber - 0.5) / normalizedTotal) * totalMinutes
  let cursor = 0
  for (const task of sourceTasks) {
    cursor += Math.max(1, task.durationMinutes)
    if (target <= cursor) {
      return task
    }
  }

  return sourceTasks[sourceTasks.length - 1] ?? null
}

export function resolveSessionTaskTitle(
  topicName: string,
  sourceTasks: PlannerTaskSourceItem[],
  sessionNumber: number,
  totalSessions: number
): string {
  const sourceTask = resolveSessionSourceTask(sourceTasks, sessionNumber, totalSessions)
  if (!sourceTask) return topicName
  return formatPlannedSessionTitle(topicName, sourceTask.title)
}

export function buildUnitsFromActiveTopics(args: {
  activeTopics: Topic[]
  paramMap: Map<string, TopicParams>
  topicTaskSourceMap: Map<string, PlannerTaskSourceItem[]>
  subjectNameMap: Map<string, string>
  subjectDeadlineMap: Map<string, string>
  examDate: string
}): PlannableUnit[] {
  const { activeTopics, paramMap, topicTaskSourceMap, subjectNameMap, subjectDeadlineMap, examDate } = args

  return activeTopics.flatMap((topic) => {
    const param = paramMap.get(topic.id)
    const sourceTasks = topicTaskSourceMap.get(topic.id) ?? []
    const estimatedMinutes = sourceTasks.reduce((sum, task) => sum + task.durationMinutes, 0)
    const sessionLength = inferSessionLengthMinutes(
      sourceTasks.map((task) => task.durationMinutes),
      param?.session_length_minutes
    )

    if (estimatedMinutes <= 0) return []

    const unit: PlannableUnit = {
      id: topic.id,
      subject_id: topic.subject_id,
      subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topic_name: topic.name,
      estimated_minutes: estimatedMinutes,
      session_length_minutes: sessionLength,
      deadline: param?.deadline ?? subjectDeadlineMap.get(topic.subject_id) ?? examDate,
      depends_on: param?.depends_on ?? [],
    }

    if (param?.earliest_start) unit.earliest_start = param.earliest_start
    if (param?.rest_after_days != null) unit.rest_after_days = param.rest_after_days
    if (param?.max_sessions_per_day != null) unit.max_sessions_per_day = param.max_sessions_per_day
    if (param?.study_frequency) unit.study_frequency = mapStudyFrequency(param.study_frequency)

    return [unit]
  })
}

export function buildReoptimizeUnits(args: {
  activeTopics: Topic[]
  paramMap: Map<string, TopicParams>
  topicTaskSourceMap: Map<string, PlannerTaskSourceItem[]>
  subjectNameMap: Map<string, string>
  subjectDeadlineMap: Map<string, string>
  examDate: string
  reservedGeneratedMinutesByTopic: Map<string, number>
}): { units: PlannableUnit[]; totalSessionsByTopic: Map<string, number> } {
  const {
    activeTopics,
    paramMap,
    topicTaskSourceMap,
    subjectNameMap,
    subjectDeadlineMap,
    examDate,
    reservedGeneratedMinutesByTopic,
  } = args

  const totalSessionsByTopic = new Map<string, number>()

  const units = activeTopics.flatMap((topic) => {
    const param = paramMap.get(topic.id)
    const sourceTasks = topicTaskSourceMap.get(topic.id) ?? []
    const totalMinutes = sourceTasks.reduce((sum, task) => sum + task.durationMinutes, 0)
    const sessionLength = inferSessionLengthMinutes(
      sourceTasks.map((task) => task.durationMinutes),
      param?.session_length_minutes
    )

    if (totalMinutes <= 0) return []

    const reservedGeneratedMinutes = reservedGeneratedMinutesByTopic.get(topic.id) ?? 0
    const remainingMinutes = Math.max(0, totalMinutes - reservedGeneratedMinutes)

    totalSessionsByTopic.set(topic.id, Math.ceil(totalMinutes / sessionLength))

    if (remainingMinutes <= 0) return []

    const unit: PlannableUnit = {
      id: topic.id,
      subject_id: topic.subject_id,
      subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topic_name: topic.name,
      estimated_minutes: remainingMinutes,
      session_length_minutes: sessionLength,
      deadline: param?.deadline ?? subjectDeadlineMap.get(topic.subject_id) ?? examDate,
      depends_on: param?.depends_on ?? [],
    }

    if (param?.earliest_start) unit.earliest_start = param.earliest_start
    if (param?.rest_after_days != null) unit.rest_after_days = param.rest_after_days
    if (param?.max_sessions_per_day != null) unit.max_sessions_per_day = param.max_sessions_per_day
    if (param?.study_frequency) unit.study_frequency = mapStudyFrequency(param.study_frequency)

    return [unit]
  })

  return { units, totalSessionsByTopic }
}

export function buildPendingUnitsAndMeta(args: {
  pendingTasks: TaskToMove[]
  topicMap: Map<string, Topic>
  topicParamMap: Map<string, TopicParams>
  subjectNameMap: Map<string, string>
  subjectDeadlineMap: Map<string, string>
  examDate: string
  today: string
}): { pendingUnits: PlannableUnit[]; pendingUnitMeta: Map<string, PendingUnitMeta> } {
  const { pendingTasks, topicMap, topicParamMap, subjectNameMap, subjectDeadlineMap, examDate, today } = args
  const pendingUnits: PlannableUnit[] = []
  const pendingUnitMeta = new Map<string, PendingUnitMeta>()

  const tasksByTopic = new Map<string, TaskToMove[]>()
  const adHocTasks: TaskToMove[] = []

  for (const task of pendingTasks) {
    if (task.topic_id && topicMap.has(task.topic_id) && topicParamMap.has(task.topic_id)) {
      const list = tasksByTopic.get(task.topic_id) ?? []
      list.push(task)
      tasksByTopic.set(task.topic_id, list)
    } else {
      adHocTasks.push(task)
    }
  }

  for (const [topicId, tasks] of tasksByTopic.entries()) {
    const topic = topicMap.get(topicId)
    const paramsForTopic = topicParamMap.get(topicId)
    if (!topic || !paramsForTopic) continue

    const orderedTasks = [...tasks].sort((left, right) => {
      const leftNumber = left.session_number ?? 0
      const rightNumber = right.session_number ?? 0
      if (leftNumber !== rightNumber) return leftNumber - rightNumber
      if (left.scheduled_date !== right.scheduled_date) {
        return left.scheduled_date.localeCompare(right.scheduled_date)
      }
      const leftSourceTaskId = left.source_topic_task_id ?? ""
      const rightSourceTaskId = right.source_topic_task_id ?? ""
      if (leftSourceTaskId !== rightSourceTaskId) {
        return leftSourceTaskId.localeCompare(rightSourceTaskId)
      }

      const leftId = left.id ?? ""
      const rightId = right.id ?? ""
      if (leftId !== rightId) {
        return leftId.localeCompare(rightId)
      }

      return left.title.localeCompare(right.title)
    })

    const sessionLength = inferSessionLengthMinutes(
      orderedTasks.map((task) => task.duration_minutes),
      paramsForTopic.session_length_minutes
    )
    const expectedSessions = orderedTasks.length
    const totalSessions = Math.max(
      ...orderedTasks.map((task) => task.total_sessions ?? 0),
      Math.ceil(Math.round(paramsForTopic.estimated_hours * 60) / sessionLength)
    )

    pendingUnits.push({
      id: topic.id,
      subject_id: topic.subject_id,
      subject_name: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topic_name: topic.name,
      estimated_minutes: orderedTasks.reduce((sum, task) => sum + task.duration_minutes, 0),
      session_length_minutes: sessionLength,
      deadline: paramsForTopic.deadline ?? subjectDeadlineMap.get(topic.subject_id) ?? examDate,
      earliest_start: today,
      depends_on: paramsForTopic.depends_on ?? [],
      rest_after_days: paramsForTopic.rest_after_days,
      max_sessions_per_day: paramsForTopic.max_sessions_per_day,
      study_frequency: mapStudyFrequency(paramsForTopic.study_frequency),
    })

    pendingUnitMeta.set(topic.id, {
      unitId: topic.id,
      topicId: topic.id,
      subjectId: topic.subject_id,
      subjectName: subjectNameMap.get(topic.subject_id) ?? "Unknown",
      topicName: topic.name,
      titleFallback: orderedTasks[0]?.title ?? topic.name,
      sessionType: orderedTasks[0]?.session_type ?? "core",
      remainingSessionTitles: orderedTasks.map((task) => task.title.trim() || topic.name),
      remainingSessionTypes: orderedTasks.map((task) => task.session_type),
      expectedSessions,
      originalTotalSessions: totalSessions,
      remainingSessionNumbers: orderedTasks
        .map((task) => task.session_number ?? 0)
        .filter((num) => num > 0)
        .sort((aNum, bNum) => aNum - bNum),
      sourceTaskIds: orderedTasks.map((task) => task.source_topic_task_id ?? null),
      sessionLengthMinutes: sessionLength,
      dependsOn: paramsForTopic.depends_on ?? [],
    })
  }

  for (const [index, task] of adHocTasks.entries()) {
    const unitId = `adhoc-${index}`
    const subjectName = subjectNameMap.get(task.subject_id) ?? task.subject_id
    pendingUnits.push({
      id: unitId,
      subject_id: task.subject_id,
      subject_name: subjectName,
      topic_name: task.title,
      estimated_minutes: task.duration_minutes,
      session_length_minutes: task.duration_minutes,
      deadline: examDate,
      earliest_start: today,
      depends_on: [],
    })

    pendingUnitMeta.set(unitId, {
      unitId,
      topicId: task.topic_id,
      subjectId: task.subject_id,
      subjectName,
      topicName: task.title,
      titleFallback: task.title,
      sessionType: task.session_type,
      remainingSessionTitles: [task.title],
      remainingSessionTypes: [task.session_type],
      expectedSessions: 1,
      originalTotalSessions: Math.max(1, task.total_sessions ?? 1),
      remainingSessionNumbers:
        task.session_number && task.session_number > 0 ? [task.session_number] : [],
      sourceTaskIds: [task.source_topic_task_id ?? null],
      sessionLengthMinutes: task.duration_minutes,
      dependsOn: [],
    })
  }

  return { pendingUnits, pendingUnitMeta }
}

export function mapScheduledToSnapshotTasks(
  scheduledSessions: ScheduledSession[],
  pendingUnitMeta: Map<string, PendingUnitMeta>
): {
  scheduled: SnapshotTask[]
  scheduledCountByUnit: Map<string, number>
} {
  const scheduledCountByUnit = new Map<string, number>()

  const scheduled: SnapshotTask[] = scheduledSessions.map((session) => {
    const meta = pendingUnitMeta.get(session.topic_id)
    const scheduledCount = scheduledCountByUnit.get(session.topic_id) ?? 0
    scheduledCountByUnit.set(session.topic_id, scheduledCount + 1)

    if (!meta) {
      return {
        subject_id: session.subject_id,
        topic_id: session.topic_id,
        title: session.title,
        scheduled_date: session.scheduled_date,
        duration_minutes: session.duration_minutes,
        session_type: session.session_type,
        session_number: session.session_number,
        total_sessions: session.total_sessions,
        source_topic_task_id: session.source_topic_task_id ?? null,
      }
    }

    const sessionNumber = meta.remainingSessionNumbers[scheduledCount] ?? session.session_number
    const totalSessions =
      meta.originalTotalSessions > 0 ? meta.originalTotalSessions : session.total_sessions
    const sourceTaskId =
      meta.sourceTaskIds[scheduledCount] ?? session.source_topic_task_id ?? null
    const title =
      meta.remainingSessionTitles[scheduledCount]
      ?? session.title
      ?? meta.titleFallback
    const sessionType =
      meta.remainingSessionTypes[scheduledCount]
      ?? session.session_type
      ?? meta.sessionType

    return {
      subject_id: meta.subjectId,
      topic_id: meta.topicId,
      title,
      scheduled_date: session.scheduled_date,
      duration_minutes: session.duration_minutes,
      session_type: sessionType,
      session_number: sessionNumber,
      total_sessions: totalSessions,
      source_topic_task_id: sourceTaskId,
    }
  })

  return { scheduled, scheduledCountByUnit }
}

export function buildDroppedReasons(args: {
  pendingUnitMeta: Map<string, PendingUnitMeta>
  scheduledCountByUnit: Map<string, number>
  maxAvailableSlot: number
}): DroppedReason[] {
  const { pendingUnitMeta, scheduledCountByUnit, maxAvailableSlot } = args
  const droppedReasons: DroppedReason[] = []

  for (const meta of pendingUnitMeta.values()) {
    const placedSessions = scheduledCountByUnit.get(meta.unitId) ?? 0
    const droppedSessionsForUnit = Math.max(0, meta.expectedSessions - placedSessions)
    if (droppedSessionsForUnit <= 0) continue

    let reason = "no slot before deadline after preserving existing tasks"
    if (meta.dependsOn.length > 0) {
      reason = "dependency ordering left no room before the deadline"
    } else if (meta.sessionLengthMinutes > maxAvailableSlot) {
      reason = "session is longer than any remaining available day capacity"
    }

    droppedReasons.push({
      topicId: meta.topicId,
      title: meta.topicName,
      droppedSessions: droppedSessionsForUnit,
      reason,
    })
  }

  return droppedReasons
}
