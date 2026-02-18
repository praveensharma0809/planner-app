"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { SubjectCard } from "./SubjectCard"

interface Subject {
  id: string
  user_id: string
  name: string
  total_items: number
  completed_items: number
  avg_duration_minutes: number
  deadline: string
  priority: number
  mandatory: boolean
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState("")
  const [totalItems, setTotalItems] = useState(1)
  const [avgDuration, setAvgDuration] = useState(60)
  const [deadline, setDeadline] = useState("")
  const [priority, setPriority] = useState(3)

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("subjects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (data) setSubjects(data)
    setLoading(false)
  }

  const addSubject = async () => {
    if (!name.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from("subjects").insert({
      user_id: user.id,
      name,
      total_items: totalItems,
      avg_duration_minutes: avgDuration,
      deadline,
      priority,
      mandatory: false,
      completed_items: 0
    })

    setName("")
    setTotalItems(1)
    setAvgDuration(60)
    setDeadline("")
    setPriority(3)

    fetchSubjects()
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Subjects</h1>

      {/* Add Subject Form */}
      <div className="bg-neutral-900 p-6 rounded-xl mb-8 space-y-4">
        <input
          placeholder="Subject name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-3 bg-neutral-800 rounded"
        />

        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            placeholder="Total items"
            value={totalItems}
            onChange={e => setTotalItems(Number(e.target.value))}
            className="p-3 bg-neutral-800 rounded"
          />

          <input
            type="number"
            placeholder="Avg duration (mins)"
            value={avgDuration}
            onChange={e => setAvgDuration(Number(e.target.value))}
            className="p-3 bg-neutral-800 rounded"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="p-3 bg-neutral-800 rounded"
          />

          <select
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            className="p-3 bg-neutral-800 rounded"
          >
            <option value={1}>High</option>
            <option value={2}>Medium-High</option>
            <option value={3}>Medium</option>
            <option value={4}>Low</option>
            <option value={5}>Very Low</option>
          </select>
        </div>

        <button
          onClick={addSubject}
          className="px-6 py-3 bg-white text-black rounded"
        >
          Add Subject
        </button>
      </div>

      {/* Subjects List */}
      <div className="space-y-4">
        {subjects.map(subject => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            onRefresh={fetchSubjects}
          />
        ))}
      </div>
    </div>
  )
}
