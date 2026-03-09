"use client"

import { useState, useMemo } from "react"

interface ConstraintValues {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  plan_order: "priority" | "deadline" | "subject" | "balanced"
  final_revision_days: number
  buffer_percentage: number
  /**
   * Max subjects active per day. 0 = no limit.
   * Subjects with ≤7 days to deadline are always included.
   */
  max_active_subjects: number
}

interface ConstraintsFormProps {
  initial: ConstraintValues | null
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

export default function ConstraintsForm({
  initial,
  onSave,
  isSaving,
}: ConstraintsFormProps) {
  const today = new Date().toISOString().split("T")[0]

  const [config, setConfig] = useState<ConstraintValues>(
    initial ?? {
      study_start_date: today,
      exam_date: "",
      weekday_capacity_minutes: 120,
      weekend_capacity_minutes: 180,
      plan_order: "balanced",
      final_revision_days: 0,
      buffer_percentage: 10,
      max_active_subjects: 0,
    }
  )

  const update = (field: keyof ConstraintValues, value: string | number) =>
    setConfig((prev) => ({ ...prev, [field]: value }))

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

  const capacityError =
    config.weekday_capacity_minutes === 0 && config.weekend_capacity_minutes === 0
      ? "Set at least one daily capacity."
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

        {/* ── Section 2: Daily Capacity ── */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <SectionLabel>Daily Capacity</SectionLabel>

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

        {/* ── Section 3: Sessions & Buffer ── */}
        <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        <SectionLabel>Plan Generation Order</SectionLabel>

        <div className="px-4 py-3 space-y-3">
          {/* Plan order cards */}
          <div className="grid grid-cols-2 gap-2">
            {([
              {
                value: "balanced",
                label: "Balanced",
                desc: "Smart urgency — balances priority, deadline, and remaining work",
                color: "indigo",
              },
              {
                value: "priority",
                label: "Priority First",
                desc: "High-priority topics always scheduled before lower-priority ones",
                color: "red",
              },
              {
                value: "deadline",
                label: "Deadline First",
                desc: "Nearest-deadline topics go first regardless of priority",
                color: "amber",
              },
              {
                value: "subject",
                label: "Subject by Subject",
                desc: "Complete all topics of one subject before starting the next (Phase 1 order)",
                color: "emerald",
              },
            ] as { value: "balanced" | "priority" | "deadline" | "subject"; label: string; desc: string; color: string }[]).map((opt) => {
              const isSelected = config.plan_order === opt.value
              const borderColor = isSelected
                ? opt.color === "indigo" ? "border-indigo-500/50 bg-indigo-500/[0.06]"
                : opt.color === "red" ? "border-red-500/50 bg-red-500/[0.06]"
                : opt.color === "amber" ? "border-amber-500/50 bg-amber-500/[0.06]"
                : "border-emerald-500/50 bg-emerald-500/[0.06]"
                : "border-white/[0.08] bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03]"
              const dotColor = isSelected
                ? opt.color === "indigo" ? "bg-indigo-400"
                : opt.color === "red" ? "bg-red-400"
                : opt.color === "amber" ? "bg-amber-400"
                : "bg-emerald-400"
                : "bg-white/10"
              const labelColor = isSelected
                ? opt.color === "indigo" ? "text-indigo-300"
                : opt.color === "red" ? "text-red-300"
                : opt.color === "amber" ? "text-amber-300"
                : "text-emerald-300"
                : "text-white/60"
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("plan_order", opt.value)}
                  className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${borderColor}`}
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 transition-colors duration-200 ${dotColor}`} />
                  <div>
                    <p className={`text-xs font-semibold transition-colors duration-200 ${labelColor}`}>{opt.label}</p>
                    <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Focus Depth */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Focus Depth — subjects per day
              </label>
              <span className="text-[9px] text-sky-400/60 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5">
                Urgent subjects always included
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                { value: 0, label: "All", desc: "No limit — all subjects eligible every day" },
                { value: 2, label: "2", desc: "Deep focus: only the 2 most urgent subjects per day" },
                { value: 3, label: "3", desc: "Balanced focus: top 3 subjects per day" },
                { value: 4, label: "4", desc: "Wide focus: top 4 subjects per day" },
              ] as { value: number; label: string; desc: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("max_active_subjects", opt.value)}
                  title={opt.desc}
                  className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-all duration-150 ${
                    config.max_active_subjects === opt.value
                      ? "text-sky-300 bg-sky-500/15 border-sky-500/40"
                      : "text-white/30 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/25 leading-relaxed">
              {config.max_active_subjects === 0
                ? "All subjects compete for slots each day — good for light loads."
                : `Only the ${config.max_active_subjects} most urgent subjects are scheduled each day, creating deeper focus blocks. Subjects with ≤7 days to deadline always get included.`}
            </p>
          </div>

          {/* Buffer + Final revision row */}
          <div className="grid gap-x-6 gap-y-3 pt-1" style={{ gridTemplateColumns: "1fr 1fr" }}>

            {/* Buffer % */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Buffer</label>
              <div className="flex flex-wrap gap-1">
                {[0, 5, 10, 15, 20].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => update("buffer_percentage", opt)}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition-all duration-150 ${
                      config.buffer_percentage === opt
                        ? "text-amber-300 bg-amber-500/15 border-amber-500/40"
                        : "text-white/25 bg-transparent border-white/[0.08] hover:border-white/20 hover:text-white/50"
                    }`}
                  >
                    {opt}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="50"
                  value={config.buffer_percentage > 0 ? config.buffer_percentage : ""}
                  onChange={(e) => update("buffer_percentage", Math.min(50, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-16 text-center bg-white/[0.02] border-b-2 border-white/[0.08] hover:border-amber-400/30 focus:border-amber-400/60 px-1 py-0.5 text-xs outline-none transition-all duration-200 [appearance:textfield] placeholder:text-white/20"
                />
                <span className="text-xs text-white/30">% slack in daily capacity</span>
              </div>
            </div>

            {/* Final revision days */}
            <div className="space-y-2">
              <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Revision Reserve</label>
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
                <span className="text-xs text-white/30">days reserved before exam</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary line */}
      {canProceed && totalDays != null && totalDays > 0 && (
        <p className="text-[11px] text-white/30 text-center">
          {effectiveDays} study days · {minToHuman(config.weekday_capacity_minutes)} weekdays · {minToHuman(config.weekend_capacity_minutes)} weekends
          {config.buffer_percentage > 0 ? ` · ${config.buffer_percentage}% buffer` : ""}
          {config.final_revision_days > 0 ? ` · ${config.final_revision_days}d revision reserved` : ""}
          {` · ${config.plan_order} order`}
          {config.max_active_subjects > 0 ? ` · ${config.max_active_subjects} subjects/day` : ""}
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
