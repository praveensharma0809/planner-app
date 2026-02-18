"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

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

interface Props {
  subject: Subject
  onRefresh: () => void
}

export function SubjectCard({ subject, onRefresh }: Props) {
  const [editing, setEditing] = useState(false)
  const [totalItems, setTotalItems] = useState(subject.total_items)
  const [avgDuration, setAvgDuration] = useState(subject.avg_duration_minutes)
  const [deadline, setDeadline] = useState(subject.deadline)
  const [priority, setPriority] = useState(subject.priority)

  const progress =
    subject.total_items === 0
      ? 0
      : Math.round(
          (subject.completed_items / subject.total_items) * 100
        )

  const handleSave = async () => {
    await supabase
      .from("subjects")
      .update({
        total_items: totalItems,
        avg_duration_minutes: avgDuration,
        deadline,
        priority
      })
      .eq("id", subject.id)

    setEditing(false)
    onRefresh()
  }

  const handleDelete = async () => {
    await supabase
      .from("subjects")
      .delete()
      .eq("id", subject.id)

    onRefresh()
  }

  return (
    <div className="bg-neutral-900 p-5 rounded-xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">{subject.name}</h3>

        <div className="space-x-2">
          <button
            onClick={() => setEditing(!editing)}
            className="text-sm text-blue-400"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={handleDelete}
            className="text-sm text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      <div>
        <div className="text-sm mb-1">
          Progress: {subject.completed_items}/{subject.total_items} ({progress}%)
        </div>
        <div className="w-full bg-neutral-800 rounded h-2">
          <div
            className="bg-white h-2 rounded"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <input
            type="number"
            value={totalItems}
            onChange={e => setTotalItems(Number(e.target.value))}
            className="w-full p-2 bg-neutral-800 rounded"
          />
          <input
            type="number"
            value={avgDuration}
            onChange={e => setAvgDuration(Number(e.target.value))}
            className="w-full p-2 bg-neutral-800 rounded"
          />
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full p-2 bg-neutral-800 rounded"
          />
          <select
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            className="w-full p-2 bg-neutral-800 rounded"
          >
            <option value={1}>High</option>
            <option value={2}>Medium-High</option>
            <option value={3}>Medium</option>
            <option value={4}>Low</option>
            <option value={5}>Very Low</option>
          </select>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-white text-black rounded"
          >
            Save Changes
          </button>
        </div>
      ) : (
        <div className="text-sm text-neutral-400 space-y-1">
          <p>Avg Duration: {subject.avg_duration_minutes} mins</p>
          <p>Deadline: {subject.deadline}</p>
          <p>Priority: {subject.priority}</p>
        </div>
      )}
    </div>
  )
}
