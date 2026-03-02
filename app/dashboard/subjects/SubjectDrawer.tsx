"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/components/Toast"
import { addSubject } from "@/app/actions/subjects/addSubject"
import { updateSubject } from "@/app/actions/subjects/updateSubject"
import { getSubjectById } from "@/app/actions/subjects/getSubjectById"
import { getSubtopics, addSubtopic, deleteSubtopic } from "@/app/actions/subjects/subtopics"
import type { Subtopic } from "@/lib/types/db"

interface Props {
  open: boolean
  mode: "create" | "edit"
  subjectId: string | null
  onClose: () => void
  onSaved: () => void
}

export function SubjectDrawer({ open, mode, subjectId, onClose, onSaved }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  
  // Subject State
  const [name, setName] = useState("")
  const [deadline, setDeadline] = useState("")
  const [priority, setPriority] = useState(2)
  const [totalItems, setTotalItems] = useState(40)
  const [avgDuration, setAvgDuration] = useState(60)
  
  // Subtopics State
  const [subtopics, setSubtopics] = useState<Subtopic[]>([])
  const [newSubtopicName, setNewSubtopicName] = useState("")
  const [newSubtopicItems, setNewSubtopicItems] = useState(10)
  
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!open) return

    if (mode === "create") {
      setName("")
      setDeadline("")
      setPriority(2)
      setTotalItems(40)
      setAvgDuration(60)
      setSubtopics([])
      setNewSubtopicName("")
      setNewSubtopicItems(10)
    } else if (mode === "edit" && subjectId) {
      void fetchSubjectAndSubtopics(subjectId)
    }
  }, [open, mode, subjectId])

  async function fetchSubjectAndSubtopics(id: string) {
    setFetching(true)
    const [subjectRes, subtopicsRes] = await Promise.all([getSubjectById(id), getSubtopics(id)])

    if (subjectRes.status === "SUCCESS") {
      setName(subjectRes.subject.name)
      setDeadline(subjectRes.subject.deadline)
      setPriority(subjectRes.subject.priority)
      setTotalItems(subjectRes.subject.total_items)
      setAvgDuration(subjectRes.subject.avg_duration_minutes)
    } else if (subjectRes.status === "UNAUTHORIZED") {
      addToast("Unauthorized", "error")
      setFetching(false)
      return
    } else {
      addToast(subjectRes.message, "error")
      setFetching(false)
      return
    }

    if (subtopicsRes.status === "SUCCESS") {
      setSubtopics(subtopicsRes.subtopics)
    } else {
      setSubtopics([])
    }

    setFetching(false)
  }

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === "create") {
        const res = await addSubject({
          name,
          total_items: totalItems,
          avg_duration_minutes: avgDuration,
          deadline,
          priority
        })
        if (res.status === "SUCCESS") {
          addToast("Subject created", "success")
          onSaved()
        } else if (res.status === "ERROR") {
          addToast(res.message, "error")
        } else {
          addToast("Unauthorized", "error")
        }
      } else if (mode === "edit" && subjectId) {
        const res = await updateSubject({
          id: subjectId,
          name,
          total_items: totalItems,
          avg_duration_minutes: avgDuration,
          deadline,
          priority,
        })

        if (res.status === "SUCCESS") {
          addToast("Subject updated", "success")
          onSaved()
        } else if (res.status === "ERROR") {
          addToast(res.message, "error")
        } else {
          addToast("Unauthorized", "error")
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSubtopic(e: React.FormEvent) {
    e.preventDefault()
    if (!subjectId || mode !== "edit") {
      addToast("You can add subtopics after creating the subject first.", "info")
      return
    }

    setLoading(true)
    const res = await addSubtopic(subjectId, newSubtopicName, newSubtopicItems)
    if (res.status === "SUCCESS") {
      setSubtopics((prev) => [...prev, res.subtopic])
      setNewSubtopicName("")
      setNewSubtopicItems(10)
      addToast("Subtopic added", "success")
      router.refresh()
    } else if (res.status === "ERROR") {
      addToast(res.message, "error")
    } else {
      addToast("Unauthorized", "error")
    }
    setLoading(false)
  }

  async function handleDeleteSubtopic(id: string) {
    setLoading(true)
    const res = await deleteSubtopic(id)
    if (res.status === "SUCCESS") {
      setSubtopics((prev) => prev.filter((subtopic) => subtopic.id !== id))
      addToast("Subtopic deleted", "info")
      router.refresh()
    } else if (res.status === "ERROR") {
      addToast(res.message, "error")
    } else {
      addToast("Unauthorized", "error")
    }
    setLoading(false)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-neutral-900 border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto flex flex-col shadow-2xl`}>
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Add New Subject" : "Edit Subject"}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8">
          {/* Main Form */}
          <form id="subject-form" onSubmit={handleSaveSubject} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1">Subject Name</label>
              <input
                autoFocus
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. System Design, Calculus"
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Target Deadline</label>
                <input 
                  type="date"
                  required
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(Number(event.target.value))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>P1 (High)</option>
                  <option value={2}>P2 (Medium)</option>
                  <option value={3}>P3 (Low)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Raw Base Items</label>
                <input 
                  type="number"
                  min={1}
                  required
                  value={totalItems}
                  onChange={(event) => setTotalItems(Number(event.target.value))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  title="If using subtopics, this gets ignored in total workload."
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Avg Min/Item</label>
                <input 
                  type="number"
                  min={1}
                  required
                  value={avgDuration}
                  onChange={(event) => setAvgDuration(Number(event.target.value))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </form>

          {/* Subtopics Section (Only in Edit Mode) */}
          {mode === "edit" && subjectId && (
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div>
                <h3 className="text-sm font-semibold">Subtopics Structure</h3>
                <p className="text-xs text-white/40 mb-3">Adding subtopics will override the raw base items count above for this subject's total workload.</p>
              </div>

              {fetching ? (
                <div className="text-xs text-white/30 text-center py-4">Loading structure...</div>
              ) : (
                <div className="space-y-2">
                  {subtopics.map(st => (
                    <div key={st.id} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm group">
                      <div>
                        <div className="font-medium">{st.name}</div>
                        <div className="text-xs text-white/40">{st.total_items} items</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtopic(st.id)}
                        disabled={loading}
                        className="text-xs text-red-500/0 group-hover:text-red-500/70 hover:!text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  
                  <form onSubmit={handleAddSubtopic} className="flex gap-2 mt-4">
                    <input 
                      required
                      value={newSubtopicName}
                      onChange={(event) => setNewSubtopicName(event.target.value)}
                      placeholder="New subtopic..."
                      className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <input 
                      type="number"
                      required
                      min={1}
                      value={newSubtopicItems}
                      onChange={(event) => setNewSubtopicItems(Number(event.target.value))}
                      className="w-20 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      title="Item count"
                    />
                    <button 
                      type="submit"
                      disabled={loading || !newSubtopicName.trim()}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                    >
                      Add
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-neutral-900 shrink-0">
          <button
            form="subject-form"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : mode === "create" ? "Create Subject" : "Save Subject Basics"}
          </button>
        </div>
      </div>
    </>
  )
}