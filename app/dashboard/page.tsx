import { getStreak } from "@/app/actions/dashboard/getStreak"
import { getWeeklySnapshot } from "@/app/actions/dashboard/getWeeklySnapshot"
import { getBacklog } from "@/app/actions/dashboard/getBacklog"
import { getUpcomingDeadlines } from "@/app/actions/dashboard/getUpcomingDeadlines"
import { getSubjectProgress } from "@/app/actions/dashboard/getSubjectProgress"
import { getMonthTaskCounts } from "@/app/actions/dashboard/getMonthTaskCounts"
import { completeTask } from "@/app/actions/plan/completeTask"
import { Task } from "@/lib/types/db"
import { SubmitButton } from "@/app/components/SubmitButton"
import { QuickAddTask } from "./QuickAddTask"
import Link from "next/link"

function getWeekDays() {
  const days: string[] = []
  const cursor = new Date()
  const day = cursor.getDay()
  const diffToMonday = (day + 6) % 7
  cursor.setDate(cursor.getDate() - diffToMonday)
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    days.push(cursor.toISOString().split("T")[0])
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function weekdayShort(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function daysUntil(iso: string) {
  const diff = new Date(iso + "T12:00:00").getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86_400_000)
}

function urgencyColor(days: number) {
  if (days <= 3) return "text-red-400"
  if (days <= 7) return "text-amber-400"
  return "text-white/60"
}

export default async function DashboardPage() {
  const [streak, weekly, deadlines, backlog, progress, monthCounts] = await Promise.all([
    getStreak(),
    getWeeklySnapshot(),
    getUpcomingDeadlines(),
    getBacklog(),
    getSubjectProgress(),
    getMonthTaskCounts(),
  ])

  const streakData = streak.status === "SUCCESS" ? streak : null
  const tasks: Task[] = weekly.status === "SUCCESS" ? weekly.tasks : []
  const upcoming = deadlines.status === "SUCCESS" ? deadlines.subjects : []
  const missed: Task[] = backlog.status === "SUCCESS" ? backlog.tasks : []
  const subjectProgress = progress.status === "SUCCESS" ? progress.subjects : []

  const executionScore = (() => {
    if (subjectProgress.length === 0) return null
    const totalItems = subjectProgress.reduce((s, sp) => s + sp.total_items, 0)
    if (totalItems === 0) return 100
    const weightedSum = subjectProgress.reduce((s, sp) => s + sp.percent * sp.total_items, 0)
    return Math.round(weightedSum / totalItems)
  })()

  const monthDays = monthCounts.status === "SUCCESS" ? monthCounts.days : []
  const monthTaskMap = new Map(monthDays.map(d => [d.date, d]))
  const calYear = new Date().getFullYear()
  const calMonth = new Date().getMonth()
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const calFirstDayOfWeek = (new Date(calYear, calMonth, 1).getDay() + 6) % 7
  const calMonthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const today = new Date().toISOString().split("T")[0]
  const todayTasks = tasks.filter(t => t.scheduled_date === today)
  const pendingToday = todayTasks.filter(t => !t.completed)
  const doneToday = todayTasks.filter(t => t.completed)
  const totalMinutesLeft = pendingToday.reduce((s, t) => s + t.duration_minutes, 0)
  const backlogMinutes = missed.reduce((s, t) => s + t.duration_minutes, 0)

  const weekDays = getWeekDays()
  const tasksByDay = weekDays.map(d => ({
    date: d,
    count: tasks.filter(t => t.scheduled_date === d).length,
    done: tasks.filter(t => t.scheduled_date === d && t.completed).length,
  }))

  async function handleComplete(formData: FormData) {
    "use server"
    const taskId = formData.get("task_id")
    if (typeof taskId !== "string" || !taskId) return
    await completeTask(taskId)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-white/40 font-medium">{formatDate(today)}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {greeting} <span className="gradient-text">&#x2726;</span>
          </h1>
        </div>
        <Link href="/planner" className="btn-primary flex items-center gap-2 w-fit">
          <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Generate Plan
        </Link>
      </header>

      {/* Streak break warning */}
      {streakData && streakData.streak_current > 0 && pendingToday.length > 0 && doneToday.length === 0 && (
        <div className="warning-card px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <span className="text-xl">&#x1F525;</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Your {streakData.streak_current}-day streak is at risk!
              </p>
              <p className="text-xs text-amber-200/50 mt-0.5">
                Complete at least one task today to keep it going.
              </p>
            </div>
          </div>
          <a href="#todays-tasks" aria-label="Jump to today&#39;s tasks" className="shrink-0 px-4 py-2 bg-amber-500/90 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all hover:-translate-y-0.5">
            Start now
          </a>
        </div>
      )}

      {/* Deadline proximity alerts */}
      {(() => {
        const critical = upcoming.filter(s => {
          if (!s.deadline) return false
          const d = daysUntil(s.deadline)
          const pct = s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 100
          return (d <= 3 && pct < 80) || (d <= 7 && pct < 40)
        })
        if (critical.length === 0) return null
        return (
          <div className="danger-card px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              </div>
              <p className="text-sm font-semibold text-red-300">Deadline alerts</p>
            </div>
            <div className="space-y-1.5">
              {critical.map(s => {
                const d = daysUntil(s.deadline!)
                const pct = s.total_items > 0 ? Math.round((s.completed_items / s.total_items) * 100) : 0
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-white/70 truncate">{s.name}</span>
                    <span className={`shrink-0 font-semibold ${d <= 3 ? "text-red-400" : "text-amber-400"}`}>
                      {d <= 0 ? "Overdue" : `${d}d left`} &#xB7; {pct}% done
                    </span>
                  </div>
                )
              })}
            </div>
            <Link href="/planner" className="inline-block text-xs text-red-300/60 hover:text-red-200 transition-colors mt-1">
              Adjust plan &#x2192;
            </Link>
          </div>
        )
      })()}

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">

        {/* Stat: Streak */}
        <div className="gradient-card p-5 flex flex-col justify-between glow-accent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Streak</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <span className="text-base">&#x1F525;</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="stat-number text-4xl font-bold gradient-text">{streakData?.streak_current ?? 0}</div>
            <p className="text-xs text-white/30 mt-1">Best: {streakData?.streak_longest ?? 0} days</p>
          </div>
        </div>

        {/* Stat: Pending Today */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Pending</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="stat-number text-4xl font-bold">{pendingToday.length}</div>
            <p className="text-xs text-white/30 mt-1">{totalMinutesLeft} min remaining</p>
          </div>
        </div>

        {/* Stat: Completed Today */}
        <div className="emerald-card p-5 flex flex-col justify-between glow-emerald">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Completed</span>
            {todayTasks.length > 0 && (() => {
              const pct = Math.round((doneToday.length / todayTasks.length) * 100)
              const r = 16
              const c = 2 * Math.PI * r
              const offset = c - (c * pct) / 100
              return (
                <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0 -rotate-90">
                  <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle
                    cx="20" cy="20" r={r} fill="none"
                    stroke={pct === 100 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171"}
                    strokeWidth="3"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                  <text
                    x="20" y="20"
                    textAnchor="middle" dominantBaseline="central"
                    className="fill-white text-[9px] font-bold rotate-90 origin-center"
                  >
                    {pct}%
                  </text>
                </svg>
              )
            })()}
          </div>
          <div className="mt-3">
            <div className="stat-number text-4xl font-bold gradient-text-emerald">{doneToday.length}</div>
            <p className="text-xs text-white/30 mt-1">of {todayTasks.length} tasks</p>
          </div>
        </div>

        {/* Stat: Backlog */}
        <div className={`glass-card p-5 flex flex-col justify-between ${missed.length > 0 ? "border-red-500/15" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Backlog</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${missed.length > 0 ? "bg-red-500/10" : "bg-white/5"}`}>
              <svg className={`w-4 h-4 ${missed.length > 0 ? "text-red-400" : "text-white/30"}`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div className="mt-3">
            <div className={`stat-number text-4xl font-bold ${missed.length > 0 ? "text-red-400" : ""}`}>{missed.length}</div>
            <p className="text-xs text-white/30 mt-1">{backlogMinutes} min overdue</p>
          </div>
        </div>

        {/* Execution Score (span 2 cols) */}
        {executionScore !== null && (
          <div className="glass-card p-5 md:col-span-2 flex items-center gap-6">
            <div className="relative w-20 h-20 shrink-0">
              {(() => {
                const r = 34
                const c = 2 * Math.PI * r
                const offset = c - (c * executionScore) / 100
                const color = executionScore >= 70 ? "#34d399" : executionScore >= 40 ? "#fbbf24" : "#f87171"
                return (
                  <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                    <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r={r} fill="none"
                      stroke={color}
                      strokeWidth="6"
                      strokeDasharray={c}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                )
              })()}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`stat-number text-xl font-bold ${executionScore >= 70 ? "text-emerald-400" : executionScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                  {executionScore}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white/80">Execution Score</h3>
              <p className="text-xs text-white/40 mt-1">
                Weighted average progress across {subjectProgress.length} subject{subjectProgress.length !== 1 ? "s" : ""}.
                {executionScore >= 70 ? " You're on track!" : executionScore >= 40 ? " Keep pushing." : " Falling behind - consider adjusting your plan."}
              </p>
              <Link href="/dashboard/subjects" className="inline-block text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors">
                View all subjects &#x2192;
              </Link>
            </div>
          </div>
        )}

        {/* Weekly Strip (span 2 cols) */}
        <div className="glass-card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/70">This Week</h2>
            <Link href="/dashboard/calendar" className="text-xs text-white/40 hover:text-indigo-400 transition-colors">
              Full calendar &#x2192;
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {tasksByDay.map(({ date, count, done }) => {
              const isToday = date === today
              const pct = count > 0 ? Math.round((done / count) * 100) : 0
              return (
                <div
                  key={date}
                  className={`rounded-xl p-3 text-center space-y-1.5 transition-all ${
                    isToday
                      ? "gradient-card glow-accent"
                      : "bg-white/[0.02] border border-white/[0.04] hover:border-white/10"
                  }`}
                >
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-indigo-300" : "text-white/30"}`}>
                    {weekdayShort(date)}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? "text-white" : count > 0 ? "text-white/80" : "text-white/15"}`}>
                    {count > 0 ? count : "&#xB7;"}
                  </div>
                  {count > 0 && (
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`h-1 rounded-full transition-all duration-500 ${pct === 100 ? "progress-emerald" : pct >= 50 ? "progress-amber" : "progress-red"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Today's Tasks (tall, span 2 rows) */}
        <div className="glass-card p-5 md:col-span-2 lg:row-span-2 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 id="todays-tasks" className="text-base font-bold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse-glow" />
              Today&apos;s Tasks
            </h2>
            <span className="text-xs text-white/30">{pendingToday.length} remaining</span>
          </div>

          <QuickAddTask subjects={subjectProgress.map(s => ({ id: s.id, name: s.name }))} />

          <div className="flex-1 overflow-y-auto space-y-2 -mr-2 pr-2">
            {todayTasks.length === 0 && (
              <div className="text-center py-10 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                  <span className="text-2xl">&#x2728;</span>
                </div>
                <p className="text-sm text-white/40">Nothing scheduled for today.</p>
                <Link href="/planner" className="btn-primary inline-block text-xs">
                  Generate a plan
                </Link>
              </div>
            )}

            {pendingToday.map(task => (
              <form key={task.id} action={handleComplete} className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/[0.08] rounded-xl p-3.5 transition-all group">
                <input type="hidden" name="task_id" value={task.id} />
                <SubmitButton
                  className="w-5 h-5 shrink-0 rounded-full border-2 border-white/20 group-hover:border-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-wait"
                  aria-label="Mark complete"
                >
                  <span className="sr-only">Complete</span>
                </SubmitButton>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white/85 truncate">{task.title}</div>
                  <div className="text-xs text-white/30 mt-0.5">{task.duration_minutes} min</div>
                </div>
                <span className="text-[10px] font-medium text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-md">P{task.priority}</span>
              </form>
            ))}

            {doneToday.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Completed</div>
                {doneToday.map(task => (
                  <div key={task.id} className="flex items-center gap-3 bg-white/[0.015] rounded-xl p-3.5 opacity-40">
                    <div className="w-5 h-5 shrink-0 rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/50 truncate line-through">{task.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plan Health (span 2 cols) */}
        <div className="glass-card p-5 md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">Plan Health</h2>
            <Link href="/dashboard/subjects" className="text-xs text-white/40 hover:text-indigo-400 transition-colors">
              All subjects &#x2192;
            </Link>
          </div>

          {subjectProgress.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
                <span className="text-xl">&#x1F4CA;</span>
              </div>
              <p className="text-sm text-white/40">No subjects yet.</p>
              <Link href="/dashboard/subjects" className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors">Add subjects</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {subjectProgress.map(subject => {
                const healthColor =
                  subject.health === "on_track" ? "progress-emerald"
                  : subject.health === "behind" ? "progress-amber"
                  : "progress-red"
                const healthLabel =
                  subject.health === "on_track" ? "On track"
                  : subject.health === "behind" ? "Behind"
                  : subject.health === "at_risk" ? "At risk"
                  : "Overdue"
                const healthTextColor =
                  subject.health === "on_track" ? "text-emerald-400"
                  : subject.health === "behind" ? "text-amber-400"
                  : "text-red-400"
                const healthBg =
                  subject.health === "on_track" ? "bg-emerald-500/10"
                  : subject.health === "behind" ? "bg-amber-500/10"
                  : "bg-red-500/10"

                return (
                  <div key={subject.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-white/85 truncate">{subject.name}</span>
                        {subject.mandatory && (
                          <span className="text-[9px] bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded-md font-semibold shrink-0">REQ</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold ${healthTextColor} ${healthBg} px-2 py-0.5 rounded-md`}>{healthLabel}</span>
                        <span className="text-[10px] text-white/25">
                          {subject.daysLeft === 0 ? "Today" : subject.daysLeft < 0 ? `${Math.abs(subject.daysLeft)}d over` : `${subject.daysLeft}d`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${healthColor}`}
                          style={{ width: `${subject.percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/30 w-10 text-right font-mono">{subject.percent}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mini Calendar */}
        <div className="glass-card p-5 md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">{calMonthLabel}</h2>
            <Link href="/dashboard/calendar" className="text-xs text-white/40 hover:text-indigo-400 transition-colors">
              Full calendar &#x2192;
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div key={i} className="text-[9px] text-white/20 font-semibold uppercase tracking-wider pb-1">{d}</div>
            ))}
            {Array.from({ length: calFirstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: calDaysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
              const entry = monthTaskMap.get(dateStr)
              const isToday = dateStr === today
              const count = entry?.count ?? 0
              const completed = entry?.completed ?? 0
              const allDone = count > 0 && completed === count

              return (
                <Link
                  key={dayNum}
                  href={`/dashboard/calendar?week=${dateStr}`}
                  className={`relative rounded-lg p-1.5 text-xs transition-all hover:bg-white/[0.06] ${
                    isToday
                      ? "bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 font-bold"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <span>{dayNum}</span>
                  {count > 0 && (
                    <div className="flex justify-center gap-[2px] mt-0.5">
                      {Array.from({ length: Math.min(count, 4) }).map((_, di) => (
                        <div
                          key={di}
                          className={`w-1 h-1 rounded-full ${allDone ? "bg-emerald-400" : isToday ? "bg-indigo-400" : "bg-white/20"}`}
                        />
                      ))}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="glass-card p-5 md:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-white/70">Upcoming Deadlines</h2>

          {upcoming.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                <span className="text-xl">&#x1F4C5;</span>
              </div>
              <p className="text-sm text-white/40">No subjects with deadlines.</p>
              <Link href="/dashboard/subjects" className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors">Add subjects</Link>
            </div>
          )}

          <div className="space-y-2">
            {upcoming.map(subject => {
              const days = subject.deadline ? daysUntil(subject.deadline) : null
              const pct = subject.total_items > 0 ? Math.round((subject.completed_items / subject.total_items) * 100) : 0
              return (
                <div key={subject.id} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 space-y-2 hover:border-white/[0.08] transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white/85 truncate">{subject.name}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{subject.deadline ?? "No deadline"}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-white/30 font-mono">{pct}%</span>
                      {days !== null && (
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          days <= 3 ? "bg-red-500/15 text-red-400"
                          : days <= 7 ? "bg-amber-500/15 text-amber-400"
                          : "bg-white/[0.04] text-white/40"
                        }`}>
                          {days === 0 ? "Today" : days < 0 ? "Overdue" : `${days}d`}
                        </div>
                      )}
                    </div>
                  </div>
                  {subject.total_items > 0 && (
                    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-1 rounded-full transition-all duration-500 ${
                          pct >= 80 ? "progress-emerald" : pct >= 50 ? "progress-amber" : "progress-red"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Backlog reschedule banner */}
      {missed.length >= 5 && (
        <div className="warning-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-amber-300">Backlog growing &#x2014; {missed.length} overdue tasks</h2>
            <p className="text-sm text-amber-200/50">
              Consider regenerating your plan to redistribute remaining work.
            </p>
          </div>
          <Link
            href="/planner"
            className="shrink-0 px-5 py-2.5 bg-amber-500/90 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-all hover:-translate-y-0.5"
          >
            Regenerate Plan
          </Link>
        </div>
      )}

      {/* Backlog detail */}
      {missed.length > 0 && missed.length < 5 && (
        <div className="danger-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-red-300">Backlog &#x2014; {missed.length} overdue</h2>
            <Link href="/dashboard/calendar" className="text-xs text-white/40 hover:text-white transition-colors">
              View calendar &#x2192;
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {missed.slice(0, 6).map(task => (
              <div key={task.id} className="bg-white/[0.02] rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white/70 truncate">{task.title}</div>
                  <div className="text-[10px] text-red-400/50">{task.scheduled_date}</div>
                </div>
                <div className="text-[10px] text-white/30 shrink-0">{task.duration_minutes}m</div>
              </div>
            ))}
          </div>
          {missed.length > 6 && (
            <p className="text-xs text-white/25">+{missed.length - 6} more in calendar</p>
          )}
        </div>
      )}
    </div>
  )
}
