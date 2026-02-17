"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { TaskCard } from "./TaskCard"

interface User {
  id: string
  email?: string
}

interface Task {
  id: string
  user_id: string
  title: string
  duration_minutes: number
  priority: number
  completed: boolean
  scheduled_date: string
  created_at?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState("")
  const [duration, setDuration] = useState(60)
  const [priority, setPriority] = useState(3)

  const today = new Date().toISOString().split("T")[0]

  const fetchTasks = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("scheduled_date", today)
      .order("priority", { ascending: true })

    if (data) setTasks(data as Task[])
  }, [today])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUser(user as User)
      await fetchTasks(user.id)
      setLoading(false)
    }

    init()
  }, [fetchTasks, router])

  const addTask = async () => {
    if (!title.trim()) return
    if (!user) return


    await supabase.from("tasks").insert({
      user_id: user.id,
      title,
      duration_minutes: duration,
      priority,
      scheduled_date: today
    })

    setTitle("")
    setDuration(60)
    setPriority(3)
    
    await fetchTasks(user.id)
  }

  const toggleComplete = async (taskId: string, currentValue: boolean) => {
    await supabase
      .from("tasks")
      .update({ completed: !currentValue })
      .eq("id", taskId)

    if (!user) return
    await fetchTasks(user.id)
  }

  const deleteTask = async (taskId: string) => {
    await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)

    if (!user) return
    await fetchTasks(user.id)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin"></div>
          <p className="text-neutral-400 text-sm">Loading your day...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:px-8 lg:py-16">
        <header className="mb-12">
          <p className="text-sm text-neutral-500 mb-2 tracking-wide uppercase">
            {formatDate(new Date())}
          </p>
          <h1 className="text-4xl sm:text-5xl font-light text-neutral-100 tracking-tight">
            Today&apos;s Focus
          </h1>
        </header>

        <div className="space-y-8">
          <div className="bg-neutral-900/30 backdrop-blur-sm border border-neutral-800/50 rounded-2xl p-6 sm:p-8 shadow-xl">
            <h2 className="text-lg font-medium text-neutral-200 mb-6">Add New Task</h2>

            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim()) {
                      addTask()
                    }
                  }}
                  className="
                    w-full px-4 py-3 bg-neutral-900/50 border border-neutral-800 
                    rounded-lg text-neutral-100 placeholder-neutral-600
                    focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                    transition-all duration-200
                  "
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Duration</label>
                  <input
                    type="number"
                    placeholder="60"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="
                      w-full px-4 py-3 bg-neutral-900/50 border border-neutral-800 
                      rounded-lg text-neutral-100 placeholder-neutral-600
                      focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                      transition-all duration-200
                    "
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="
                      w-full px-4 py-3 bg-neutral-900/50 border border-neutral-800 
                      rounded-lg text-neutral-100
                      focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                      transition-all duration-200 cursor-pointer
                    "
                  >
                    <option value={1}>High Priority</option>
                    <option value={2}>Medium-High</option>
                    <option value={3}>Medium</option>
                    <option value={4}>Medium-Low</option>
                    <option value={5}>Low Priority</option>
                  </select>
                </div>
              </div>

              <button
                onClick={addTask}
                disabled={!title.trim()}
                className="
                  w-full sm:w-auto px-8 py-3 bg-neutral-100 text-neutral-900 
                  rounded-lg font-medium
                  hover:bg-white transition-all duration-200
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-100
                  shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20
                  transform hover:scale-[1.02] active:scale-[0.98]
                "
              >
                Add Task
              </button>
            </div>
          </div>

          <div>
            {tasks.length === 0 ? (
              <div className="bg-neutral-900/20 backdrop-blur-sm border border-neutral-800/30 rounded-2xl p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-neutral-600"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-medium text-neutral-300 mb-2">
                      Your day is clear
                    </h3>
                    <p className="text-neutral-500 text-sm max-w-md mx-auto">
                      Start by adding your first task above. Focus on what matters most.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={toggleComplete}
                    onDelete={deleteTask}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
