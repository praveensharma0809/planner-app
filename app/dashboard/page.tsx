"use client"

import { completeTask } from "@/app/actions/plan/completeTask"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Task } from "@/lib/types/db"

// Supabase returns joined relations as arrays
interface TaskWithSubject extends Task {
  subjects: { name: string }[]
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskWithSubject[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("Auth error:", authError)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
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
      .eq("scheduled_date", today)
      .order("priority", { ascending: true })

    if (error) {
      console.error("Error fetching tasks:", error)
      setLoading(false)
      return
    }

    if (data) {
      setTasks(data)
    }

    setLoading(false)
  }

  const handleComplete = async (taskId: string) => {
    await completeTask(taskId)
    await init()
  }

  // Daily summary calculations
  const totalMinutes = tasks.reduce(
    (sum, task) => sum + task.duration_minutes,
    0
  )

  const completedMinutes = tasks
    .filter(task => task.completed)
    .reduce((sum, task) => sum + task.duration_minutes, 0)

  const remainingMinutes = totalMinutes - completedMinutes

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Today</h1>

      {/* Daily Summary */}
      <div className="bg-neutral-900 p-6 rounded-xl mb-8">
        <h2 className="text-lg font-semibold mb-4">Daily Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xl font-semibold">{totalMinutes}</div>
            <div className="text-sm text-neutral-400">Total Minutes</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-green-400">
              {completedMinutes}
            </div>
            <div className="text-sm text-neutral-400">Completed Minutes</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-blue-400">
              {remainingMinutes}
            </div>
            <div className="text-sm text-neutral-400">Remaining Minutes</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 && (
          <div className="text-neutral-400">
            No tasks scheduled for today.
          </div>
        )}

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
              <button
                onClick={() => handleComplete(task.id)}
                className="px-4 py-2 bg-white text-black rounded"
              >
                Complete
              </button>
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
}
