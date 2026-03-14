import Link from "next/link"
import { getStreak } from "@/app/actions/dashboard/getStreak"
import { getWeeklySnapshot } from "@/app/actions/dashboard/getWeeklySnapshot"
import { getSubjectProgress } from "@/app/actions/dashboard/getSubjectProgress"
import { getBacklog } from "@/app/actions/dashboard/getBacklog"
import { getExecutionMonth } from "@/app/actions/execution/getExecutionMonth"
import { completeTask } from "@/app/actions/plan/completeTask"
import { SubmitButton } from "@/app/components/SubmitButton"
import { QuickAddTask } from "./QuickAddTask"
import { PlanHistory } from "./PlanHistory"
import { ExecutionWidget } from "./ExecutionWidget"
import { RescheduleMissedButton } from "./RescheduleMissedButton"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Task } from "@/lib/types/db"
import { Button } from "@/app/components/ui"
import { Badge } from "@/app/components/ui"
import { Progress } from "@/app/components/ui"
import { PageHeader } from "@/app/components/layout/PageHeader"
import { StatsRow } from "@/app/components/layout/StatsRow"
import { ContentGrid } from "@/app/components/layout/ContentGrid"
import { SectionCard } from "@/app/components/layout/SectionCard"

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

const HEALTH_BADGE: Record<string, { variant: "success" | "warning" | "danger" | "default"; label: string }> = {
  on_track:    { variant: "success", label: "On track"    },
  behind:      { variant: "warning", label: "Behind"      },
  at_risk:     { variant: "warning", label: "At risk"     },
  overdue:     { variant: "danger",  label: "Overdue"     },
  no_deadline: { variant: "default", label: "No deadline" },
}

export default async function DashboardPage() {
  const [streak, weekly, subjectProgress, backlog, executionRes, supabase] = await Promise.all([
    getStreak(),
    getWeeklySnapshot(),
    getSubjectProgress(),
    getBacklog(),
    getExecutionMonth(),
    createServerSupabaseClient(),
  ])

  const streakData      = streak.status === "SUCCESS" ? streak : null
  const tasks: Task[]   = weekly.status === "SUCCESS" ? weekly.tasks : []
  const subjects        = subjectProgress.status === "SUCCESS" ? subjectProgress.subjects : []
  const backlogTasks: Task[] = backlog.status === "SUCCESS" ? backlog.tasks : []
  const executionData   = executionRes.status === "SUCCESS" ? executionRes.data : null

  const { data: { user } } = await supabase.auth.getUser()
  const subjectList = user
    ? (await supabase.from("subjects").select("id, name").eq("user_id", user.id).order("name")).data ?? []
    : []

  const today = new Date().toISOString().split("T")[0]
  const todayTasks    = tasks.filter(t => t.scheduled_date === today)
  const pendingToday  = todayTasks.filter(t => !t.completed)
  const doneToday     = todayTasks.filter(t => t.completed)

  const thisWeekPendingMinutes = tasks.filter(t => !t.completed).reduce((sum, t) => sum + t.duration_minutes, 0)
  const thisWeekDoneCount  = tasks.filter(t => t.completed).length
  const thisWeekTotalCount = tasks.length

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const todayProgressPercent = todayTasks.length > 0
    ? Math.round((doneToday.length / todayTasks.length) * 100)
    : 0

  const todayProgressVariant =
    todayProgressPercent === 100 ? "success"
    : todayProgressPercent >= 50 ? "default"
    : "default"

  async function handleComplete(formData: FormData) {
    "use server"
    const taskId = formData.get("task_id")
    if (typeof taskId !== "string" || !taskId) return
    await completeTask(taskId)
  }

  return (
    <div className="page-root animate-fade-in">

      {/* â”€â”€ Header â”€â”€ */}
      <PageHeader
        eyebrow={formatDate(today)}
        title={greeting}
        actions={
          <Link href="/planner">
            <Button variant="primary" size="md">Generate Plan</Button>
          </Link>
        }
      />

      {/* â”€â”€ Stats Row â”€â”€ */}
      <StatsRow
        stats={[
          { label: "day streak",    value: streakData?.streak_current ?? 0,  dotColor: "bg-orange-400" },
          { label: "today",         value: `${doneToday.length}/${todayTasks.length}`,    dotColor: "bg-indigo-400" },
          { label: "this week",     value: `${thisWeekDoneCount}/${thisWeekTotalCount}`,  dotColor: "bg-purple-400" },
          { label: "hrs remaining", value: `${Math.round(thisWeekPendingMinutes / 60 * 10) / 10}h`, dotColor: "bg-emerald-400" },
          ...(backlogTasks.length > 0
            ? [{ label: "overdue", value: backlogTasks.length, dotColor: "bg-red-400" }]
            : []),
        ]}
      />

      {/* â”€â”€ Today progress bar â”€â”€ */}
      {todayTasks.length > 0 && (
        <div className="space-y-1.5 mb-6">
          <div className="flex items-center justify-between text-[11px]">
            <span style={{ color: "var(--sh-text-muted)" }}>Today&apos;s progress</span>
            <span className="font-medium" style={{ color: "var(--sh-text-muted)" }}>{todayProgressPercent}%</span>
          </div>
          <Progress value={todayProgressPercent} variant={todayProgressVariant} height={6} />
        </div>
      )}

      {/* â”€â”€ Backlog warning â”€â”€ */}
      {backlogTasks.length > 0 && (
        <div className="mb-6 rounded-xl p-4 flex items-start gap-3 border border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.06)]">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">
              {backlogTasks.length} overdue task{backlogTasks.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sh-text-muted)" }}>
              {backlogTasks.reduce((sum, t) => sum + t.duration_minutes, 0)} min of missed work â€” consider rescheduling in the planner.
            </p>
            <Link href="/planner" className="inline-block mt-1.5 text-[11px] text-indigo-400/70 hover:text-indigo-300 transition-colors">
              Advanced options in Planner â†’
            </Link>
          </div>
          <RescheduleMissedButton />
        </div>
      )}

      {/* â”€â”€ Main content grid â”€â”€ */}
      <ContentGrid layout="main-aside">

        {/* â”€â”€ Left column â”€â”€ */}
        <div className="space-y-5">

          {/* Today's Tasks */}
          <SectionCard
            title={
              <>
                <svg className="w-4 h-4 text-indigo-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Today&apos;s Tasks
              </>
            }
            action={
              <div className="flex items-center gap-3">
                <span>{pendingToday.length} remaining</span>
                <Link href="/dashboard/calendar" className="hover:text-indigo-400 transition-colors">Calendar â†’</Link>
              </div>
            }
          >
            <QuickAddTask subjects={subjectList} />

            {todayTasks.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--sh-border)" }}>
                  <svg className="w-6 h-6" style={{ color: "var(--sh-text-muted)" }} fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "var(--sh-text-muted)" }}>No tasks scheduled for today.</p>
                <Link href="/planner">
                  <Button variant="primary" size="sm">Generate a plan</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingToday.map((task) => (
                  <form key={task.id} action={handleComplete}
                    className="group flex items-center gap-3 rounded-xl p-3 transition-all duration-150 border"
                    style={{ background: "var(--sh-card)", borderColor: "var(--sh-border)" }}
                  >
                    <input type="hidden" name="task_id" value={task.id} />
                    <SubmitButton
                      className="w-5 h-5 shrink-0 rounded-full border-2 border-white/15 hover:border-indigo-400 hover:bg-indigo-400/10 transition-all disabled:opacity-40 disabled:cursor-wait flex items-center justify-center"
                      aria-label="Mark complete"
                    >
                      <span className="sr-only">Complete</span>
                    </SubmitButton>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: "var(--sh-text-primary)" }}>
                        {task.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>{task.duration_minutes} min</span>
                        {task.session_type !== "core" && (
                          <Badge variant={task.session_type === "revision" ? "warning" : "primary"} size="sm">
                            {task.session_type}
                          </Badge>
                        )}
                        {task.is_plan_generated && (
                          <Badge variant="accent" size="sm">plan</Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: "var(--sh-text-muted)" }}>P{task.priority}</span>
                  </form>
                ))}

                {doneToday.length > 0 && (
                  <div className="pt-3 mt-1 border-t space-y-1.5" style={{ borderColor: "var(--sh-border)" }}>
                    <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "var(--sh-text-muted)" }}>
                      Completed ({doneToday.length})
                    </p>
                    {doneToday.map(task => (
                      <div key={task.id} className="flex items-center gap-3 px-1.5 py-1.5">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-sm line-through truncate" style={{ color: "var(--sh-text-muted)" }}>{task.title}</span>
                        <span className="text-[10px] ml-auto" style={{ color: "var(--sh-text-muted)" }}>{task.duration_minutes}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Execution / Habits Widget */}
          {executionData && <ExecutionWidget data={executionData} />}
        </div>

        {/* â”€â”€ Right column â”€â”€ */}
        <div className="space-y-5">

          {/* Subject Progress */}
          <SectionCard
            title={
              <>
                <svg className="w-4 h-4 text-purple-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Subject Progress
              </>
            }
            action={
              <Link href="/dashboard/subjects" className="hover:text-indigo-400 transition-colors">All subjects â†’</Link>
            }
          >
            {subjects.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm" style={{ color: "var(--sh-text-muted)" }}>No subjects yet.</p>
                <Link href="/dashboard/subjects" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                  Add subjects â†’
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {subjects.map(subj => {
                  const badge = HEALTH_BADGE[subj.health] ?? HEALTH_BADGE.no_deadline
                  const progressVariant =
                    subj.health === "overdue" ? "danger"
                    : subj.health === "at_risk" ? "warning"
                    : subj.percent >= 70 ? "success" : "default"
                  return (
                    <div key={subj.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate" style={{ color: "var(--sh-text-primary)" }}>
                            {subj.name}
                          </span>
                          <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                        </div>
                        <span className="text-xs font-medium tabular-nums shrink-0" style={{ color: "var(--sh-text-secondary)" }}>
                          {subj.percent}%
                        </span>
                      </div>
                      <Progress value={subj.percent} variant={progressVariant} height={5} />
                      <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
                        <span>{subj.completed_tasks}/{subj.total_tasks} tasks</span>
                        {subj.daysLeft !== null && (
                          <span className={subj.daysLeft < 0 ? "text-red-400/70" : subj.daysLeft <= 3 ? "text-amber-400/70" : ""}>
                            {subj.daysLeft < 0 ? `${Math.abs(subj.daysLeft)}d overdue`
                              : subj.daysLeft === 0 ? "Due today"
                              : `${subj.daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Plan History */}
          <PlanHistory />

          {/* Insights */}
          <SectionCard
            title={
              <>
                <svg className="w-4 h-4 text-amber-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Insights
              </>
            }
          >
            <div className="space-y-2 text-xs">
              {streakData && streakData.streak_current > 0 && (
                <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="text-orange-400 mt-0.5">ðŸ”¥</span>
                  <div>
                    <span style={{ color: "var(--sh-text-secondary)" }}>You&apos;re on a </span>
                    <span className="text-orange-400 font-semibold">{streakData.streak_current}-day</span>
                    <span style={{ color: "var(--sh-text-secondary)" }}> streak! Best: {streakData.streak_longest} days.</span>
                  </div>
                </div>
              )}
              {todayTasks.length > 0 && pendingToday.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg p-2.5 bg-emerald-500/[0.04]">
                  <span className="text-emerald-400 mt-0.5">âœ“</span>
                  <span className="text-emerald-400/80">All tasks complete for today! Great work.</span>
                </div>
              )}
              {pendingToday.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="text-indigo-400 mt-0.5">â—</span>
                  <span style={{ color: "var(--sh-text-secondary)" }}>
                    {pendingToday.reduce((s, t) => s + t.duration_minutes, 0)} minutes remaining today across {pendingToday.length} task{pendingToday.length !== 1 ? "s" : ""}.
                  </span>
                </div>
              )}
              {subjects.filter(s => s.health === "at_risk" || s.health === "overdue").length > 0 && (
                <div className="flex items-start gap-2 rounded-lg p-2.5 bg-red-500/[0.04]">
                  <span className="text-red-400 mt-0.5">âš </span>
                  <span className="text-red-400/70">
                    {subjects.filter(s => s.health === "at_risk" || s.health === "overdue").length} subject{subjects.filter(s => s.health === "at_risk" || s.health === "overdue").length !== 1 ? "s" : ""} need attention â€” consider adjusting your plan.
                  </span>
                </div>
              )}
              {thisWeekTotalCount === 0 && (
                <div className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="text-indigo-400 mt-0.5">ðŸ’¡</span>
                  <span style={{ color: "var(--sh-text-muted)" }}>
                    No tasks planned this week.{" "}
                    <Link href="/planner" className="text-indigo-400 hover:text-indigo-300">Generate a plan</Link>
                    {" "}to get started.
                  </span>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </ContentGrid>
    </div>
  )
}
