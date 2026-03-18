"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CUSTOM_DAY_CAPACITY_PRESETS,
} from "@/lib/planner/draft"
import type {
  PlannerConstraintValues as ConstraintValues,
  PlannerParamValues as ParamValues,
  PlannerSubjectOption,
} from "@/lib/planner/draft"
import type { PlanOrderCriterion, TopicOrderingMode } from "@/lib/planner/engine"
import { PlannerFeasibilityBar, useDraftFeasibility } from "./planner-feasibility"
import StudyOrderPanel from "./StudyOrderPanel"

interface ConstraintsFormProps {
  initial: ConstraintValues | null
  subjects: PlannerSubjectOption[]
  topicParams: ParamValues[]
  onSave: (config: ConstraintValues) => void
  isSaving: boolean
}

export type { ConstraintValues }

// ── Helpers ──────────────────────────────────────────────────────────────────

function minToHuman(min: number): string {
  if (!min || min <= 0) return "—"
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null
  const diff = new Date(b).getTime() - new Date(a).getTime()
  return Math.ceil(diff / 86_400_000)
}

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function addMonths(date: Date, count: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + count)
  return next
}

function buildSubjectOrderingDefaults(subjects: PlannerSubjectOption[]) {
  return Object.fromEntries(
    subjects.map((subject) => [subject.id, "sequential" as TopicOrderingMode])
  )
}

function buildFlexibleThresholdDefaults(subjects: PlannerSubjectOption[]) {
  return Object.fromEntries(
    subjects.map((subject) => [subject.id, 0.8])
  )
}

function buildInitialConfig(
  initial: ConstraintValues | null,
  today: string,
  subjects: PlannerSubjectOption[]
): ConstraintValues {
  return {
    study_start_date: initial?.study_start_date ?? today,
    exam_date: initial?.exam_date ?? "",
    weekday_capacity_minutes: initial?.weekday_capacity_minutes ?? 120,
    weekend_capacity_minutes: initial?.weekend_capacity_minutes ?? 180,
    plan_order: initial?.plan_order ?? "balanced",
    final_revision_days: initial?.final_revision_days ?? 0,
    buffer_percentage: initial?.buffer_percentage ?? 0,
    max_active_subjects: initial?.max_active_subjects ?? 0,
    day_of_week_capacity:
      initial?.day_of_week_capacity ?? [null, null, null, null, null, null, null],
    custom_day_capacity: initial?.custom_day_capacity ?? {},
    plan_order_stack: initial?.plan_order_stack ?? ["urgency", "subject_order", "deadline"],
    flexibility_minutes: initial?.flexibility_minutes ?? 0,
    max_daily_minutes: initial?.max_daily_minutes ?? 480,
    max_topics_per_subject_per_day: initial?.max_topics_per_subject_per_day ?? 1,
    min_subject_gap_days: initial?.min_subject_gap_days ?? 0,
    subject_ordering: {
      ...buildSubjectOrderingDefaults(subjects),
      ...(initial?.subject_ordering ?? {}),
    },
    flexible_threshold: {
      ...buildFlexibleThresholdDefaults(subjects),
      ...(initial?.flexible_threshold ?? {}),
    },
  }
}

function resolveCapacityForDate(config: ConstraintValues, isoDate: string): number {
  if (isoDate in config.custom_day_capacity) {
    return config.custom_day_capacity[isoDate]
  }

  const date = new Date(`${isoDate}T12:00:00`)
  const dayOfWeek = date.getDay()
  const override = config.day_of_week_capacity[dayOfWeek]
  if (override != null) {
    return override
  }

  return dayOfWeek === 0 || dayOfWeek === 6
    ? config.weekend_capacity_minutes
    : config.weekday_capacity_minutes
}

// ── Sub-components ────────────────────────────────────────────────────────────

const dateInputCls =
  "w-full bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-indigo-400/30 focus:border-indigo-400/60 focus:bg-white/[0.04] px-2 py-1.5 text-sm outline-none transition-all duration-200 text-white/80 [color-scheme:dark]"

const sectionHeadCls =
  "px-4 py-1.5 bg-gradient-to-r from-white/[0.03] to-transparent border-b border-white/[0.04] flex items-center gap-2"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={sectionHeadCls}>
      <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{children}</span>
    </div>
  )
}

function PresetPills({
  options,
  value,
  onChange,
  suffix = "",
}: {
  options: number[]
  value: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <div className="flex items-center flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded border transition-all duration-150 ${
            value === opt
              ? "text-indigo-300 bg-indigo-500/15 border-indigo-500/40"
              : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
          }`}
        >
          {opt}{suffix}
        </button>
      ))}
    </div>
  )
}

function CapacityRow({
  label,
  value,
  onChange,
  required,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  required?: boolean
}) {
  const presets = [60, 90, 120, 150, 180, 240]
  return (
    <div className="grid items-center gap-4 px-4 py-2.5"
      style={{ gridTemplateColumns: "110px 1fr auto" }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-white/70 font-medium">{label}</span>
        {required && <span className="text-red-400/60 text-[10px]">*</span>}
      </div>
      <PresetPills options={presets} value={value} onChange={onChange} />
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          min="0"
          step="30"
          value={value > 0 ? value : ""}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          placeholder="min"
          className="w-16 text-center bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-indigo-400/30 focus:border-indigo-400/60 px-1 py-1 text-sm outline-none transition-all duration-200 placeholder:text-white/20 [appearance:textfield]"
        />
        <span className="text-xs text-white/35 w-14 shrink-0">{minToHuman(value)}</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const ALL_CRITERIA: {
  value: PlanOrderCriterion
  label: string
  desc: string
  dotClass: string
}[] = [
  {
    value: "urgency",
    label: "Urgency",
    desc: "More remaining work with fewer days left",
    dotClass: "bg-indigo-400/60",
  },
  {
    value: "priority",
    label: "Priority",
    desc: "High before medium and low",
    dotClass: "bg-rose-400/60",
  },
  {
    value: "deadline",
    label: "Deadline",
    desc: "Sooner due dates first",
    dotClass: "bg-amber-400/60",
  },
  {
    value: "subject_order",
    label: "Subject Order",
    desc: "Follow your Phase 1 subject order",
    dotClass: "bg-emerald-400/60",
  },
  {
    value: "effort",
    label: "Effort",
    desc: "Larger unfinished topics first",
    dotClass: "bg-violet-400/60",
  },
  {
    value: "completion",
    label: "Momentum",
    desc: "Topics that are close to done",
    dotClass: "bg-cyan-400/60",
  },
]

const ORDER_PRESETS: Array<{
  id: string
  label: string
  hint: string
  stack: PlanOrderCriterion[]
}> = [
  {
    id: "balanced",
    label: "Balanced",
    hint: "Default",
    stack: ["urgency", "priority", "deadline"],
  },
  {
    id: "priority-first",
    label: "Priority First",
    hint: "High-priority focus",
    stack: ["priority", "urgency", "deadline"],
  },
  {
    id: "deadline-first",
    label: "Deadline First",
    hint: "Closest due dates",
    stack: ["deadline", "urgency", "priority"],
  },
]

function toOrdinalLabel(position: number): string {
  const index = position + 1
  if (index === 1) return "1st"
  if (index === 2) return "2nd"
  if (index === 3) return "3rd"
  return `${index}th`
}

export function PlanOrderStack({
  stack,
  onChange,
}: {
  stack: PlanOrderCriterion[]
  onChange: (stack: PlanOrderCriterion[]) => void
}) {
  const normalizedStack: PlanOrderCriterion[] =
    stack.length > 0 ? stack : ["urgency"]

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const next = [...normalizedStack]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }
  const moveDown = (idx: number) => {
    if (idx >= normalizedStack.length - 1) return
    const next = [...normalizedStack]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }
  const toggle = (criterion: PlanOrderCriterion) => {
    if (normalizedStack.includes(criterion)) {
      if (normalizedStack.length <= 1) return
      onChange(normalizedStack.filter((c) => c !== criterion))
    } else {
      onChange([...normalizedStack, criterion])
    }
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <p className="text-[11px] text-white/35 leading-relaxed">
        Put your rules in order. The planner checks the 1st rule first, then uses the next rules only to break ties.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ORDER_PRESETS.map((preset) => {
          const isActive =
            preset.stack.length === normalizedStack.length
            && preset.stack.every((criterion, idx) => normalizedStack[idx] === criterion)
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.stack)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                isActive
                  ? "text-sky-200 bg-sky-500/15 border-sky-500/40"
                  : "text-white/35 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/65"
              }`}
            >
              {preset.label}
              <span className="ml-1 text-[10px] opacity-70">{preset.hint}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-1">
        {normalizedStack.map((criterion, idx) => {
          const meta = ALL_CRITERIA.find((m) => m.value === criterion) ?? ALL_CRITERIA[0]
          return (
            <div
              key={criterion}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 group"
            >
              <span className="text-[10px] text-white/30 font-semibold w-8 shrink-0">{toOrdinalLabel(idx)}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-white/70">{meta.label}</span>
                <span className="text-[10px] text-white/30 ml-2">{meta.desc}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-[10px] text-white/35 hover:text-white/65 disabled:text-white/10 px-1"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === normalizedStack.length - 1}
                  className="text-[10px] text-white/35 hover:text-white/65 disabled:text-white/10 px-1"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => toggle(criterion)}
                  className="text-[10px] text-red-400/30 hover:text-red-400 px-1"
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {ALL_CRITERIA.filter((m) => !normalizedStack.includes(m.value)).length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {ALL_CRITERIA.filter((m) => !normalizedStack.includes(m.value)).map((meta) => (
            <button
              key={meta.value}
              type="button"
              onClick={() => toggle(meta.value)}
              className="text-[10px] font-semibold px-2 py-0.5 rounded border border-white/[0.08] text-white/35 bg-transparent hover:border-white/20 hover:text-white/60 transition-all duration-150"
            >
              + {meta.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function DayOfWeekOverrides({
  values,
  weekdayDefault,
  weekendDefault,
  onChange,
}: {
  values: (number | null)[]
  weekdayDefault: number
  weekendDefault: number
  onChange: (values: (number | null)[]) => void
}) {
  const [open, setOpen] = useState(false)
  const hasOverrides = values.some((v) => v !== null)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-wider font-medium hover:text-white/60 transition-colors"
      >
        <svg
          width="10" height="10" viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="M4.5 2.5L8 6l-3.5 3.5" />
        </svg>
        Per-Day-of-Week Overrides
        {hasOverrides && (
          <span className="text-[9px] text-sky-400/60 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5 normal-case">
            {values.filter((v) => v !== null).length} customized
          </span>
        )}
      </button>

      {open && (
        <div className="grid grid-cols-7 gap-2">
          {DAY_NAMES.map((name, idx) => {
            const isWeekend = idx === 0 || idx === 6
            const fallback = isWeekend ? weekendDefault : weekdayDefault
            const current = values[idx]
            const isCustom = current !== null
            return (
              <div key={name} className="space-y-1">
                <div className="text-[10px] text-white/40 text-center font-medium">{name}</div>
                <input
                  type="number" min="0" step="30"
                  value={isCustom ? current : ""}
                  onChange={(e) => {
                    const next = [...values]
                    const val = parseInt(e.target.value)
                    next[idx] = isNaN(val) ? null : Math.max(0, val)
                    onChange(next)
                  }}
                  placeholder={String(fallback)}
                  className={`w-full text-center text-xs py-1 rounded border outline-none transition-all duration-200 [appearance:textfield] placeholder:text-white/15 ${
                    isCustom
                      ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
                      : "bg-white/[0.02] border-white/[0.08] text-white/40 hover:border-white/20"
                  }`}
                />
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...values]
                      next[idx] = null
                      onChange(next)
                    }}
                    className="text-[9px] text-white/20 hover:text-red-400 w-full text-center transition-colors"
                  >
                    reset
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface CalendarMonth {
  key: string
  label: string
  weeks: (string | null)[][]
  firstDate: string
  lastDate: string
}

function buildCalendarMonths(startDate: string, endDate: string): CalendarMonth[] {
  if (!startDate || !endDate || startDate > endDate) {
    return []
  }

  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  const cursor = new Date(start)
  cursor.setDate(1)
  end.setDate(1)

  const months: CalendarMonth[] = []

  while (cursor <= end) {
    const monthStart = new Date(cursor)
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const weeks: (string | null)[][] = []
    let currentWeek = new Array<string | null>(monthStart.getDay()).fill(null)

    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12)
      currentWeek.push(toIsoDate(date))
      if (currentWeek.length === 7) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      weeks.push(currentWeek)
    }

    const monthDates = weeks
      .flat()
      .filter((isoDate): isoDate is string => Boolean(isoDate))

    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      weeks,
      firstDate: monthDates[0] ?? startDate,
      lastDate: monthDates[monthDates.length - 1] ?? endDate,
    })

    const next = addMonths(cursor, 1)
    cursor.setFullYear(next.getFullYear(), next.getMonth(), 1)
  }

  return months
}

function CustomDayCapacityCalendar({
  config,
  onChange,
}: {
  config: ConstraintValues
  onChange: (next: ConstraintValues) => void
}) {
  const months = useMemo(
    () => buildCalendarMonths(config.study_start_date, config.exam_date),
    [config.study_start_date, config.exam_date]
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visibleMonthKey, setVisibleMonthKey] = useState<string | null>(null)
  const activeSelectedDate =
    selectedDate
    && selectedDate >= config.study_start_date
    && selectedDate <= config.exam_date
      ? selectedDate
      : null

  useEffect(() => {
    if (months.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisibleMonthKey(null)
      return
    }

    if (visibleMonthKey && months.some((month) => month.key === visibleMonthKey)) {
      return
    }

    const preferredDate = activeSelectedDate ?? toIsoDate(new Date())
    const defaultMonth = months.find(
      (month) => preferredDate >= month.firstDate && preferredDate <= month.lastDate
    ) ?? months[0]

    setVisibleMonthKey(defaultMonth.key)
  }, [months, visibleMonthKey, activeSelectedDate])

  if (months.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-white/35">
        Set a valid study window to customize specific dates.
      </div>
    )
  }

  const visibleMonthIndex = months.findIndex((month) => month.key === visibleMonthKey)
  const monthIndex = visibleMonthIndex >= 0 ? visibleMonthIndex : 0
  const month = months[monthIndex]
  const hasPrevMonth = monthIndex > 0
  const hasNextMonth = monthIndex < months.length - 1

  const setCapacity = (value: number | null) => {
    if (!activeSelectedDate) return

    const nextOverrides = { ...config.custom_day_capacity }
    if (value == null) {
      delete nextOverrides[activeSelectedDate]
    } else {
      nextOverrides[activeSelectedDate] = value
    }

    onChange({ ...config, custom_day_capacity: nextOverrides })
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="text-[11px] text-white/35 leading-relaxed">
        Pick a date to override. Off stores a custom 0-minute day and stays fully blocked.
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => hasPrevMonth && setVisibleMonthKey(months[monthIndex - 1].key)}
            disabled={!hasPrevMonth}
            className="text-[11px] px-2 py-1 rounded border border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70 disabled:text-white/20 disabled:border-white/[0.04]"
          >
            Prev
          </button>
          <div className="text-sm font-semibold text-white/80 text-center">{month.label}</div>
          <button
            type="button"
            onClick={() => hasNextMonth && setVisibleMonthKey(months[monthIndex + 1].key)}
            disabled={!hasNextMonth}
            className="text-[11px] px-2 py-1 rounded border border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70 disabled:text-white/20 disabled:border-white/[0.04]"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[10px] text-white/30 uppercase tracking-wide">
          {DAY_NAMES.map((day) => (
            <div key={`${month.key}-${day}`} className="text-center py-1">{day}</div>
          ))}
        </div>

        <div className="space-y-1">
          {month.weeks.map((week, weekIndex) => (
            <div key={`${month.key}-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
              {week.map((isoDate, dayIndex) => {
                if (!isoDate) {
                  return <div key={`${month.key}-empty-${weekIndex}-${dayIndex}`} className="h-8 rounded" />
                }

                const defaultCapacity = resolveCapacityForDate(
                  { ...config, custom_day_capacity: {} },
                  isoDate
                )
                const customCapacity = config.custom_day_capacity[isoDate]
                const isSelected = activeSelectedDate === isoDate
                const tone =
                  customCapacity == null
                    ? "border-white/[0.06] bg-white/[0.02] text-white/60"
                    : customCapacity === 0
                      ? "border-white/[0.08] bg-white/[0.05] text-white/45"
                      : customCapacity > defaultCapacity
                        ? "border-sky-500/35 bg-sky-500/10 text-sky-200"
                        : customCapacity < defaultCapacity
                          ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"

                return (
                  <div
                    key={isoDate}
                    draggable={false}
                    className={`h-8 rounded border px-1 py-0.5 text-left transition-all ${tone} ${
                      isSelected ? "ring-1 ring-indigo-400/60" : "hover:border-white/20"
                    } cursor-pointer`}
                    onClick={() => setSelectedDate(isoDate)}
                  >
                    <div className="text-[9px] font-semibold leading-none">{isoDate.slice(-2)}</div>
                    <div className="text-[8px] opacity-70 leading-none mt-0.5">
                      {minToHuman(customCapacity ?? defaultCapacity)}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="text-[10px] text-white/25">
          Blue: extra time · Amber: reduced time · Green: same as default · Gray: off day
        </div>
      </div>

      {activeSelectedDate && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-white/80">{activeSelectedDate}</div>
              <div className="text-[11px] text-white/35">
                Default: {minToHuman(resolveCapacityForDate({ ...config, custom_day_capacity: {} }, activeSelectedDate))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCapacity(null)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded border border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70"
            >
              Clear Override
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CUSTOM_DAY_CAPACITY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCapacity(preset)}
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded border transition-all ${
                  config.custom_day_capacity[activeSelectedDate] === preset
                    ? "text-sky-200 bg-sky-500/15 border-sky-500/40"
                    : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                }`}
              >
                {preset === 0 ? "Off" : minToHuman(preset)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-white/35">
            <span>Custom minutes</span>
            <input
              type="number"
              min="0"
              step="30"
              value={config.custom_day_capacity[activeSelectedDate] ?? ""}
              onChange={(e) => {
                const nextValue = parseInt(e.target.value)
                if (Number.isNaN(nextValue)) {
                  setCapacity(null)
                  return
                }
                setCapacity(Math.max(0, nextValue))
              }}
              placeholder="Default"
              className="w-20 text-center bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-indigo-400/30 focus:border-indigo-400/60 px-1 py-0.5 text-xs outline-none transition-all duration-200 [appearance:textfield] placeholder:text-white/20"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConstraintsForm({
  initial,
  subjects,
  topicParams,
  onSave,
  isSaving,
}: ConstraintsFormProps) {
  const today = new Date().toISOString().split("T")[0]

  const [config, setConfig] = useState<ConstraintValues>(() =>
    buildInitialConfig(initial, today, subjects)
  )

  const update = <K extends keyof ConstraintValues>(field: K, value: ConstraintValues[K]) =>
    setConfig((prev) => ({ ...prev, [field]: value }))
  const { feasibility: liveFeasibility, loading: liveFeasibilityLoading } = useDraftFeasibility(
    topicParams,
    config,
    topicParams.length > 0
  )

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalDays = useMemo(
    () => daysBetween(config.study_start_date, config.exam_date),
    [config.study_start_date, config.exam_date]
  )
  const effectiveDays =
    totalDays != null && totalDays > config.final_revision_days
      ? totalDays - config.final_revision_days
      : totalDays

  const avgDailyHours = useMemo(() => {
    const avg = (config.weekday_capacity_minutes * 5 + config.weekend_capacity_minutes * 2) / 7
    return minToHuman(Math.round(avg))
  }, [config.weekday_capacity_minutes, config.weekend_capacity_minutes])

  // ── Validation ──────────────────────────────────────────────────────────────
  const dateError =
    config.study_start_date && config.exam_date && config.study_start_date >= config.exam_date
      ? "Exam date must be after start date."
      : null

  const hasPositiveCapacityOverride =
    config.day_of_week_capacity.some((value) => (value ?? 0) > 0)
    || Object.values(config.custom_day_capacity).some((value) => value > 0)

  const capacityError =
    config.weekday_capacity_minutes === 0
    && config.weekend_capacity_minutes === 0
    && !hasPositiveCapacityOverride
      ? "Set at least one daily capacity or add a positive override."
      : null

  const canProceed =
    !dateError &&
    !capacityError &&
    !!config.study_start_date &&
    !!config.exam_date

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header — same style as Phase 1 & 2 */}
      <div className="relative">
        <div className="flex items-end justify-between pb-3 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-sky-400 to-indigo-500 rounded-full" />
              <p className="text-[10px] text-sky-400/80 uppercase tracking-widest font-semibold">Phase 3</p>
            </div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              Planning Constraints
            </h2>
            <p className="text-xs text-white/40 font-light">Define your study window, capacity and pacing</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] flex-wrap justify-end">
            {totalDays != null && totalDays > 0 && !dateError && (
              <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 rounded-md text-sky-300 font-medium">
                {totalDays} days total
              </span>
            )}
            {effectiveDays != null && config.final_revision_days > 0 && !dateError && (
              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-300 font-medium">
                {effectiveDays} study days
              </span>
            )}
            {(config.weekday_capacity_minutes > 0 || config.weekend_capacity_minutes > 0) && (
              <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-300 font-medium">
                ~{avgDailyHours}/day avg
              </span>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />
      </div>

      <PlannerFeasibilityBar
        feasibility={liveFeasibility}
        loading={liveFeasibilityLoading}
      />

      {/* Card container */}
      <div className="relative rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.02] to-white/[0.01] shadow-lg shadow-black/5 overflow-hidden backdrop-blur-sm">

        {/* ── Section 1: Study Window ── */}
        <SectionLabel>Study Window</SectionLabel>
        <div className="grid gap-4 px-4 py-3" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium flex items-center gap-1">
              Study Start <span className="text-red-400/60">*</span>
            </label>
            <input
              type="date"
              value={config.study_start_date}
              onChange={(e) => update("study_start_date", e.target.value)}
              className={dateInputCls}
            />
          </div>

          {/* Derived days badge in the middle */}
          <div className="flex items-end pb-1.5 justify-center">
            {totalDays != null && totalDays > 0 && !dateError ? (
              <div className="flex flex-col items-center gap-0.5 px-3">
                <span className="text-[18px] font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent leading-none">
                  {totalDays}
                </span>
                <span className="text-[9px] text-white/30 uppercase tracking-widest">days</span>
              </div>
            ) : (
              <div className="flex items-center pb-1">
                <span className="text-white/15 text-lg">→</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium flex items-center gap-1">
              Exam Date <span className="text-red-400/60">*</span>
            </label>
            <input
              type="date"
              value={config.exam_date}
              onChange={(e) => update("exam_date", e.target.value)}
              className={`${dateInputCls} ${dateError ? "border-red-500/50" : ""}`}
            />
          </div>
        </div>

        {dateError && (
          <p className="px-4 pb-2 text-xs text-red-400/80 -mt-1">{dateError}</p>
        )}

        {/* ── Section 2: Daily Capacity + Overrides ── */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <SectionLabel>Daily Capacity and Overrides</SectionLabel>
        <p className="px-4 pt-2 text-[11px] text-white/30">
          Set your regular daily hours, then override specific weekdays or dates when needed.
        </p>

        <CapacityRow
          label="Weekday"
          value={config.weekday_capacity_minutes}
          onChange={(v) => update("weekday_capacity_minutes", v)}
          required
        />
        <div className="h-px mx-8 bg-white/[0.03]" />
        <CapacityRow
          label="Weekend"
          value={config.weekend_capacity_minutes}
          onChange={(v) => update("weekend_capacity_minutes", v)}
        />

        {capacityError && (
          <p className="px-4 pb-2 text-xs text-red-400/80">{capacityError}</p>
        )}

        {/* Per-day-of-week overrides grouped with daily capacity */}
        <div className="px-4 pb-3">
          <DayOfWeekOverrides
            values={config.day_of_week_capacity}
            weekdayDefault={config.weekday_capacity_minutes}
            weekendDefault={config.weekend_capacity_minutes}
            onChange={(dow) => setConfig((prev) => ({ ...prev, day_of_week_capacity: dow }))}
          />
        </div>

        <CustomDayCapacityCalendar
          config={config}
          onChange={setConfig}
        />

        {/* ── Section 3: Internal Ordering ── */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <SectionLabel>Ordering Logic</SectionLabel>
        <p className="px-4 py-3 text-[11px] text-white/30 leading-relaxed">
          Ordering is now fixed internally for reliability: urgency mix first, then your subject and topic order as tie-breakers.
          This removes noisy controls while preserving predictable outcomes.
        </p>

        {/* ── Section 4: Study Order ── */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <SectionLabel>Study Order — Drag subjects and topics to set the order</SectionLabel>

        <StudyOrderPanel
          subjects={subjects}
          config={config}
          onChange={setConfig}
        />

        {/* ── Section 5: Fine-Tuning ── */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <SectionLabel>Fine-Tuning</SectionLabel>

        <div className="px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Focus Depth */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Subjects per day
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {([{ value: 0, label: "All" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("max_active_subjects", opt.value)}
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border transition-all duration-150 ${
                      config.max_active_subjects === opt.value
                        ? "text-sky-300 bg-sky-500/15 border-sky-500/40"
                        : "text-white/30 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/20">
                {config.max_active_subjects === 0
                  ? "All subjects can appear each day"
                  : `Top ${config.max_active_subjects} urgent subjects per day`}
              </p>
            </div>

            {/* Flexibility Allowance */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Overflow allowance
              </label>
              <div className="flex flex-wrap gap-1">
                {[0, 15, 30, 45, 60, 90, 120].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update("flexibility_minutes", opt)}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition-all duration-150 ${
                      config.flexibility_minutes === opt
                        ? "text-amber-300 bg-amber-500/15 border-amber-500/40"
                        : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                    }`}
                  >
                    {opt === 0 ? "0" : `+${opt}m`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/20">
                {config.flexibility_minutes === 0
                  ? "Never go over daily capacity"
                  : `Can go up to +${config.flexibility_minutes}m over capacity if needed`}
              </p>
            </div>

            {/* Max Daily Minutes */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Daily hard ceiling
              </label>
              <PresetPills
                options={[240, 360, 480, 600, 720]}
                value={config.max_daily_minutes}
                onChange={(v) => update("max_daily_minutes", v)}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number" min="30" max="720" step="30"
                  value={config.max_daily_minutes > 0 ? config.max_daily_minutes : ""}
                  onChange={(e) => update("max_daily_minutes", Math.min(720, Math.max(30, parseInt(e.target.value) || 480)))}
                  placeholder="480"
                  className="w-16 text-center bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-sky-400/30 focus:border-sky-400/60 px-1 py-0.5 text-xs outline-none transition-all duration-200 [appearance:textfield] placeholder:text-white/20"
                />
                <span className="text-xs text-white/30">{minToHuman(config.max_daily_minutes)} — absolute max</span>
              </div>
            </div>

            {/* Revision Reserve */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Revision days at the end
              </label>
              <div className="flex flex-wrap gap-1">
                {[0, 3, 5, 7, 14].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update("final_revision_days", opt)}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition-all duration-150 ${
                      config.final_revision_days === opt
                        ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/40"
                        : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                    }`}
                  >
                    {opt === 0 ? "None" : `${opt}d`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0"
                  value={config.final_revision_days > 0 ? config.final_revision_days : ""}
                  onChange={(e) => update("final_revision_days", parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-16 text-center bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-emerald-400/30 focus:border-emerald-400/60 px-1 py-0.5 text-xs outline-none transition-all duration-200 [appearance:textfield] placeholder:text-white/20"
                />
                <span className="text-xs text-white/30">days kept free before the exam</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary line */}
      {canProceed && totalDays != null && totalDays > 0 && (
        <p className="text-[11px] text-white/30 text-center">
          {effectiveDays} study days · {minToHuman(config.weekday_capacity_minutes)} weekdays · {minToHuman(config.weekend_capacity_minutes)} weekends
          {config.flexibility_minutes > 0 ? ` · +${config.flexibility_minutes}m flex` : ""}
          {config.final_revision_days > 0 ? ` · ${config.final_revision_days}d revision reserved` : ""}
          {" · urgency → subject order"}
          {config.max_active_subjects > 0 ? ` · ${config.max_active_subjects} subjects/day` : ""}
          {` · up to ${config.max_topics_per_subject_per_day} topic${config.max_topics_per_subject_per_day > 1 ? "s" : ""}/subject/day`}
          {Object.keys(config.custom_day_capacity).length > 0 ? ` · ${Object.keys(config.custom_day_capacity).length} custom day override${Object.keys(config.custom_day_capacity).length > 1 ? "s" : ""}` : ""}
        </p>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-[11px] text-white/30">
          {dateError
            ? <span className="text-red-400/70">{dateError}</span>
            : capacityError
            ? <span className="text-red-400/70">{capacityError}</span>
            : canProceed
            ? "Ready to generate plan"
            : "Fill required fields to continue"}
        </div>
        <button
          onClick={() => onSave(config)}
          disabled={!canProceed || isSaving}
          className="relative overflow-hidden bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:from-white/10 disabled:to-white/10 text-white disabled:text-white/40 text-sm font-semibold px-6 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-sky-500/20 hover:shadow-xl hover:shadow-sky-500/30 disabled:shadow-none disabled:cursor-not-allowed"
        >
          <span className="relative z-10">{isSaving ? "Generating..." : "Save & Generate Plan →"}</span>
          {canProceed && !isSaving && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
          )}
        </button>
      </div>
    </div>
  )
}
