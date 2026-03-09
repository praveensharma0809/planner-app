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

  // Live stats for header badges
  const totalTopics = subjects.reduce((sum, s) => sum + s.topics.length, 0)
  const totalSubtopics = subjects.reduce(
    (sum, s) => sum + s.topics.reduce((t, topic) => t + topic.subtopics.length, 0),
    0
  )

  // Shared input class factories for consistency
  const subjectInputCls = "flex-1 bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-indigo-400/30 focus:border-indigo-400/60 focus:bg-white/[0.04] px-2 py-1 text-sm outline-none transition-all duration-200 placeholder:text-white/20 font-medium"
  const topicInputCls = "flex-1 bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-purple-400/30 focus:border-purple-400/60 focus:bg-white/[0.04] px-2 py-1 text-sm outline-none transition-all duration-200 placeholder:text-white/20"
  const subtopicInputCls = "flex-1 bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-pink-400/30 focus:border-pink-400/60 focus:bg-white/[0.04] px-2 py-0.5 text-xs outline-none transition-all duration-200 placeholder:text-white/20"
  const removeBtnCls = "opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 hover:bg-red-500/10 text-sm w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all duration-200"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative">
        <div className="flex items-end justify-between pb-3 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-full" />
              <p className="text-[10px] text-indigo-400/80 uppercase tracking-widest font-semibold">Phase 1</p>
            </div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Subject Structure
            </h2>
            <p className="text-xs text-white/40 font-light">Build your curriculum hierarchy</p>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-300 font-medium">
              {subjects.length} {subjects.length === 1 ? "Subject" : "Subjects"}
            </span>
            {totalTopics > 0 && (
              <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-300 font-medium">
                {totalTopics} {totalTopics === 1 ? "Topic" : "Topics"}
              </span>
            )}
            {totalSubtopics > 0 && (
              <span className="px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 rounded-md text-pink-300 font-medium">
                {totalSubtopics} {totalSubtopics === 1 ? "Subtopic" : "Subtopics"}
              </span>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      </div>

      {/* Table */}
      <div className="relative rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.01] shadow-lg shadow-black/5 overflow-hidden backdrop-blur-sm">

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-3 bg-gradient-to-r from-white/[0.04] via-white/[0.03] to-white/[0.02] border-b border-white/[0.08] px-4 py-2">
          <div className="col-span-4 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Subject</span>
          </div>
          <div className="col-span-4 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Topic</span>
          </div>
          <div className="col-span-4 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-pink-400/60" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Subtopic</span>
          </div>
        </div>

        {/* Subject blocks */}
        <div>
          {subjects.map((subj, si) => (
            <div
              key={si}
              className="group hover:bg-gradient-to-r hover:from-white/[0.015] hover:to-transparent transition-all duration-200"
            >
              {/* Separator between subjects — very subtle gradient line */}
              {si > 0 && (
                <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-1" />
              )}

              {/* Case A: no topics yet — single row with subject + "Add Topic" prompt */}
              {subj.topics.length === 0 && (
                <div className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
                  <div className="col-span-4 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter subject..."
                      value={subj.name}
                      onChange={(e) => updateSubjectName(si, e.target.value)}
                      className={subjectInputCls}
                    />
                    {subjects.length > 1 && (
                      <button onClick={() => removeSubject(si)} className={removeBtnCls} title="Remove subject">×</button>
                    )}
                  </div>
                  <div className="col-span-4 flex items-center">
                    <button
                      onClick={() => addTopic(si)}
                      className="text-[11px] text-purple-400/40 hover:text-purple-400 hover:bg-purple-500/10 px-2 py-1 rounded transition-all duration-200 font-medium"
                    >
                      + Add Topic
                    </button>
                  </div>
                  <div className="col-span-4" />
                </div>
              )}

              {/* Case B: has topics — one block per topic, subject name only on first row */}
              {subj.topics.length > 0 && (
                <>
                  {subj.topics.map((topic, ti) => (
                    <div key={ti}>

                      {/* Topic row: subject (ti=0 only) | topic | first subtopic */}
                      <div className="grid grid-cols-12 gap-3 px-4 py-2 items-center">

                        {/* Subject column — visible only on first topic */}
                        <div className="col-span-4 flex items-center gap-2">
                          {ti === 0 && (
                            <>
                              <input
                                type="text"
                                placeholder="Enter subject..."
                                value={subj.name}
                                onChange={(e) => updateSubjectName(si, e.target.value)}
                                className={subjectInputCls}
                              />
                              {subjects.length > 1 && (
                                <button onClick={() => removeSubject(si)} className={removeBtnCls} title="Remove subject">×</button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Topic column */}
                        <div className="col-span-4 flex items-center gap-2">
                          <span className="text-purple-400/40 text-xs font-bold w-3 shrink-0">›</span>
                          <input
                            type="text"
                            placeholder="Enter topic..."
                            value={topic.name}
                            onChange={(e) => updateTopicName(si, ti, e.target.value)}
                            className={topicInputCls}
                          />
                          <button onClick={() => removeTopic(si, ti)} className={removeBtnCls} title="Remove topic">×</button>
                        </div>

                        {/* Subtopic column — first subtopic or inline add-button */}
                        <div className="col-span-4 flex items-center gap-2">
                          {topic.subtopics.length > 0 ? (
                            <>
                              <span className="text-pink-400/40 text-xs font-bold w-4 shrink-0">›</span>
                              <input
                                type="text"
                                placeholder="Enter subtopic..."
                                value={topic.subtopics[0].name}
                                onChange={(e) => updateSubtopicName(si, ti, 0, e.target.value)}
                                className={subtopicInputCls}
                              />
                              <button onClick={() => removeSubtopic(si, ti, 0)} className={removeBtnCls} title="Remove subtopic">×</button>
                            </>
                          ) : (
                            <button
                              onClick={() => addSubtopic(si, ti)}
                              className="text-[11px] text-pink-400/40 hover:text-pink-400 hover:bg-pink-500/10 px-2 py-1 rounded transition-all duration-200 font-medium ml-4"
                            >
                              + Add Subtopic
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Additional subtopics (index 1+) */}
                      {topic.subtopics.slice(1).map((st, sti) => (
                        <div key={sti} className="grid grid-cols-12 gap-3 px-4 py-1.5 items-center">
                          <div className="col-span-4" />
                          <div className="col-span-4" />
                          <div className="col-span-4 flex items-center gap-2">
                            <span className="text-pink-400/40 text-xs font-bold w-4 shrink-0">›</span>
                            <input
                              type="text"
                              placeholder="Enter subtopic..."
                              value={st.name}
                              onChange={(e) => updateSubtopicName(si, ti, sti + 1, e.target.value)}
                              className={subtopicInputCls}
                            />
                            <button onClick={() => removeSubtopic(si, ti, sti + 1)} className={removeBtnCls} title="Remove subtopic">×</button>
                          </div>
                        </div>
                      ))}

                      {/* Add Subtopic row — always present when topic has ≥1 subtopic */}
                      {topic.subtopics.length > 0 && (
                        <div className="grid grid-cols-12 gap-3 px-4 pb-1">
                          <div className="col-span-4" />
                          <div className="col-span-4" />
                          <div className="col-span-4 pl-6">
                            <button
                              onClick={() => addSubtopic(si, ti)}
                              className="text-[11px] text-pink-400/30 hover:text-pink-400 hover:bg-pink-500/10 px-2 py-0.5 rounded transition-all duration-200 font-medium"
                            >
                              + Add Subtopic
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Topic row — always at bottom of each subject block */}
                  <div className="grid grid-cols-12 gap-3 px-4 pb-2 pt-0.5">
                    <div className="col-span-4" />
                    <div className="col-span-4">
                      <button
                        onClick={() => addTopic(si)}
                        className="text-[11px] text-purple-400/30 hover:text-purple-400 hover:bg-purple-500/10 px-2 py-0.5 rounded transition-all duration-200 font-medium"
                      >
                        + Add Topic
                      </button>
                    </div>
                    <div className="col-span-4" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={addSubject}
          className="flex items-center gap-2 text-xs text-indigo-400/80 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/30 px-4 py-2 rounded-lg transition-all duration-200 font-semibold shadow-sm hover:shadow-md hover:shadow-indigo-500/5"
        >
          <span className="text-base leading-none">+</span>
          <span>Add Subject</span>
        </button>
        <button
          onClick={() => onSave(subjects)}
          disabled={!canProceed || isSaving}
          className="relative overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 disabled:from-white/10 disabled:to-white/10 text-white disabled:text-white/40 text-sm font-semibold px-6 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 disabled:shadow-none disabled:cursor-not-allowed"
        >
          <span className="relative z-10">{isSaving ? "Saving..." : "Save & Continue →"}</span>
          {canProceed && !isSaving && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
          )}
        </button>
      </div>
    </div>
  )
}
