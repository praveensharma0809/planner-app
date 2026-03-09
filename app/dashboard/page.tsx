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
import { Task } from "@/lib/types/db"

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
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

  const streakData = streak.status === "SUCCESS" ? streak : null
  const tasks: Task[] = weekly.status === "SUCCESS" ? weekly.tasks : []
  const subjects = subjectProgress.status === "SUCCESS" ? subjectProgress.subjects : []
  const backlogTasks: Task[] = backlog.status === "SUCCESS" ? backlog.tasks : []
  const executionData = executionRes.status === "SUCCESS" ? executionRes.data : null

  const { data: { user } } = await supabase.auth.getUser()
  const subjectList = user
    ? (await supabase.from("subjects").select("id, name").eq("user_id", user.id).order("name")).data ?? []
    : []

  const today = new Date().toISOString().split("T")[0]
  const todayTasks = tasks.filter(t => t.scheduled_date === today)
  const pendingToday = todayTasks.filter(t => !t.completed)
  const doneToday = todayTasks.filter(t => t.completed)

  const thisWeekPendingMinutes = tasks
    .filter(t => !t.completed)
    .reduce((sum, t) => sum + t.duration_minutes, 0)

  const thisWeekDoneCount = tasks.filter(t => t.completed).length
  const thisWeekTotalCount = tasks.length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const todayProgressPercent = todayTasks.length > 0 ? Math.round((doneToday.length / todayTasks.length) * 100) : 0

  async function handleComplete(formData: FormData) {
    "use server"
    const taskId = formData.get("task_id")
    if (typeof taskId !== "string" || !taskId) return
    await completeTask(taskId)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* ── Header with inline stats ── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs text-white/30 font-medium tracking-wide">{formatDate(today)}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">{greeting}</h1>
          {/* Compact inline stats */}
          <div className="flex flex-wrap items-center gap-3 mt-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-orange-400">&#128293;</span>
              <span className="font-semibold text-white/80">{streakData?.streak_current ?? 0}</span>
              <span className="text-white/25">day streak</span>
            </div>
            <span className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span className="font-semibold text-white/80">{doneToday.length}/{todayTasks.length}</span>
              <span className="text-white/25">today</span>
            </div>
            <span className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="font-semibold text-white/80">{thisWeekDoneCount}/{thisWeekTotalCount}</span>
              <span className="text-white/25">this week</span>
            </div>
            <span className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-semibold text-white/80">{Math.round(thisWeekPendingMinutes / 60 * 10) / 10}h</span>
              <span className="text-white/25">remaining</span>
            </div>
            {backlogTasks.length > 0 && (
              <>
                <span className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="font-semibold text-red-400/80">{backlogTasks.length}</span>
                  <span className="text-white/25">overdue</span>
                </div>
              </>
            )}
          </div>
        </div>
        <Link href="/planner" className="btn-primary w-fit shrink-0 !py-2.5 !px-5 !text-sm">
          Generate Plan
        </Link>
      </header>

      {/* ── Today's progress bar ── */}
      {todayTasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/30">Today&apos;s progress</span>
            <span className="text-white/40 font-medium">{todayProgressPercent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                todayProgressPercent === 100
                  ? "progress-emerald"
                  : todayProgressPercent >= 50
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                    : "bg-gradient-to-r from-indigo-500/60 to-purple-500/60"
              }`}
              style={{ width: `${todayProgressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── LEFT COLUMN: Tasks + Execution ── */}
        <div className="xl:col-span-2 space-y-5">
          {/* Backlog warning */}
          {backlogTasks.length > 0 && (
            <div className="danger-card p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-400/90">{backlogTasks.length} overdue task{backlogTasks.length !== 1 ? "s" : ""}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  {backlogTasks.reduce((sum, t) => sum + t.duration_minutes, 0)} min of missed work &mdash; consider rescheduling in the planner.
                </p>
                <Link href="/planner" className="inline-block mt-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors">
                  Advanced options in Planner &rarr;
                </Link>
              </div>
              <RescheduleMissedButton />
            </div>
          )}

          {/* Today's Tasks */}
          <section className="rounded-xl border border-white/5 bg-transparent p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Today&apos;s Tasks
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/25">{pendingToday.length} remaining</span>
                <Link href="/dashboard/calendar" className="text-xs text-indigo-400/50 hover:text-indigo-400 transition-colors">
                  Calendar
                </Link>
              </div>
            </div>

            <QuickAddTask subjects={subjectList} />

            {todayTasks.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-white/15" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="text-sm text-white/35">No tasks scheduled for today.</p>
                <Link href="/planner" className="btn-primary inline-block !text-xs !py-2 !px-4">
                  Generate a plan
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingToday.map((task) => (
                  <form key={task.id} action={handleComplete} className="group flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.08] rounded-xl p-3 transition-all duration-200">
                    <input type="hidden" name="task_id" value={task.id} />
                    <SubmitButton
                      className="w-5 h-5 shrink-0 rounded-full border-2 border-white/15 hover:border-indigo-400 hover:bg-indigo-400/10 transition-all disabled:opacity-40 disabled:cursor-wait flex items-center justify-center"
                      aria-label="Mark complete"
                    >
                      <span className="sr-only">Complete</span>
                    </SubmitButton>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/80 group-hover:text-white/90 truncate transition-colors">{task.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-white/25">{task.duration_minutes} min</span>
                        {task.session_type !== "core" && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            task.session_type === "revision" ? "bg-amber-500/10 text-amber-400/60" : "bg-blue-500/10 text-blue-400/60"
                          }`}>{task.session_type}</span>
                        )}
                        {task.is_plan_generated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400/50">plan</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-white/20 font-medium">P{task.priority}</span>
                  </form>
                ))}

                {doneToday.length > 0 && (
                  <div className="pt-3 mt-1 border-t border-white/[0.04] space-y-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-white/20 font-medium">Completed ({doneToday.length})</p>
                    {doneToday.map(task => (
                      <div key={task.id} className="flex items-center gap-3 px-1.5 py-1.5">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </div>
                        <span className="text-sm text-white/30 line-through truncate">{task.title}</span>
                        <span className="text-[10px] text-white/15 ml-auto">{task.duration_minutes}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Execution Widget */}
          {executionData && <ExecutionWidget data={executionData} />}
        </div>

        {/* ── RIGHT COLUMN: Subject Progress + Plan History ── */}
        <div className="space-y-5">
          {/* Subject Progress */}
          <section className="rounded-xl border border-white/5 bg-transparent p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Subject Progress
              </h2>
              <Link href="/dashboard/subjects" className="text-xs text-white/30 hover:text-white/60 transition-colors">
                All subjects
              </Link>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-white/35">No subjects yet.</p>
                <Link href="/dashboard/subjects" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                  Add subjects &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {subjects.map(subj => {
                  const healthColors: Record<string, string> = {
                    on_track: "text-emerald-400 bg-emerald-500/10",
                    behind: "text-amber-400 bg-amber-500/10",
                    at_risk: "text-orange-400 bg-orange-500/10",
                    overdue: "text-red-400 bg-red-500/10",
                    no_deadline: "text-white/30 bg-white/[0.04]",
                  }
                  const healthLabels: Record<string, string> = {
                    on_track: "On track",
                    behind: "Behind",
                    at_risk: "At risk",
                    overdue: "Overdue",
                    no_deadline: "No deadline",
                  }
                  const progressColor = subj.health === "overdue" ? "progress-red"
                    : subj.health === "at_risk" ? "progress-amber"
                    : subj.percent >= 70 ? "progress-emerald"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500"

                  return (
                    <div key={subj.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-white/75 truncate">{subj.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${healthColors[subj.health]}`}>
                            {healthLabels[subj.health]}
                          </span>
                        </div>
                        <span className="text-xs text-white/40 font-medium tabular-nums shrink-0">{subj.percent}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${Math.max(subj.percent, 2)}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-white/20">
                        <span>{subj.completed_tasks}/{subj.total_tasks} tasks</span>
                        {subj.daysLeft !== null && (
                          <span className={subj.daysLeft < 0 ? "text-red-400/60" : subj.daysLeft <= 3 ? "text-amber-400/60" : ""}>
                            {subj.daysLeft < 0 ? `${Math.abs(subj.daysLeft)}d overdue` : subj.daysLeft === 0 ? "Due today" : `${subj.daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Plan History */}
          <PlanHistory />

          {/* Quick Insights */}
          <section className="rounded-xl border border-white/5 bg-transparent p-5 space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Insights
            </h2>
            <div className="space-y-2 text-xs">
              {streakData && streakData.streak_current > 0 && (
                <div className="flex items-start gap-2 bg-white/[0.02] rounded-lg p-2.5">
                  <span className="text-orange-400 mt-0.5">&#128293;</span>
                  <div>
                    <span className="text-white/60">You&apos;re on a </span>
                    <span className="text-orange-400 font-semibold">{streakData.streak_current}-day</span>
                    <span className="text-white/60"> streak! Best: {streakData.streak_longest} days.</span>
                  </div>
                </div>
              )}
              {todayTasks.length > 0 && pendingToday.length === 0 && (
                <div className="flex items-start gap-2 bg-emerald-500/[0.04] rounded-lg p-2.5">
                  <span className="text-emerald-400 mt-0.5">&#10003;</span>
                  <span className="text-emerald-400/70">All tasks complete for today! Great work.</span>
                </div>
              )}
              {pendingToday.length > 0 && (
                <div className="flex items-start gap-2 bg-white/[0.02] rounded-lg p-2.5">
                  <span className="text-indigo-400 mt-0.5">&#9679;</span>
                  <span className="text-white/50">
                    {pendingToday.reduce((s, t) => s + t.duration_minutes, 0)} minutes of study remaining today across {pendingToday.length} task{pendingToday.length !== 1 ? "s" : ""}.
                  </span>
                </div>
              )}
              {subjects.filter(s => s.health === "at_risk" || s.health === "overdue").length > 0 && (
                <div className="flex items-start gap-2 bg-red-500/[0.04] rounded-lg p-2.5">
                  <span className="text-red-400 mt-0.5">&#9888;</span>
                  <span className="text-red-400/60">
                    {subjects.filter(s => s.health === "at_risk" || s.health === "overdue").length} subject{subjects.filter(s => s.health === "at_risk" || s.health === "overdue").length !== 1 ? "s" : ""} need attention &mdash; consider adjusting your plan.
                  </span>
                </div>
              )}
              {thisWeekTotalCount === 0 && (
                <div className="flex items-start gap-2 bg-white/[0.02] rounded-lg p-2.5">
                  <span className="text-indigo-400 mt-0.5">&#128161;</span>
                  <span className="text-white/40">No tasks planned this week. <Link href="/planner" className="text-indigo-400 hover:text-indigo-300">Generate a plan</Link> to get started.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
