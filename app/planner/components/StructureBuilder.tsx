"use client"

import { useState } from "react"

interface SubtopicDraft {
  id?: string
  name: string
  sort_order: number
}

interface TopicDraft {
  id?: string
  name: string
  sort_order: number
  subtopics: SubtopicDraft[]
}

interface SubjectDraft {
  id?: string
  name: string
  sort_order: number
  topics: TopicDraft[]
}

interface StructureBuilderProps {
  initialSubjects: SubjectDraft[]
  onSave: (subjects: SubjectDraft[]) => void
  isSaving: boolean
}

export type { SubjectDraft, TopicDraft, SubtopicDraft }

export default function StructureBuilder({
  initialSubjects,
  onSave,
  isSaving,
}: StructureBuilderProps) {
  const [subjects, setSubjects] = useState<SubjectDraft[]>(
    initialSubjects.length > 0
      ? initialSubjects
      : [{ name: "", sort_order: 0, topics: [] }]
  )

  const addSubject = () => {
    setSubjects((prev) => [
      ...prev,
      { name: "", sort_order: prev.length, topics: [] },
    ])
  }

  const removeSubject = (si: number) => {
    setSubjects((prev) => prev.filter((_, i) => i !== si))
  }

  const updateSubjectName = (si: number, name: string) => {
    setSubjects((prev) =>
      prev.map((s, i) => (i === si ? { ...s, name } : s))
    )
  }

  const addTopic = (si: number) => {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              topics: [
                ...s.topics,
                { name: "", sort_order: s.topics.length, subtopics: [] },
              ],
            }
          : s
      )
    )
  }

  const removeTopic = (si: number, ti: number) => {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === si
          ? { ...s, topics: s.topics.filter((_, j) => j !== ti) }
          : s
      )
    )
  }

  const updateTopicName = (si: number, ti: number, name: string) => {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              topics: s.topics.map((t, j) =>
                j === ti ? { ...t, name } : t
              ),
            }
          : s
      )
    )
  }

  const addSubtopic = (si: number, ti: number) => {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              topics: s.topics.map((t, j) =>
                j === ti
                  ? {
                      ...t,
                      subtopics: [
                        ...t.subtopics,
                        { name: "", sort_order: t.subtopics.length },
                      ],
                    }
                  : t
              ),
            }
          : s
      )
    )
  }

  const removeSubtopic = (si: number, ti: number, sti: number) => {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              topics: s.topics.map((t, j) =>
                j === ti
                  ? {
                      ...t,
                      subtopics: t.subtopics.filter(
                        (_, k) => k !== sti
                      ),
                    }
                  : t
              ),
            }
          : s
      )
    )
  }

  const updateSubtopicName = (
    si: number,
    ti: number,
    sti: number,
    name: string
  ) => {
    setSubjects((prev) =>
      prev.map((s, i) =>
        i === si
          ? {
              ...s,
              topics: s.topics.map((t, j) =>
                j === ti
                  ? {
                      ...t,
                      subtopics: t.subtopics.map((st, k) =>
                        k === sti ? { ...st, name } : st
                      ),
                    }
                  : t
              ),
            }
          : s
      )
    )
  }

  const canProceed = subjects.some((s) => s.name.trim().length > 0)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
          Phase 1
        </p>
        <h2 className="text-xl font-semibold">Subject Structure</h2>
        <p className="text-sm text-white/50">
          Define your subjects, topics, and subtopics. Topics and subtopics are
          optional.
        </p>
      </div>

      <div className="space-y-4">
        {subjects.map((subj, si) => (
          <div
            key={si}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Subject name"
                value={subj.name}
                onChange={(e) => updateSubjectName(si, e.target.value)}
                className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
              />
              {subjects.length > 1 && (
                <button
                  onClick={() => removeSubject(si)}
                  className="text-red-400/60 hover:text-red-400 text-xs px-2 py-1"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Topics */}
            <div className="pl-4 space-y-2">
              {subj.topics.map((topic, ti) => (
                <div
                  key={ti}
                  className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white/20 text-xs">↳</span>
                    <input
                      type="text"
                      placeholder="Topic name"
                      value={topic.name}
                      onChange={(e) =>
                        updateTopicName(si, ti, e.target.value)
                      }
                      className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                    <button
                      onClick={() => removeTopic(si, ti)}
                      className="text-red-400/60 hover:text-red-400 text-xs px-2 py-1"
                    >
                      ×
                    </button>
                  </div>

                  {/* Subtopics */}
                  <div className="pl-6 space-y-1">
                    {topic.subtopics.map((st, sti) => (
                      <div key={sti} className="flex items-center gap-2">
                        <span className="text-white/15 text-xs">↳</span>
                        <input
                          type="text"
                          placeholder="Subtopic name"
                          value={st.name}
                          onChange={(e) =>
                            updateSubtopicName(
                              si,
                              ti,
                              sti,
                              e.target.value
                            )
                          }
                          className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-2 py-1.5 text-xs focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                        />
                        <button
                          onClick={() =>
                            removeSubtopic(si, ti, sti)
                          }
                          className="text-red-400/60 hover:text-red-400 text-[10px] px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addSubtopic(si, ti)}
                      className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                    >
                      + Add subtopic
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => addTopic(si)}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                + Add topic
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={addSubject}
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          + Add subject
        </button>
        <button
          onClick={() => onSave(subjects)}
          disabled={!canProceed || isSaving}
          className="btn-primary disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  )
}
