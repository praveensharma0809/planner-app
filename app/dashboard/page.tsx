"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState("")
  const [duration, setDuration] = useState(60)
  const [priority, setPriority] = useState(3)

  const today = new Date().toISOString().split("T")[0]

  const fetchTasks = async (userId: string) => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("scheduled_date", today)
      .order("priority", { ascending: true })

    if (data) setTasks(data)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUser(user)
      await fetchTasks(user.id)
      setLoading(false)
    }

    init()
  }, [])

  const addTask = async () => {
    if (!title.trim()) return

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

    await fetchTasks(user.id)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: "40px", maxWidth: "600px" }}>
      <h1>Today's Tasks</h1>

      {/* ADD TASK FORM */}
      <div style={{
        marginBottom: "30px",
        padding: "20px",
        background: "#1e1e1e",
        borderRadius: "10px"
      }}>
        <h3>Add Task</h3>

        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />

        <input
          type="number"
          placeholder="Duration (minutes)"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        />

        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
        >
          <option value={1}>Priority 1 (High)</option>
          <option value={2}>Priority 2</option>
          <option value={3}>Priority 3</option>
          <option value={4}>Priority 4</option>
          <option value={5}>Priority 5 (Low)</option>
        </select>

        <button
          onClick={addTask}
          style={{
            padding: "10px 20px",
            background: "white",
            color: "black",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer"
          }}
        >
          Add Task
        </button>
      </div>

      {/* TASK LIST */}
      {tasks.length === 0 && <p>No tasks for today.</p>}

      {tasks.map(task => (
        <div
          key={task.id}
          style={{
            padding: "15px",
            marginBottom: "10px",
            background: "#1e1e1e",
            borderRadius: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>
              {task.title}
            </h3>
            <small>
              {task.duration_min} min | Priority {task.priority}
            </small>
          </div>

          <button
            onClick={() => toggleComplete(task.id, task.completed)}
            style={{
              background: task.completed ? "green" : "gray",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer"
            }}
          >
            {task.completed ? "Done" : "Mark Done"}
          </button>
        </div>
      ))}
    </div>
  )
}
