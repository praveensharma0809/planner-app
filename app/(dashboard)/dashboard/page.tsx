import Link from "next/link"
import { getStreak } from "@/app/actions/dashboard/getStreak"
import { getWeeklySnapshot } from "@/app/actions/dashboard/getWeeklySnapshot"
import { getSubjectProgress, type SubjectProgress } from "@/app/actions/dashboard/getSubjectProgress"
import { getBacklog } from "@/app/actions/dashboard/getBacklog"
import { setTaskCompletion } from "@/app/actions/plan/setTaskCompletion"
import { deleteScheduleTask } from "@/app/actions/schedule/deleteScheduleTask"
import { SubmitButton } from "@/app/components/SubmitButton"
import { RescheduleMissedButton } from "./RescheduleMissedButton"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Task } from "@/lib/types/db"
import { Badge } from "@/app/components/ui"
import { Button } from "@/app/components/ui"
import { Progress } from "@/app/components/ui"
import { PageHeader } from "@/app/components/layout/PageHeader"
import { ContentGrid } from "@/app/components/layout/ContentGrid"
import { SectionCard } from "@/app/components/layout/SectionCard"
import { AddTaskButton } from "@/app/components/tasks/AddTaskButton"
import { STANDALONE_SUBJECT_LABEL } from "@/lib/constants"
import { getTasksForDate, getTodayLocalDate } from "@/lib/tasks/getTasksForDate"

interface DashboardSubjectOption {
  id: string
  name: string
  sort_order?: number | null
}

const HEALTH_BADGE: Record<string, { variant: "success" | "warning" | "danger" | "default"; label: string }> = {
  on_track: { variant: "success", label: "On track" },
  behind: { variant: "warning", label: "Behind" },
  at_risk: { variant: "warning", label: "At risk" },
  overdue: { variant: "danger", label: "Overdue" },
  no_deadline: { variant: "default", label: "No deadline" },
}

const SUBJECT_ACCENTS = ["#7C6CFF", "#34D399", "#F59E0B", "#EF4444", "#06B6D4", "#F472B6"]

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0m"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatDeadlineLabel(daysLeft: number | null) {
  if (daysLeft === null) return "No deadline"
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`
  if (daysLeft === 0) return "Due today"
  if (daysLeft === 1) return "Due tomorrow"
  if (daysLeft <= 14) return `${daysLeft}d left`
  return `${Math.ceil(daysLeft / 7)}w left`
}

function getHealthRank(subject: SubjectProgress) {
  switch (subject.health) {
    case "overdue":
      return 0
    case "at_risk":
      return 1
    case "behind":
      return 2
    case "on_track":
      return 3
    default:
      return 4
  }
}

function compareSubjectUrgency(a: SubjectProgress, b: SubjectProgress) {
  const healthCompare = getHealthRank(a) - getHealthRank(b)
  if (healthCompare !== 0) return healthCompare

  const aDays = a.daysLeft ?? Number.MAX_SAFE_INTEGER
  const bDays = b.daysLeft ?? Number.MAX_SAFE_INTEGER
  if (aDays !== bDays) return aDays - bDays

  const remainingA = Math.max(0, a.total_tasks - a.completed_tasks)
  const remainingB = Math.max(0, b.total_tasks - b.completed_tasks)
  if (remainingA !== remainingB) return remainingB - remainingA

  return a.name.localeCompare(b.name)
}

function getSubjectProgressVariant(subject: SubjectProgress): "default" | "success" | "warning" | "danger" {
  if (subject.health === "overdue") return "danger"
  if (subject.health === "at_risk" || subject.health === "behind") return "warning"
  if (subject.percent >= 70) return "success"
  return "default"
}

function getProgressFillClass(percent: number) {
  if (percent === 100) return "overview-progress-fill-success"
  if (percent >= 65) return "overview-progress-fill-default"
  if (percent >= 35) return "overview-progress-fill-warning"
  return "overview-progress-fill-danger"
}

export default async function DashboardPage() {
  const [streak, weekly, subjectProgress, backlog, supabase] = await Promise.all([
    getStreak().catch(() => ({ status: "NO_PROFILE" as const })),
    getWeeklySnapshot().catch(() => ({ status: "SUCCESS" as const, tasks: [] })),
    getSubjectProgress().catch(() => ({ status: "SUCCESS" as const, subjects: [] })),
    getBacklog().catch(() => ({ status: "SUCCESS" as const, tasks: [] })),
    createServerSupabaseClient().catch(() => null),
  ])

  const streakData = streak.status === "SUCCESS" ? streak : null
  const tasks: Task[] = weekly.status === "SUCCESS" ? weekly.tasks : []
  const subjects: SubjectProgress[] = subjectProgress.status === "SUCCESS" ? subjectProgress.subjects : []
  const backlogTasks: Task[] = backlog.status === "SUCCESS" ? backlog.tasks : []

  const user = supabase
    ? (await supabase.auth.getUser().catch(() => ({ data: { user: null } }))).data.user
    : null

  const subjectList: DashboardSubjectOption[] = user && supabase
    ? ((
        await supabase
          .from("subjects")
          .select("id, name, sort_order")
          .eq("user_id", user.id)
          .eq("archived", false)
          .not("name", "ilike", "others")
          .not("name", "ilike", "__deprecated_others__")
          .order("sort_order", { ascending: true })
      ).data ?? [])
    : []

  const subjectNameById = new Map(subjectList.map((subject) => [subject.id, subject.name]))

  const today = getTodayLocalDate()
  const todayTasks = getTasksForDate(tasks, today)
  const pendingToday = todayTasks.filter((task) => !task.completed)
  const doneToday = todayTasks.filter((task) => task.completed)
  const remainingTodayMinutes = pendingToday.reduce((sum, task) => sum + task.duration_minutes, 0)

  const thisWeekDoneCount = tasks.filter((task) => task.completed).length
  const thisWeekTotalCount = tasks.length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const todayProgressPercent = todayTasks.length > 0
    ? Math.round((doneToday.length / todayTasks.length) * 100)
    : 0

  const todayPaceLabel =
    todayTasks.length === 0 ? "No tasks yet"
      : pendingToday.length === 0 ? "All clear"
        : todayProgressPercent >= 75 ? "Strong"
          : todayProgressPercent >= 40 ? "On track"
            : "Busy"

  const pendingTodaySorted = [...pendingToday].sort((a, b) => {
    const durationCompare = b.duration_minutes - a.duration_minutes
    if (durationCompare !== 0) return durationCompare
    return a.created_at.localeCompare(b.created_at)
  })

  const doneTodaySorted = [...doneToday].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  )

  const visiblePendingTasks = pendingTodaySorted.slice(0, 8)
  const hiddenPendingCount = Math.max(0, pendingTodaySorted.length - visiblePendingTasks.length)

  const prioritizedSubjects = [...subjects].sort(compareSubjectUrgency)
  const visibleSubjects = prioritizedSubjects.slice(0, 5)
  const hiddenSubjectsCount = Math.max(0, prioritizedSubjects.length - visibleSubjects.length)

  const urgentDeadlineSubjects = prioritizedSubjects.filter(
    (subject) =>
      subject.daysLeft !== null
      && subject.daysLeft >= 0
      && subject.daysLeft <= 2
      && subject.percent < 100
  )

  const heavyTodayLoad = remainingTodayMinutes >= 180
  const weeklyCompletionRate = thisWeekTotalCount > 0 ? thisWeekDoneCount / thisWeekTotalCount : 1
  const weeklyPaceRisk = thisWeekTotalCount >= 8 && weeklyCompletionRate < 0.4
  const streakRisk = (streakData?.streak_current ?? 0) > 0 && doneToday.length === 0 && pendingToday.length > 0

  const alertItems = [
    ...(backlogTasks.length > 0
      ? [{
        id: "overdue-work",
        tone: "danger" as const,
        title: "Overdue work",
        detail: `${backlogTasks.length} task${backlogTasks.length > 1 ? "s" : ""} are past schedule date.`,
        action: <RescheduleMissedButton />,
      }]
      : []),
    ...urgentDeadlineSubjects.slice(0, 2).map((subject) => ({
      id: `deadline-${subject.id}`,
      tone: subject.daysLeft === 0 ? "danger" as const : "warning" as const,
      title: subject.daysLeft === 0 ? `${subject.name} is due today` : `${subject.name} due soon`,
      detail: `${Math.max(0, subject.total_tasks - subject.completed_tasks)} tasks left Â· ${formatDeadlineLabel(subject.daysLeft)}`,
      action: null,
    })),
    ...(heavyTodayLoad
      ? [{
        id: "heavy-today",
        tone: "warning" as const,
        title: "Heavy day ahead",
        detail: `${formatMinutes(remainingTodayMinutes)} still pending today. Consider splitting long blocks.`,
        action: null,
      }]
      : []),
    ...(weeklyPaceRisk
      ? [{
        id: "weekly-pace",
        tone: "info" as const,
        title: "Weekly pace is slipping",
        detail: `${thisWeekDoneCount}/${thisWeekTotalCount} completed this week. A small session today helps recover pace.`,
        action: null,
      }]
      : []),
    ...(streakRisk
      ? [{
        id: "streak-risk",
        tone: "info" as const,
        title: "Streak at risk",
        detail: `${streakData?.streak_current ?? 0} day streak needs one completed task today.`,
        action: null,
      }]
      : []),
  ]

  const riskSignalCount = alertItems.length

  async function handleComplete(formData: FormData) {
    "use server"

    const taskId = formData.get("task_id")
    if (typeof taskId !== "string" || !taskId) return
    try {
      await setTaskCompletion(taskId, true)
    } catch {
      // Avoid crashing the server-action transport on unexpected runtime failures.
    }
  }

  async function handleDelete(formData: FormData) {
    "use server"

    const taskId = formData.get("task_id")
    if (typeof taskId !== "string" || !taskId) return
    try {
      await deleteScheduleTask(taskId)
    } catch {
      // Avoid crashing the server-action transport on unexpected runtime failures.
    }
  }

  return (
    <div className="page-root animate-fade-in flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto">
      <PageHeader
        eyebrow={formatDate(today)}
        title={greeting}
        subtitle="Focus on what matters. Track your rhythm, your day's load, and what's pressing."
        actions={
          <Link href="/planner">
            <Button variant="primary" size="md">New Plan</Button>
          </Link>
        }
      />

      <ContentGrid layout="main-aside">
        <div className="space-y-5">
          {/* Today's Progress Card */}
          <SectionCard className="dashboard-hero-card">
            <div className="dashboard-hero-content">
              <div className="dashboard-hero-left">
                <div className="dashboard-hero-label">Today&apos;s Progress</div>
                <div className="dashboard-hero-main">
                  <span className="dashboard-hero-percent">
                    {todayTasks.length === 0 ? "â€”" : todayProgressPercent}
                    {todayTasks.length > 0 && <span className="dashboard-hero-unit">%</span>}
                  </span>
                  <span className="dashboard-hero-label-sub">{todayPaceLabel}</span>
                </div>
                <p className="dashboard-hero-description">
                  {todayTasks.length === 0
                    ? "Generate a plan or use quick add when you're ready."
                    : pendingToday.length === 0
                      ? "Everything done. Great work today!"
                      : `${formatMinutes(remainingTodayMinutes)} of focus remaining`}
                </p>
              </div>
              <div className="dashboard-hero-right">
                <div className="dashboard-progress-track">
                  <div
                    className={`dashboard-progress-fill ${getProgressFillClass(todayProgressPercent)}`}
                    style={{
                      width: !todayTasks.length ? "0%" : `${Math.max(todayProgressPercent, 4)}%`,
                    }}
                  />
                </div>
                <div className="dashboard-hero-stats">
                  <div className="dashboard-stat">
                    <div className="dashboard-stat-value">{doneToday.length}</div>
                    <div className="dashboard-stat-label">Done</div>
                  </div>
                  <div className="dashboard-stat">
                    <div className="dashboard-stat-value">{pendingToday.length}</div>
                    <div className="dashboard-stat-label">Pending</div>
                  </div>
                  <div className="dashboard-stat">
                    <div className="dashboard-stat-value">{thisWeekDoneCount}/ {thisWeekTotalCount}</div>
                    <div className="dashboard-stat-label">This week</div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Today's Tasks */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Today&apos;s Tasks</span>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--sh-border)" }}>
                  {pendingToday.length} left
                </span>
              </div>
            }
            action={
              <div className="flex items-center gap-2">
                <AddTaskButton
                  subjects={subjectList}
                  initialDate={today}
                  buttonLabel="Quick add for today"
                  buttonClassName="ui-btn ui-btn-ghost ui-btn-sm"
                />
                <Link href="/dashboard/calendar" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                  Calendar â†’
                </Link>
              </div>
            }
          >
            <div className="space-y-3">
              {todayTasks.length === 0 ? (
                <div className="dashboard-empty-state">
                  <div className="dashboard-empty-icon">
                    <svg className="w-8 h-8" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="dashboard-empty-title">No tasks scheduled</p>
                  <p className="dashboard-empty-text">Start by generating a plan or using quick add above</p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className="rounded-lg border px-3 py-2"
                      style={{ borderColor: "var(--sh-border)", background: "var(--sh-card)" }}
                    >
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>Pending</p>
                      <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                        {pendingToday.length}
                      </p>
                    </div>
                    <div
                      className="rounded-lg border px-3 py-2"
                      style={{ borderColor: "var(--sh-border)", background: "var(--sh-card)" }}
                    >
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>Done</p>
                      <p className="text-base font-semibold" style={{ color: "var(--sh-text-primary)" }}>
                        {doneToday.length}
                      </p>
                    </div>
                  </div>

                  {pendingTodaySorted.length === 0 && doneToday.length > 0 && (
                    <div className="dashboard-complete-banner">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Everything on your list is done!</span>
                      </div>
                    </div>
                  )}

                  {visiblePendingTasks.length > 0 && (
                    <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                      {visiblePendingTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 rounded-xl border px-2.5 py-2"
                          style={{ borderColor: "var(--sh-border)", background: "var(--sh-card)" }}
                        >
                          <form action={handleComplete}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <SubmitButton
                              className="dashboard-task-checkbox"
                              aria-label="Complete task"
                            >
                              <span className="sr-only">Complete</span>
                            </SubmitButton>
                          </form>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>
                              {task.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                              <span>
                                {task.task_type === "standalone"
                                  ? STANDALONE_SUBJECT_LABEL
                                  : (task.subject_id ? subjectNameById.get(task.subject_id) : null) ?? "Unknown"}
                              </span>
                              <span>{task.duration_minutes}m</span>
                              {task.session_number != null && task.total_sessions != null && task.total_sessions > 1 && (
                                <span>{task.session_number}/{task.total_sessions}</span>
                              )}
                              {task.session_type !== "core" && <span>{task.session_type}</span>}
                            </div>
                          </div>
                          <form action={handleDelete}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <SubmitButton
                              className="task-icon-delete-button shrink-0"
                              aria-label="Delete task"
                              title="Delete"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 13a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L5 6" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v7M14 10v7" />
                              </svg>
                              <span className="sr-only">Delete</span>
                            </SubmitButton>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}

                  {hiddenPendingCount > 0 && (
                    <p className="text-[11px] font-medium" style={{ color: "var(--sh-text-muted)" }}>
                      +{hiddenPendingCount} more pending tasks in Calendar view
                    </p>
                  )}

                  {doneTodaySorted.length > 0 && (
                    <details className="dashboard-completed-section" open={pendingTodaySorted.length === 0}>
                      <summary className="dashboard-completed-summary">
                        <svg className="w-4 h-4" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        <span>Completed Today</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--sh-border)" }}>
                          {doneToday.length}
                        </span>
                      </summary>
                      <div className="mt-3 space-y-1.5">
                        {doneTodaySorted.map((task) => (
                          <div key={task.id} className="dashboard-task-completed">
                            <div className="dashboard-task-complete-check">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="dashboard-task-completed-title">{task.title}</span>
                            <span className="dashboard-task-completed-time">
                              {(
                                task.task_type === "standalone"
                                  ? STANDALONE_SUBJECT_LABEL
                                  : (task.subject_id ? subjectNameById.get(task.subject_id) : null) ?? "Unknown"
                              ).slice(0, 10)} Â· {task.duration_minutes}m
                            </span>
                            <form action={handleDelete}>
                              <input type="hidden" name="task_id" value={task.id} />
                              <SubmitButton
                                className="task-icon-delete-button shrink-0"
                                aria-label="Delete task"
                                title="Delete"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4.8A1.8 1.8 0 0 1 9.8 3h4.4A1.8 1.8 0 0 1 16 4.8V6" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 13a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8L5 6" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v7M14 10v7" />
                                </svg>
                                <span className="sr-only">Delete</span>
                              </SubmitButton>
                            </form>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Alerts */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4v2m0 4v2M7 5h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2zm0 0V3a2 2 0 012-2h2a2 2 0 012 2v2" /> 
                </svg>
                <span>Alerts</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: riskSignalCount > 0 ? "rgba(239,68,68,0.15)" : "rgba(52,211,153,0.15)" }}>
                  {riskSignalCount === 0 ? "Clear" : `${riskSignalCount}`}
                </span>
              </div>
            }
          >
            {riskSignalCount === 0 ? (
              <div className="dashboard-alert-empty">
                <p className="dashboard-alert-title">All systems go</p>
                <p className="dashboard-alert-text">No deadlines at risk. Keep your momentum.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertItems.map((alert) => {
                  const containerClass =
                    alert.tone === "danger"
                      ? "dashboard-alert-danger"
                      : "dashboard-alert-warning"
                  const iconClass =
                    alert.tone === "danger"
                      ? "bg-red-500/15 text-red-400"
                      : alert.tone === "warning"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-sky-500/15 text-sky-300"

                  return (
                    <div key={alert.id} className={containerClass}>
                      <div className={`dashboard-alert-icon ${iconClass}`}>
                        <svg className="w-4 h-4" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="dashboard-alert-title">{alert.title}</p>
                        <p className="dashboard-alert-text">{alert.detail}</p>
                      </div>
                      {alert.action}
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Subject Progress */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3.042.525A9.006 9.006 0 002.25 9m12-7c1.052 0 2.062.18 3.042.525A9.006 9.006 0 0021.75 9M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Subjects</span>
              </div>
            }
            action={
              <Link href="/dashboard/subjects" className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                All â†’
              </Link>
            }
          >
            {visibleSubjects.length === 0 ? (
              <div className="dashboard-empty-state">
                <p className="dashboard-empty-title">No subjects</p>
                <p className="dashboard-empty-text">Add subjects to start tracking progress</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleSubjects.map((subject) => {
                  const badge = HEALTH_BADGE[subject.health] ?? HEALTH_BADGE.no_deadline
                  const accent =
                    subject.health === "overdue"
                      ? "#EF4444"
                      : subject.health === "at_risk" || subject.health === "behind"
                        ? "#F59E0B"
                        : SUBJECT_ACCENTS[visibleSubjects.indexOf(subject) % SUBJECT_ACCENTS.length]

                  return (
                    <div key={subject.id} className="dashboard-subject-row">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="dashboard-subject-dot" style={{ background: accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="dashboard-subject-name">{subject.name}</p>
                            <Badge variant={badge.variant} size="sm">
                              {badge.label}
                            </Badge>
                          </div>
                          <p className="dashboard-subject-meta">
                            {subject.completed_tasks}/{subject.total_tasks} â€¢ {subject.percent}%
                          </p>
                        </div>
                      </div>
                      <span className="dashboard-subject-deadline">{formatDeadlineLabel(subject.daysLeft)}</span>
                      <Progress value={subject.percent} variant={getSubjectProgressVariant(subject)} height={3} className="mt-2 w-full" />
                    </div>
                  )
                })}

                {hiddenSubjectsCount > 0 && (
                  <p className="text-[11px] font-medium" style={{ color: "var(--sh-text-muted)" }}>
                    {hiddenSubjectsCount} more in All subjects
                  </p>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </ContentGrid>
    </div>
  )
}
