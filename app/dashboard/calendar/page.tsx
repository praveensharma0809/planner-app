import { getMonthTasks } from "@/app/actions/dashboard/getMonthTasks"
import { MonthView } from "./MonthView"

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const monthParam = params.month

  const today = new Date().toISOString().split("T")[0]
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