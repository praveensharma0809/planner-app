"use client"

import { useState } from "react"
import { generatePlan } from "@/lib/planner/generatePlan"
import { analyzePlanAction } from "@/app/actions/plan/analyzePlan"
import { commitPlan } from "@/app/actions/plan/commitPlan"

export default function PlannerPage() {
  const [loading, setLoading] = useState(false)
  const [overloadData, setOverloadData] = useState<any>(null)
  const [success, setSuccess] = useState<any>(null)
  const [blueprint, setBlueprint] = useState<any>(null)
  const [commitResult, setCommitResult] = useState<any>(null)

  const handleGenerate = async (mode: "strict" | "auto") => {
    setLoading(true)
    setSuccess(null)

    const res = await generatePlan(mode)

    setLoading(false)

    if (res.status === "OVERLOAD") {
      setOverloadData(res)
      return
    }

    if (res.status === "SUCCESS") {
      setOverloadData(null)
      setSuccess(res)
      return
    }

    alert(JSON.stringify(res))
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Planner</h1>

      <button
        onClick={() => handleGenerate("strict")}
        disabled={loading}
        className="px-6 py-3 bg-white text-black rounded-lg"
      >
        {loading ? "Generating..." : "Generate Plan"}
      </button>

      {success && (
        <div className="mt-6 bg-green-900/30 p-4 rounded">
          <p>Plan generated successfully.</p>
          <p>Tasks created: {success.taskCount}</p>
        </div>
      )}

      {overloadData && (
        <div className="mt-8 bg-red-900/30 p-6 rounded space-y-4">
          <h2 className="text-xl font-semibold">Overload Detected</h2>

          <p>
            Required daily minutes:{" "}
            <strong>{Math.ceil(overloadData.burnRate)}</strong>
          </p>

          <p>
            Your current daily capacity:{" "}
            <strong>{overloadData.currentCapacity}</strong>
          </p>

          <p>
            Suggested capacity to meet deadlines:{" "}
            <strong>{overloadData.suggestedCapacity}</strong>
          </p>

          <div className="flex gap-4 mt-4">
            <button
              onClick={() => handleGenerate("strict")}
              className="px-4 py-2 bg-white text-black rounded"
            >
              Proceed Strict Anyway
            </button>

            <button
              onClick={() => handleGenerate("auto")}
              className="px-4 py-2 bg-yellow-400 text-black rounded"
            >
              Auto Adjust & Generate
            </button>
          </div>
        </div>
      )}

      <div className="mt-12 border-t border-white/10 pt-8">
        <h2 className="text-2xl font-semibold mb-4">New Flow: Analyze → Commit</h2>

        <div className="flex gap-4 mb-4">
          <button
            onClick={async () => {
              setLoading(true)
              setBlueprint(null)
              setCommitResult(null)
              const res = await analyzePlanAction()
              setLoading(false)
              if (res.status === "READY") {
                setBlueprint(res)
              } else {
                setBlueprint(res)
              }
            }}
            disabled={loading}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg"
          >
            {loading ? "Analyzing..." : "Analyze Plan"}
          </button>

          {blueprint?.status === "READY" && (
            <button
              onClick={async () => {
                setLoading(true)
                const result = await commitPlan({ tasks: blueprint.tasks })
                setLoading(false)
                setCommitResult(result)
              }}
              disabled={loading}
              className="px-6 py-3 bg-green-500 text-white rounded-lg"
            >
              {loading ? "Committing..." : "Confirm & Commit"}
            </button>
          )}
        </div>

        {blueprint && (
          <div className="bg-white/5 p-4 rounded space-y-2">
            <div className="font-semibold">Analyze Result: {blueprint.status}</div>
            {blueprint.status === "READY" && (
              <div className="text-sm text-white/80">
                Tasks to create: {blueprint.taskCount} | Daily gap: {Math.ceil(blueprint.overload.capacityGapMinPerDay)} minutes
              </div>
            )}
            {blueprint.status === "OVERLOAD" && (
              <div className="text-sm text-white/80">
                Overload detected. Suggested capacity: {Math.ceil(blueprint.suggestedCapacity)}
              </div>
            )}
          </div>
        )}

        {commitResult && commitResult.status === "SUCCESS" && (
          <div className="mt-4 bg-green-900/30 p-3 rounded">
            Committed {commitResult.taskCount} tasks.
          </div>
        )}
      </div>
    </div>
  )
}
