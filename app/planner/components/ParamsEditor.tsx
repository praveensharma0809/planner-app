"use client"

import { useState } from "react"

interface TopicForParams {
  id: string
  subject_name: string
  topic_name: string
}

interface ParamValues {
  topic_id: string
  estimated_hours: number
  priority: number
  deadline: string
  earliest_start: string
  depends_on: string[]
  revision_sessions: number
  practice_sessions: number
}

interface ParamsEditorProps {
  topics: TopicForParams[]
  initialParams: Map<string, ParamValues>
  onSave: (params: ParamValues[]) => void
  isSaving: boolean
}

export type { ParamValues, TopicForParams }

export default function ParamsEditor({
  topics,
  initialParams,
  onSave,
  isSaving,
}: ParamsEditorProps) {
  const [params, setParams] = useState<Map<string, ParamValues>>(() => {
    const map = new Map(initialParams)
    for (const t of topics) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          topic_id: t.id,
          estimated_hours: 0,
          priority: 3,
          deadline: "",
          earliest_start: "",
          depends_on: [],
          revision_sessions: 0,
          practice_sessions: 0,
        })
      }
    }
    return map
  })

  const [showAdvanced, setShowAdvanced] = useState<Set<string>>(new Set())

  const update = (topicId: string, field: keyof ParamValues, value: unknown) => {
    setParams((prev) => {
      const next = new Map(prev)
      const current = next.get(topicId)
      if (current) {
        next.set(topicId, { ...current, [field]: value })
      }
      return next
    })
  }

  const toggleAdvanced = (topicId: string) => {
    setShowAdvanced((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  const canProceed = Array.from(params.values()).some(
    (p) => p.estimated_hours > 0
  )

  const handleSave = () => {
    onSave(
      Array.from(params.values()).filter((p) => p.estimated_hours > 0)
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-white/30 uppercase tracking-widest font-medium">
          Phase 2
        </p>
        <h2 className="text-xl font-semibold">Topic Parameters</h2>
        <p className="text-sm text-white/50">
          Set effort and priority for each topic. Only estimated hours is
          required.
        </p>
      </div>

      <div className="space-y-3">
        {topics.map((t) => {
          const p = params.get(t.id)!
          const advanced = showAdvanced.has(t.id)

          return (
            <div
              key={t.id}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white/80">
                    {t.topic_name}
                  </div>
                  <div className="text-[10px] text-white/30">
                    {t.subject_name}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                    Estimated hours *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={p.estimated_hours || ""}
                    onChange={(e) =>
                      update(
                        t.id,
                        "estimated_hours",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="e.g. 20"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                    Priority
                  </label>
                  <select
                    value={p.priority}
                    onChange={(e) =>
                      update(t.id, "priority", parseInt(e.target.value))
                    }
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none"
                  >
                    <option value={1}>1 - Highest</option>
                    <option value={2}>2 - High</option>
                    <option value={3}>3 - Medium</option>
                    <option value={4}>4 - Low</option>
                    <option value={5}>5 - Lowest</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => toggleAdvanced(t.id)}
                className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
              >
                {advanced ? "▾ Hide advanced" : "▸ Advanced options"}
              </button>

              {advanced && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                      Deadline override
                    </label>
                    <input
                      type="date"
                      value={p.deadline}
                      onChange={(e) =>
                        update(t.id, "deadline", e.target.value)
                      }
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                      Earliest start
                    </label>
                    <input
                      type="date"
                      value={p.earliest_start}
                      onChange={(e) =>
                        update(t.id, "earliest_start", e.target.value)
                      }
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                      Revision sessions
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={p.revision_sessions || ""}
                      onChange={(e) =>
                        update(
                          t.id,
                          "revision_sessions",
                          parseInt(e.target.value) || 0
                        )
                      }
                      placeholder="0"
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                      Practice sessions
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={p.practice_sessions || ""}
                      onChange={(e) =>
                        update(
                          t.id,
                          "practice_sessions",
                          parseInt(e.target.value) || 0
                        )
                      }
                      placeholder="0"
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm focus:border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!canProceed || isSaving}
          className="btn-primary disabled:opacity-40"
        >
          {isSaving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  )
}
