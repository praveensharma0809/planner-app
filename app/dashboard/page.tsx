"use client"

import { completeTask } from "@/app/actions/plan/completeTask"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface Task {
  id: string
  title: string
  duration_minutes: number
  priority: number
  completed: boolean
  scheduled_date: string
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().split("T")[0]

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("scheduled_date", today)
      .order("priority", { ascending: true })

    if (data) setTasks(data)
    setLoading(false)
  }

  const handleComplete = async (taskId: string) => {
    await completeTask(taskId)
    await init()
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Today</h1>

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
