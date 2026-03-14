"use client"

import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { getDraftFeasibility } from "@/app/actions/planner/getDraftFeasibility"
import type {
  PlannerConstraintValues,
  PlannerParamValues,
} from "@/lib/planner/draftTypes"
import type { FeasibilityResult, UnitFeasibilityStatus } from "@/lib/planner/types"

function minToHuman(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

function canAnalyze(
  params: PlannerParamValues[],
  constraints: PlannerConstraintValues | null,
  enabled: boolean
): constraints is PlannerConstraintValues {
  return Boolean(
    enabled &&
      constraints &&
      constraints.study_start_date &&
      constraints.exam_date &&
      constraints.study_start_date < constraints.exam_date &&
      params.some((param) => param.estimated_hours > 0)
  )
}

export function useDraftFeasibility(
  params: PlannerParamValues[],
  constraints: PlannerConstraintValues | null,
  enabled = true
) {
  const activeParams = useMemo(
    () => params.filter((param) => param.estimated_hours > 0),
    [params]
  )
  const analyzable = canAnalyze(activeParams, constraints, enabled)
  const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (!analyzable) {
      return
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        setLoading(true)
      })

      void getDraftFeasibility(activeParams, constraints).then(
        (result) => {
          if (requestIdRef.current !== requestId) {
            return
          }

          startTransition(() => {
            setFeasibility(result.status === "SUCCESS" ? result.feasibility : null)
            setLoading(false)
          })
        },
        () => {
          if (requestIdRef.current !== requestId) {
            return
          }

          startTransition(() => {
            setFeasibility(null)
            setLoading(false)
          })
        })
    }, 350)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeParams, analyzable, constraints])

  return {
    feasibility: analyzable ? feasibility : null,
    loading: analyzable ? loading : false,
  }
}

export function RiskDot({
  status,
  configured,
}: {
  status?: UnitFeasibilityStatus
  configured: boolean
}) {
  if (!status) {
    return (
      <div
        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300 ${
          configured
            ? "bg-emerald-400/80 shadow-sm shadow-emerald-400/40"
            : "bg-white/10"
        }`}
      />
    )
  }

  const styles: Record<UnitFeasibilityStatus, { className: string; label: string }> = {
    safe: {
      className: "bg-emerald-400/90 shadow-sm shadow-emerald-400/40",
      label: "Safe",
    },
    tight: {
      className: "bg-amber-300/90 shadow-sm shadow-amber-300/30",
      label: "Tight",
    },
    at_risk: {
      className: "bg-orange-400/90 shadow-sm shadow-orange-400/30",
      label: "At risk",
    },
    impossible: {
      className: "bg-red-400/90 shadow-sm shadow-red-400/30",
      label: "Impossible",
    },
  }

  return (
    <div
      title={styles[status].label}
      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300 ${styles[status].className}`}
    />
  )
}

export function PlannerFeasibilityBar({
  feasibility,
  loading,
}: {
  feasibility: FeasibilityResult | null
  loading: boolean
}) {
  if (!loading && !feasibility) {
    return null
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs text-white/45 animate-pulse">
        Checking plan health...
      </div>
    )
  }

  if (!feasibility) {
    return null
  }

  const safeCount = feasibility.units.filter((unit) => unit.status === "safe").length
  const tightCount = feasibility.units.filter((unit) => unit.status === "tight").length
  const atRiskCount = feasibility.units.filter((unit) => unit.status === "at_risk").length
  const impossibleCount = feasibility.units.filter((unit) => unit.status === "impossible").length

  const tone = feasibility.feasible
    ? {
        container: "border-emerald-500/20 bg-emerald-500/[0.05]",
        badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        label: "Feasible",
      }
    : feasibility.flexFeasible
      ? {
          container: "border-amber-500/20 bg-amber-500/[0.05]",
          badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          label: "Fits with flexibility",
        }
      : {
          container: "border-red-500/20 bg-red-500/[0.05]",
          badge: "bg-red-500/15 text-red-300 border-red-500/30",
          label: feasibility.globalGap > 0 ? `${Math.ceil(feasibility.globalGap / 60)}h short` : "At risk",
        }

  const availableMinutes = feasibility.flexFeasible
    ? feasibility.totalFlexAvailable ?? feasibility.totalSlotsAvailable
    : feasibility.totalSlotsAvailable

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-3 ${tone.container}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">
            Plan Health
          </p>
          <p className="text-sm text-white/75">
            {minToHuman(feasibility.totalSessionsNeeded)} needed / {minToHuman(availableMinutes)} available
          </p>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold ${tone.badge}`}>
          {tone.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-white/70">
          <span className="block text-white/35 uppercase tracking-wide text-[10px]">Safe</span>
          <span className="font-semibold">{safeCount}</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-white/70">
          <span className="block text-white/35 uppercase tracking-wide text-[10px]">Tight</span>
          <span className="font-semibold">{tightCount}</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-white/70">
          <span className="block text-white/35 uppercase tracking-wide text-[10px]">At Risk</span>
          <span className="font-semibold">{atRiskCount}</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-white/70">
          <span className="block text-white/35 uppercase tracking-wide text-[10px]">Impossible</span>
          <span className="font-semibold">{impossibleCount}</span>
        </div>
      </div>
    </div>
  )
}