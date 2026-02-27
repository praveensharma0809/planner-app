import { createServerSupabaseClient } from "@/lib/supabase/server"
import { completeTask } from "@/app/actions/plan/completeTask"
import { revalidatePath } from "next/cache"

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-8">Unauthorized</div>
  }

  // Current month boundaries
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const firstISO = firstDay.toISOString().split("T")[0]
  const lastISO = lastDay.toISOString().split("T")[0]

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id,
      user_id,
      subject_id,
      title,
      scheduled_date,
      duration_minutes,
      priority,
      completed,
      is_plan_generated,
      created_at,
      subjects ( name )
    `)
    .eq("user_id", user.id)
    .gte("scheduled_date", firstISO)
    .lte("scheduled_date", lastISO)
    .order("scheduled_date", { ascending: true })

  if (error) {
    console.error(error)
    return <div className="p-8">Error loading calendar.</div>
  }

  // Group by date
  const grouped: Record<string, typeof tasks> = {}

  tasks?.forEach(task => {
    if (!grouped[task.scheduled_date]) {
      grouped[task.scheduled_date] = []
    }
    grouped[task.scheduled_date].push(task)
  })

  async function handleComplete(taskId: string) {
    "use server"
    await completeTask(taskId)
    revalidatePath("/dashboard/calendar")
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Calendar</h1>

      {Object.keys(grouped).length === 0 && (
        <div className="text-neutral-400">
          No tasks scheduled this month.
        </div>
      )}

      <div className="space-y-10">
        {Object.entries(grouped).map(([date, tasks]) => {
          const formatted = new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          })

          return (
            <div key={date}>
              <h2 className="text-xl font-semibold mb-4 text-neutral-300">
                {formatted}
              </h2>

              <div className="space-y-3">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className={`bg-neutral-900 p-4 rounded flex justify-between items-center ${
                      task.completed ? "opacity-50" : ""
                    }`}
                  >
                    <div>
                      {task.subjects?.[0]?.name && (
                        <div className="inline-block px-2 py-1 bg-neutral-800 text-neutral-300 text-xs rounded mb-2">
                          {task.subjects[0].name}
                        </div>
                      )}

                      <h3 className="font-medium">{task.title}</h3>
                      <p className="text-sm text-neutral-400">
                        {task.duration_minutes} minutes
                      </p>
                    </div>

                    {!task.completed && (
                      <form action={handleComplete.bind(null, task.id)}>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-white text-black rounded"
                        >
                          Complete
                        </button>
                      </form>
                    )}

                    {task.completed && (
                      <span className="text-green-400 text-sm">
                        Completed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
