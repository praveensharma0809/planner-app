import { Button, Input } from "@/app/components/ui"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

type Step2ConstraintsDraft = {
  study_start_date: string
  exam_date: string
  weekday_capacity_minutes: number
  weekend_capacity_minutes: number
  day_of_week_capacity: Array<number | null>
  custom_day_capacity: Record<string, number>
  flexibility_minutes: number
  max_active_subjects: number
}

type Step2ConstraintsSectionProps = {
  constraintsLoading: boolean
  constraintsDraft: Step2ConstraintsDraft
  hasStep2DateError: boolean
  step2CalendarLabel: string
  step2CalendarWeeks: Array<Array<string | null>>
  selectedCustomDates: Set<string>
  customCapacityMinutesInput: string
  customCapacityEntries: Array<[string, number]>
  isMutating: boolean
  constraintsSaving: boolean
  onStudyStartDateChange: (value: string) => void
  onExamDateChange: (value: string) => void
  onWeekdayCapacityChange: (value: string) => void
  onWeekendCapacityChange: (value: string) => void
  onDayOfWeekCapacityChange: (index: number, value: string) => void
  onPreviousCalendarMonth: () => void
  onNextCalendarMonth: () => void
  onToggleCustomDate: (isoDate: string) => void
  onCustomCapacityMinutesInputChange: (value: string) => void
  onApplyCustomCapacity: () => void
  onClearCustomDateSelection: () => void
  onRemoveCustomCapacityDate: (date: string) => void
  onFlexibilityMinutesChange: (value: string) => void
  onMaxActiveSubjectsChange: (value: string) => void
  onSaveConstraints: () => void
}

export function Step2ConstraintsSection({
  constraintsLoading,
  constraintsDraft,
  hasStep2DateError,
  step2CalendarLabel,
  step2CalendarWeeks,
  selectedCustomDates,
  customCapacityMinutesInput,
  customCapacityEntries,
  isMutating,
  constraintsSaving,
  onStudyStartDateChange,
  onExamDateChange,
  onWeekdayCapacityChange,
  onWeekendCapacityChange,
  onDayOfWeekCapacityChange,
  onPreviousCalendarMonth,
  onNextCalendarMonth,
  onToggleCustomDate,
  onCustomCapacityMinutesInputChange,
  onApplyCustomCapacity,
  onClearCustomDateSelection,
  onRemoveCustomCapacityDate,
  onFlexibilityMinutesChange,
  onMaxActiveSubjectsChange,
  onSaveConstraints,
}: Step2ConstraintsSectionProps) {
  return (
    <>
      <p
        className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--sh-text-muted)" }}
      >
        Step-2
      </p>

      <div className="flex min-h-[520px] items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
        <section
          className="min-w-[320px] flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start flex flex-col"
          style={{
            borderColor: "var(--sh-border)",
            background: "var(--sh-card)",
          }}
        >
          {constraintsLoading ? (
            <div
              className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm"
              style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
            >
              Loading constraints...
            </div>
          ) : (
            <div className="flex flex-col gap-3 pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  type="date"
                  label="Start Date"
                  value={constraintsDraft.study_start_date}
                  onChange={(event) => onStudyStartDateChange(event.target.value)}
                />
                <Input
                  type="date"
                  label="Final Deadline"
                  value={constraintsDraft.exam_date}
                  onChange={(event) => onExamDateChange(event.target.value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  type="number"
                  min={0}
                  label="Weekday Capacity (min)"
                  value={String(constraintsDraft.weekday_capacity_minutes)}
                  onChange={(event) => onWeekdayCapacityChange(event.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  label="Weekend Capacity (min)"
                  value={String(constraintsDraft.weekend_capacity_minutes)}
                  onChange={(event) => onWeekendCapacityChange(event.target.value)}
                />
              </div>

              {hasStep2DateError && (
                <p className="text-xs text-red-400/90">
                  Final deadline must be after start date.
                </p>
              )}

              <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                  Set Particular Day Capacity
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--sh-text-secondary)" }}>
                  Leave blank to use weekday/weekend defaults.
                </p>
                <div className="mt-2 grid grid-cols-7 gap-1.5">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <div key={label} className="space-y-1">
                      <p className="text-[10px] text-center" style={{ color: "var(--sh-text-muted)" }}>
                        {label}
                      </p>
                      <input
                        type="number"
                        min={0}
                        value={constraintsDraft.day_of_week_capacity[index] ?? ""}
                        onChange={(event) => onDayOfWeekCapacityChange(index, event.target.value)}
                        className="ui-input h-8 px-1 text-center text-xs"
                        placeholder="-"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                    Calendar (Custom Capacity)
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onPreviousCalendarMonth}
                    >
                      Prev
                    </Button>
                    <span className="text-[11px] font-semibold" style={{ color: "var(--sh-text-secondary)" }}>
                      {step2CalendarLabel}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onNextCalendarMonth}
                    >
                      Next
                    </Button>
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px]" style={{ color: "var(--sh-text-secondary)" }}>
                    Click days to select date-specific capacity overrides.
                  </p>

                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((label) => (
                      <div key={`custom-cal-head-${label}`} className="text-center text-[10px]" style={{ color: "var(--sh-text-muted)" }}>
                        {label}
                      </div>
                    ))}
                  </div>

                  {step2CalendarWeeks.map((week, weekIndex) => (
                    <div key={`custom-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                      {week.map((isoDate, dayIndex) => {
                        if (!isoDate) {
                          return <div key={`custom-empty-${weekIndex}-${dayIndex}`} className="h-8 rounded-md" />
                        }

                        const selected = selectedCustomDates.has(isoDate)
                        const hasCustom = isoDate in constraintsDraft.custom_day_capacity

                        return (
                          <button
                            key={`custom-day-${isoDate}`}
                            type="button"
                            onClick={() => onToggleCustomDate(isoDate)}
                            className="h-8 rounded-md border text-[11px] font-medium transition-colors"
                            style={{
                              borderColor: selected
                                ? "rgba(56, 189, 248, 0.6)"
                                : hasCustom
                                  ? "rgba(56, 189, 248, 0.35)"
                                  : "var(--sh-border)",
                              background: selected
                                ? "rgba(56, 189, 248, 0.18)"
                                : hasCustom
                                  ? "rgba(56, 189, 248, 0.1)"
                                  : "rgba(255,255,255,0.01)",
                              color: selected
                                ? "#bae6fd"
                                : "var(--sh-text-secondary)",
                            }}
                            title={[
                              hasCustom ? `${constraintsDraft.custom_day_capacity[isoDate]} min capacity` : "No custom capacity",
                            ].join(" • ")}
                          >
                            {isoDate.slice(-2)}
                          </button>
                        )
                      })}
                    </div>
                  ))}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border px-2 py-1 text-[10px]" style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-secondary)" }}>
                      Capacity selected: {selectedCustomDates.size}
                    </span>
                  </div>

                  <div className="mt-2 space-y-2 rounded-md border p-2" style={{ borderColor: "rgba(56, 189, 248, 0.35)", background: "rgba(56, 189, 248, 0.06)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#bae6fd" }}>
                      Custom Capacity Actions
                    </p>

                    <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] items-end">
                      <Input
                        type="number"
                        min={0}
                        label="Minutes for selected dates"
                        value={customCapacityMinutesInput}
                        onChange={(event) => onCustomCapacityMinutesInputChange(event.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onApplyCustomCapacity}
                      >
                        Apply to Selected
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClearCustomDateSelection}
                        disabled={selectedCustomDates.size === 0}
                      >
                        Clear Selection
                      </Button>
                    </div>

                    {customCapacityEntries.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
                        No custom date overrides yet.
                      </p>
                    ) : (
                      customCapacityEntries.map(([date, minutes]) => (
                        <div
                          key={date}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                          style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.01)" }}
                        >
                          <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                            {date} - {minutes} min
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveCustomCapacityDate(date)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section
          className="min-w-[320px] h-full flex-1 rounded-xl border px-4 py-4 sm:px-5 sm:py-5 snap-start flex flex-col"
          style={{
            borderColor: "var(--sh-border)",
            background: "var(--sh-card)",
          }}
        >
          {constraintsLoading ? (
            <div
              className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm"
              style={{ borderColor: "var(--sh-border)", color: "var(--sh-text-muted)" }}
            >
              Loading controls...
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
              <div className="space-y-3">
                <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                  Fine-tune scheduling flexibility and hard caps used in plan generation.
                </p>

                <Input
                  type="number"
                  min={0}
                  max={120}
                  label="Flexibility Minutes"
                  value={String(constraintsDraft.flexibility_minutes)}
                  onChange={(event) => onFlexibilityMinutesChange(event.target.value)}
                />

                <Input
                  type="number"
                  min={0}
                  max={12}
                  label="Max Active Subjects / Day"
                  value={String(constraintsDraft.max_active_subjects)}
                  onChange={(event) => onMaxActiveSubjectsChange(event.target.value)}
                  hint="Use 0 for no hard cap."
                />
              </div>

              <div className="rounded-lg border p-3" style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}>
                <p className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                  Save Step-2 constraints before generating Phase-2 preview.
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onSaveConstraints}
                    disabled={isMutating || constraintsSaving || hasStep2DateError}
                  >
                    {constraintsSaving ? "Saving..." : "Save Step-2 Constraints"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
