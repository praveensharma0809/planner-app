import Link from "next/link"
import { getStreak } from "@/app/actions/dashboard/getStreak"
import { getWeeklySnapshot } from "@/app/actions/dashboard/getWeeklySnapshot"
import { getSubjectProgress, type SubjectProgress } from "@/app/actions/dashboard/getSubjectProgress"
import { getBacklog } from "@/app/actions/dashboard/getBacklog"
import { RescheduleMissedButton } from "./RescheduleMissedButton"
import { DashboardTaskToggle, DashboardTaskDelete } from "./DashboardTaskActions"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Task } from "@/lib/types/db"
import { Badge } from "@/app/components/ui"

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
      detail: `${Math.max(0, subject.total_tasks - subject.completed_tasks)} tasks left · ${formatDeadlineLabel(subject.daysLeft)}`,
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

  return (
    <div className="page-root animate-fade-in flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto">
      <PageHeader
        eyebrow={formatDate(today)}
        title={greeting}
        subtitle="Focus on what matters. Track your rhythm, your day's load, and what's pressing."
      />

      <ContentGrid layout="main-aside">
        <div className="flex flex-col gap-[var(--gap-card)] md:gap-[var(--gap-card-md)]">
          {/* Today's Progress Card */}
          <SectionCard className="dashboard-hero-card">
            <div className="dashboard-hero-content">
              <div className="dashboard-hero-left">
                <div className="dashboard-hero-label">Today&apos;s Progress</div>
                <div className="dashboard-hero-main">
                  <span className="dashboard-hero-percent">
                    {todayTasks.length === 0 ? "—" : todayProgressPercent}
                    {todayTasks.length > 0 && <span className="dashboard-hero-unit">%</span>}
                  </span>
                  <span className="dashboard-hero-label-sub">{todayPaceLabel}</span>
                </div>
                <p className="dashboard-hero-description" style={{ color: "var(--text-secondary)" }}>
                  {todayTasks.length === 0
                    ? "Generate a plan or use quick add when you're ready."
                    : pendingToday.length === 0
                      ? "Everything done. Great work today!"
                      : `${formatMinutes(remainingTodayMinutes)} of focus remaining`}
                </p>
              </div>
              <div className="dashboard-hero-right">
                <Progress
                  value={todayTasks.length === 0 ? 0 : Math.max(todayProgressPercent, 4)}
                  variant="default"
                  height={10}
                  className="w-full"
                />
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
                    <div className="dashboard-stat-value">{thisWeekDoneCount}/{thisWeekTotalCount}</div>
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
                <Badge variant="peach" size="sm">{pendingToday.length} left</Badge>
              </div>
            }
            action={
              <div className="flex items-center gap-2">
                <AddTaskButton
                  subjects={subjectList}
                  initialDate={today}
                  buttonLabel="Quick add for today"
                  buttonClassName="ui-btn ui-btn-ghost ui-btn-sm min-h-[44px] md:min-h-0"
                />
                <Link href="/dashboard/calendar" className="text-xs font-medium min-h-[44px] flex items-center px-2 md:min-h-0 md:px-0" style={{ color: "var(--text-secondary)" }}>
                  Calendar →
                </Link>
              </div>
            }
          >
            <div>
              {todayTasks.length === 0 ? (
                <div className="dashboard-empty-state">
                  <svg className="w-8 h-8 mb-3" style={{ color: "var(--text-muted)" }} fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="dashboard-empty-title">No tasks scheduled</p>
                  <p className="dashboard-empty-text">Start by generating a plan or using quick add above</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="peach" size="sm">{pendingToday.length} Pending</Badge>
                    <Badge variant="mint" size="sm">{doneToday.length} Done</Badge>
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
                    <div className="max-h-[320px] overflow-y-auto -mx-1 px-1">
                      {visiblePendingTasks.map((task) => (
                        <div
                          key={task.id}
                          data-task-row
                          className="flex items-center gap-3 border-b border-subtle py-2.5 last:border-b-0 md:py-2 min-h-[44px]"
                        >
                          <DashboardTaskToggle taskId={task.id} mode="pending" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                              {task.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {task.task_type === "standalone"
                                  ? STANDALONE_SUBJECT_LABEL
                                  : (task.subject_id ? subjectNameById.get(task.subject_id) : null) ?? "Unknown"}
                              </span>
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{task.duration_minutes}m</span>
                              {task.session_number != null && task.total_sessions != null && task.total_sessions > 1 && (
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{task.session_number}/{task.total_sessions}</span>
                              )}
                              {task.session_type !== "core" && (
                                <Badge variant="neutral" size="sm">{task.session_type}</Badge>
                              )}
                            </div>
                          </div>
                          <DashboardTaskDelete taskId={task.id} />
                        </div>
                      ))}
                    </div>
                  )}

                  {hiddenPendingCount > 0 && (
                    <p className="text-[11px] font-medium mt-2" style={{ color: "var(--text-muted)" }}>
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
                        <Badge variant="mint" size="sm">{doneToday.length}</Badge>
                      </summary>
                      <div className="mt-3 space-y-1">
                        {doneTodaySorted.map((task) => (
                          <div key={task.id} data-task-row className="dashboard-task-completed min-h-[44px] md:min-h-0">
                            <DashboardTaskToggle taskId={task.id} mode="completed" />
                            <span className="dashboard-task-completed-title">{task.title}</span>
                            <span className="dashboard-task-completed-time">
                              {(
                                task.task_type === "standalone"
                                  ? STANDALONE_SUBJECT_LABEL
                                  : (task.subject_id ? subjectNameById.get(task.subject_id) : null) ?? "Unknown"
                              ).slice(0, 10)} · {task.duration_minutes}m
                            </span>
                            <DashboardTaskDelete taskId={task.id} />
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
        <div className="flex flex-col gap-[var(--gap-card)] md:gap-[var(--gap-card-md)]">
          {/* Alerts */}
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4v2m0 4v2M7 5h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2zm0 0V3a2 2 0 012-2h2a2 2 0 012 2v2" />
                </svg>
                <span>Alerts</span>
                <Badge variant={riskSignalCount === 0 ? "mint" : "rose"} size="sm">
                  {riskSignalCount === 0 ? "Clear" : `${riskSignalCount}`}
                </Badge>
              </div>
            }
          >
            {riskSignalCount === 0 ? (
              <div className="dashboard-alert-empty">
                <p className="dashboard-alert-empty-title">All systems go</p>
                <p className="dashboard-alert-empty-text">No deadlines at risk. Keep your momentum.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alertItems.map((alert) => {
                  const isDanger = alert.tone === "danger"
                  const bgClass = isDanger ? "dashboard-alert-rose" : "dashboard-alert-peach"
                  const iconBgClass = isDanger
                    ? "bg-[--pastel-rose]"
                    : alert.tone === "warning"
                      ? "bg-[--pastel-peach]"
                      : "bg-[--pastel-sky]"
                  const iconTextClass = isDanger
                    ? "text-[--pastel-rose-text]"
                    : alert.tone === "warning"
                      ? "text-[--pastel-peach-text]"
                      : "text-[--pastel-sky-text]"

                  return (
                    <div key={alert.id} className={`${bgClass} min-h-[44px] md:min-h-0`}>
                      <div className={`dashboard-alert-icon ${iconBgClass} ${iconTextClass}`}>
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
              <Link href="/dashboard/subjects" className="text-xs font-medium min-h-[44px] flex items-center px-2 md:min-h-0 md:px-0" style={{ color: "var(--text-secondary)" }}>
                All →
              </Link>
            }
          >
            {visibleSubjects.length === 0 ? (
              <div className="dashboard-empty-state">
                <p className="dashboard-empty-title">No subjects</p>
                <p className="dashboard-empty-text">Add subjects to start tracking progress</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleSubjects.map((subject) => {
                  const badge = HEALTH_BADGE[subject.health] ?? HEALTH_BADGE.no_deadline
                  const isOverdue = subject.health === "overdue"
                  const isWarn = subject.health === "at_risk" || subject.health === "behind"

                  const rowBg = isOverdue
                    ? "bg-[--pastel-rose]/40"
                    : isWarn
                      ? "bg-[--pastel-peach]/40"
                      : subject.percent >= 100
                        ? "bg-[--pastel-mint]/40"
                        : "bg-[--pastel-sky]/30"

                  return (
                    <div key={subject.id} className={`dashboard-subject-row ${rowBg} min-h-[44px] md:min-h-0`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="dashboard-subject-name">{subject.name}</p>
                          <Badge variant={badge.variant} size="sm">
                            {badge.label}
                          </Badge>
                        </div>
                        <span className="dashboard-subject-deadline">{formatDeadlineLabel(subject.daysLeft)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="dashboard-subject-meta">
                          {subject.completed_tasks}/{subject.total_tasks} tasks · {subject.percent}%
                        </span>
                        <Progress
                          value={subject.percent}
                          variant={getSubjectProgressVariant(subject)}
                          height={4}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  )
                })}

                {hiddenSubjectsCount > 0 && (
                  <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
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
