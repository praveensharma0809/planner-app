import Link from "next/link"
import { getStreak } from "@/app/actions/dashboard/getStreak"
import { getWeeklySnapshot } from "@/app/actions/dashboard/getWeeklySnapshot"
import { getUpcomingDeadlines } from "@/app/actions/dashboard/getUpcomingDeadlines"
import { completeTask } from "@/app/actions/plan/completeTask"
import { SubmitButton } from "@/app/components/SubmitButton"
import { QuickAddTask } from "./QuickAddTask"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { Task } from "@/lib/types/db"

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function daysUntil(iso: string) {
  const diff = new Date(iso + "T12:00:00").getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86_400_000)
}

export default async function DashboardPage() {
  const [streak, weekly, deadlines, supabase] = await Promise.all([
    getStreak(),
    getWeeklySnapshot(),
    getUpcomingDeadlines(),
    createServerSupabaseClient(),
  ])

  const streakData = streak.status === "SUCCESS" ? streak : null
  const tasks: Task[] = weekly.status === "SUCCESS" ? weekly.tasks : []
  const upcoming = deadlines.status === "SUCCESS" ? deadlines.deadlines : []

  const { data: { user } } = await supabase.auth.getUser()
  const subjects = user
    ? (await supabase.from("subjects").select("id, name").eq("user_id", user.id).order("name")).data ?? []
    : []

  const today = new Date().toISOString().split("T")[0]
  const todayTasks = tasks.filter(t => t.scheduled_date === today)
  const pendingToday = todayTasks.filter(t => !t.completed)
  const doneToday = todayTasks.filter(t => t.completed)

  const thisWeekPendingMinutes = tasks
    .filter(t => !t.completed)
    .reduce((sum, t) => sum + t.duration_minutes, 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  async function handleComplete(formData: FormData) {
    "use server"
    const taskId = formData.get("task_id")
    if (typeof taskId !== "string" || !taskId) return
    await completeTask(taskId)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-white/40 font-medium">{formatDate(today)}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">{greeting}</h1>
        </div>
        <Link href="/planner" className="btn-primary w-fit">
          Generate Plan
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider">Streak</p>
          <p className="text-2xl font-bold mt-2">{streakData?.streak_current ?? 0}</p>
          <p className="text-xs text-white/30 mt-1">Best: {streakData?.streak_longest ?? 0}</p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider">Today Pending</p>
          <p className="text-2xl font-bold mt-2">{pendingToday.length}</p>
          <p className="text-xs text-white/30 mt-1">
            {pendingToday.reduce((sum, t) => sum + t.duration_minutes, 0)} min
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider">Today Done</p>
          <p className="text-2xl font-bold mt-2">{doneToday.length}</p>
          <p className="text-xs text-white/30 mt-1">of {todayTasks.length} tasks</p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider">Week Load</p>
          <p className="text-2xl font-bold mt-2">{thisWeekPendingMinutes}</p>
          <p className="text-xs text-white/30 mt-1">minutes pending</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="rounded-xl border border-white/5 bg-transparent p-5 space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Today&apos;s Tasks</h2>
            <span className="text-xs text-white/30">{pendingToday.length} remaining</span>
          </div>

          <QuickAddTask subjects={subjects} />

          {todayTasks.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-white/40">Nothing scheduled for today.</p>
              <Link href="/planner" className="btn-primary inline-block text-xs">
                Generate a plan
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingToday.map(task => (
                <form key={task.id} action={handleComplete} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                  <input type="hidden" name="task_id" value={task.id} />
                  <SubmitButton
                    className="w-5 h-5 shrink-0 rounded-full border-2 border-white/20 hover:border-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-wait"
                    aria-label="Mark complete"
                  >
                    <span className="sr-only">Complete</span>
                  </SubmitButton>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white/85 truncate">{task.title}</div>
                    <div className="text-xs text-white/35 mt-0.5">{task.duration_minutes} min</div>
                  </div>
                  <span className="text-[10px] text-white/30">P{task.priority}</span>
                </form>
              ))}

              {doneToday.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-white/25">Completed</p>
                  {doneToday.map(task => (
                    <div key={task.id} className="text-sm text-white/45 line-through truncate px-1 py-1">
                      {task.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/5 bg-transparent p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Upcoming Deadlines</h2>
            <Link href="/dashboard/subjects" className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Subjects
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-sm text-white/40 py-4">No subjects with deadlines.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 8).map(item => {
                const days = item.deadline ? daysUntil(item.deadline) : null

                return (
                  <div key={item.topic_id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white/85 truncate">{item.topic_name}</p>
                      <span className="text-[10px] text-white/35">{item.subject_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/40">
                      <span>{item.deadline}</span>
                      {days !== null && <span>{days < 0 ? "Overdue" : days === 0 ? "Today" : `${days}d`}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
