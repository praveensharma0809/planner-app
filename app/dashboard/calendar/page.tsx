import { getWeeklySnapshot } from "@/app/actions/dashboard/getWeeklySnapshot"
import { getMonthTasks } from "@/app/actions/dashboard/getMonthTasks"
import { Task } from "@/lib/types/db"
import { MonthView } from "./MonthView"
import { AddTaskForm } from "./AddTaskForm"
import { WeekView } from "./WeekView"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import Link from "next/link"

function buildWeek(tasks: Task[]) {
  const weekMap: Record<string, Task[]> = {}
  tasks.forEach(task => {
    const key = task.scheduled_date
    if (!weekMap[key]) weekMap[key] = []
    weekMap[key].push(task)
  })
  return weekMap
}

function getWeekDays(start: Date) {
  const days: string[] = []
  const cursor = new Date(start)
  for (let i = 0; i < 7; i++) {
    days.push(cursor.toISOString().split("T")[0])
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMonday = (day + 6) % 7
  d.setDate(d.getDate() - diffToMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekRange(days: string[]) {
  if (days.length < 2) return ""
  const start = new Date(days[0] + "T12:00:00")
  const end = new Date(days[days.length - 1] + "T12:00:00")
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", opts)}`
}

interface Props {
  searchParams: Promise<{ week?: string; view?: string; month?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const weekParam = params.week
  const viewParam = params.view
  const monthParam = params.month

  const today = new Date().toISOString().split("T")[0]

  if (viewParam === "month") {
    const now = new Date()
    let calYear: number
    let calMonth: number

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      calYear = parseInt(monthParam.split("-")[0], 10)
      calMonth = parseInt(monthParam.split("-")[1], 10)
    } else {
      calYear = now.getFullYear()
      calMonth = now.getMonth() + 1
    }

    const monthStr = `${calYear}-${String(calMonth).padStart(2, "0")}`
    const monthRes = await getMonthTasks(monthStr)
    const monthTasks = monthRes.status === "SUCCESS" ? monthRes.tasks : []

    const prevDate = calMonth === 1 ? `${calYear - 1}-12` : `${calYear}-${String(calMonth - 1).padStart(2, "0")}`
    const nextDate = calMonth === 12 ? `${calYear + 1}-01` : `${calYear}-${String(calMonth + 1).padStart(2, "0")}`

    const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth() + 1

    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <MonthView
          tasks={monthTasks}
          year={calYear}
          month={calMonth}
          today={today}
          prevMonth={prevDate}
          nextMonth={nextDate}
          isCurrentMonth={isCurrentMonth}
        />
      </div>
    )
  }

  const baseDate = weekParam ? new Date(weekParam + "T12:00:00") : new Date()
  const isValidBase = !isNaN(baseDate.getTime())
  const effectiveBase = isValidBase ? baseDate : new Date()

  const weekStart = startOfWeek(effectiveBase)
  const days = getWeekDays(weekStart)

  const prevWeekDate = new Date(weekStart)
  prevWeekDate.setDate(prevWeekDate.getDate() - 7)
  const nextWeekDate = new Date(weekStart)
  nextWeekDate.setDate(nextWeekDate.getDate() + 7)
  const prevWeekParam = prevWeekDate.toISOString().split("T")[0]
  const nextWeekParam = nextWeekDate.toISOString().split("T")[0]

  const todayWeekStart = startOfWeek(new Date())
  const isCurrentWeek = weekStart.getTime() === todayWeekStart.getTime()

  const weekly = await getWeeklySnapshot(days[0])
  const tasks = weekly.status === "SUCCESS" ? weekly.tasks : []

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const subjectsForForm = user
    ? (await supabase.from("subjects").select("id, name").eq("user_id", user.id).order("name")).data ?? []
    : []

  const weekMap = buildWeek(tasks)

  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.completed).length
  const totalMinutes = tasks.reduce((s, t) => s + t.duration_minutes, 0)
  const completedMinutes = tasks.filter(t => t.completed).reduce((s, t) => s + t.duration_minutes, 0)

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Calendar</p>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">{formatWeekRange(days)}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isCurrentWeek && (
              <Link
                href="/dashboard/calendar"
                className="px-3 py-1.5 text-xs bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 rounded-xl hover:bg-indigo-500/25 transition-all font-medium"
              >
                Today
              </Link>
            )}
            <Link
              href={`/dashboard/calendar?week=${prevWeekParam}`}
              className="px-3 py-1.5 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all"
            >
              &#x2190; Prev
            </Link>
            <Link
              href={`/dashboard/calendar?week=${nextWeekParam}`}
              className="px-3 py-1.5 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all"
            >
              Next &#x2192;
            </Link>
            <Link
              href="/dashboard/calendar?view=month"
              className="px-3 py-1.5 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all text-white/50"
            >
              Month view
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 text-xs text-white/40 flex-wrap">
          <span>{totalTasks} tasks</span>
          <span className="text-emerald-400/70">{completedTasks} completed</span>
          <span>{totalMinutes} min total</span>
          <span>{completedMinutes} min done</span>
          {totalTasks > 0 && (
            <span className="text-white/60 font-semibold">
              {Math.round((completedTasks / totalTasks) * 100)}% complete
            </span>
          )}
        </div>

        {subjectsForForm.length > 0 && (
          <AddTaskForm subjects={subjectsForForm} defaultDate={today} />
        )}
      </header>

      <WeekView days={days} weekMap={weekMap} today={today} />
    </div>
  )
}