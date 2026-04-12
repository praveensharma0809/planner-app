import { getMonthTasks } from "@/app/actions/dashboard/getMonthTasks"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getTodayLocalDate } from "@/lib/tasks/getTasksForDate"
import { MonthView } from "./MonthView"

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const monthParam = params.month

  const today = getTodayLocalDate()
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

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [monthRes, subjectsData] = await Promise.all([
    getMonthTasks(monthStr),
    user
      ? supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("archived", false)
        .not("name", "ilike", "others")
        .not("name", "ilike", "__deprecated_others__")
        .order("sort_order")
      : Promise.resolve({ data: [] }),
  ])

  const monthTasks = monthRes.status === "SUCCESS" ? monthRes.tasks : []
  const subjects = (subjectsData.data ?? []) as { id: string; name: string }[]

  const prevDate = calMonth === 1 ? `${calYear - 1}-12` : `${calYear}-${String(calMonth - 1).padStart(2, "0")}`
  const nextDate = calMonth === 12 ? `${calYear + 1}-01` : `${calYear}-${String(calMonth + 1).padStart(2, "0")}`
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth() + 1

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
      <MonthView
        tasks={monthTasks}
        subjects={subjects}
        year={calYear}
        month={calMonth}
        today={today}
        prevMonth={prevDate}
        nextMonth={nextDate}
        isCurrentMonth={isCurrentMonth}
        className="flex w-full min-h-0 flex-1 flex-col"
      />
    </div>
  )
}
