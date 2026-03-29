import { describe, it, expect } from "vitest"
import { buildDaySlots, schedule } from "@/lib/planner/engine"
import type { GlobalConstraints, PlannableUnit } from "@/lib/planner/engine"

function buildUnit(overrides: Partial<PlannableUnit> = {}): PlannableUnit {
  return {
    id: "topic-1",
    subject_id: "subject-1",
    subject_name: "Physics",
    topic_name: "Mechanics",
    estimated_minutes: 180,
    session_length_minutes: 60,
    priority: 2,
    deadline: "2024-01-05",
    depends_on: [],
    ...overrides,
  }
}

const baseConstraints: GlobalConstraints = {
  study_start_date: "2024-01-01",
  exam_date: "2024-01-07",
  weekday_capacity_minutes: 120,
  weekend_capacity_minutes: 120,
  plan_order: "balanced" as const,
  final_revision_days: 0,
  buffer_percentage: 0,
  max_active_subjects: 0,
}

describe("schedule", () => {
  it("keeps contiguous day slots across DST boundary dates", () => {
    const slots = buildDaySlots(
      {
        ...baseConstraints,
        study_start_date: "2026-03-07",
        exam_date: "2026-03-10",
      },
      new Set<string>()
    )

    expect(slots.map((slot) => slot.date)).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ])
  })

  it("returns empty schedule for empty units", () => {
    const result = schedule([], baseConstraints, new Set<string>())
    expect(result).toEqual([])
  })

  it("skips off-days when scheduling", () => {
    const offDay = "2024-01-02"
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, deadline: "2024-01-04" })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set([offDay])
    )

    expect(result.map((t) => t.scheduled_date)).not.toContain(offDay)
  })

  it("never schedules sessions past a unit deadline", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 300, deadline: "2024-01-02" })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result.every((t) => t.scheduled_date <= "2024-01-02")).toBe(true)
  })

  it("does not place overflow sessions after a topic deadline", () => {
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 180,
      deadline: "2024-01-03",
    })
    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 60,
      deadline: "2024-01-02",
    })

    const result = schedule(
      [topic1, topic2],
      {
        ...baseConstraints,
        exam_date: "2024-01-05",
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
      },
      new Set<string>()
    )

    expect(result.some((session) => session.topic_id === "topic-2")).toBe(false)
    expect(
      result
        .filter((session) => session.topic_id === "topic-1")
        .every((session) => session.scheduled_date <= "2024-01-03")
    ).toBe(true)
  })

  it("respects earliest_start", () => {
    const result = schedule(
      [buildUnit({ earliest_start: "2024-01-03", estimated_minutes: 120 })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result.every((t) => t.scheduled_date >= "2024-01-03")).toBe(true)
  })

  it("does not exceed daily capacity", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 600, deadline: "2024-01-05" })],
      { ...baseConstraints, weekday_capacity_minutes: 120, weekend_capacity_minutes: 120 },
      new Set<string>()
    )

    const byDay = new Map<string, number>()
    for (const s of result) {
      byDay.set(s.scheduled_date, (byDay.get(s.scheduled_date) ?? 0) + s.duration_minutes)
    }

    for (const totalMinutes of byDay.values()) {
      expect(totalMinutes).toBeLessThanOrEqual(120)
    }
  })

  it("keeps subject order from the provided structure", () => {
    const urgent = buildUnit({
      id: "urgent",
      subject_id: "subject-urgent",
      subject_name: "Urgent Subject",
      topic_name: "Urgent Topic",
      priority: 1,
      deadline: "2024-01-02",
      estimated_minutes: 60,
    })
    const relaxed = buildUnit({
      id: "relaxed",
      subject_id: "subject-relaxed",
      subject_name: "Relaxed Subject",
      topic_name: "Relaxed Topic",
      priority: 5,
      deadline: "2024-01-07",
      estimated_minutes: 60,
    })

    const result = schedule(
      [relaxed, urgent],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result[0].topic_id).toBe("relaxed")
  })

  it("returns empty schedule for circular dependencies", () => {
    const a = buildUnit({ id: "a", depends_on: ["b"], estimated_minutes: 60 })
    const b = buildUnit({ id: "b", depends_on: ["a"], estimated_minutes: 60 })

    const result = schedule([a, b], baseConstraints, new Set<string>())
    expect(result).toEqual([])
  })

  it("completes topic 1 fully before starting topic 2 within the same subject", () => {
    // Two topics in the same subject; each needs 2 sessions (120 min / 60 min per session).
    // Daily capacity is only 60 min so one session is placed per day.
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 120,
      session_length_minutes: 60,
      deadline: "2024-01-06",
    })
    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 120,
      session_length_minutes: 60,
      deadline: "2024-01-06",
    })

    const result = schedule(
      [topic1, topic2],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    const topic1Sessions = result.filter((s) => s.topic_id === "topic-1")
    const topic2Sessions = result.filter((s) => s.topic_id === "topic-2")

    // Both topics should be fully scheduled
    expect(topic1Sessions).toHaveLength(2)
    expect(topic2Sessions).toHaveLength(2)

    // Every topic-1 session must come before every topic-2 session
    const lastTopic1Date = topic1Sessions.at(-1)!.scheduled_date
    const firstTopic2Date = topic2Sessions[0].scheduled_date
    expect(firstTopic2Date > lastTopic1Date).toBe(true)
  })

  it("does not start topic 2 while topic 1 is blocked by earliest_start", () => {
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 120,
      session_length_minutes: 60,
      earliest_start: "2024-01-04",
      deadline: "2024-01-07",
    })

    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 60,
      session_length_minutes: 60,
      earliest_start: "2024-01-01",
      deadline: "2024-01-07",
    })

    const result = schedule(
      [topic1, topic2],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    // No sessions before topic-1's earliest start, even though topic-2 could have started.
    expect(result.every((s) => s.scheduled_date >= "2024-01-04")).toBe(true)

    const topic1Sessions = result.filter((s) => s.topic_id === "topic-1")
    const topic2Sessions = result.filter((s) => s.topic_id === "topic-2")
    expect(topic1Sessions).toHaveLength(2)
    expect(topic2Sessions).toHaveLength(1)

    const lastTopic1Date = topic1Sessions.at(-1)!.scheduled_date
    const firstTopic2Date = topic2Sessions[0].scheduled_date
    expect(firstTopic2Date > lastTopic1Date).toBe(true)
  })

  it("keeps Phase 1 topic order even when topic 2 has earlier deadline", () => {
    // Topic 2 looks more urgent by deadline, but topic order must remain strict.
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 120,
      session_length_minutes: 60,
      deadline: "2024-01-07",
      priority: 5,
    })

    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 60,
      session_length_minutes: 60,
      deadline: "2024-01-03",
      priority: 1,
    })

    const result = schedule(
      [topic1, topic2],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    const firstTopic2Idx = result.findIndex((s) => s.topic_id === "topic-2")
    const lastTopic1Idx = result
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s.topic_id === "topic-1")
      .at(-1)!.idx

    expect(firstTopic2Idx).toBeGreaterThan(lastTopic1Idx)
  })

  it("interleaves sessions across subjects each day", () => {
    // Two subjects, one topic each, 2 sessions needed per topic.
    // Daily capacity: 120 min → fits 2 × 60-min sessions.
    // Expect both subjects to appear on the same day (interleaved).
    const subjectA = buildUnit({
      id: "a-topic",
      subject_id: "subject-a",
      subject_name: "Maths",
      topic_name: "Algebra",
      estimated_minutes: 120,
      session_length_minutes: 60,
      deadline: "2024-01-05",
    })
    const subjectB = buildUnit({
      id: "b-topic",
      subject_id: "subject-b",
      subject_name: "Physics",
      topic_name: "Mechanics",
      estimated_minutes: 120,
      session_length_minutes: 60,
      deadline: "2024-01-05",
    })

    const result = schedule(
      [subjectA, subjectB],
      { ...baseConstraints, weekday_capacity_minutes: 120, weekend_capacity_minutes: 120 },
      new Set<string>()
    )

    // At least one day should contain sessions from both subjects
    const dayMap = new Map<string, Set<string>>()
    for (const s of result) {
      if (!dayMap.has(s.scheduled_date)) dayMap.set(s.scheduled_date, new Set())
      dayMap.get(s.scheduled_date)!.add(s.subject_id)
    }

    const mixedDays = [...dayMap.values()].filter((subjects) => subjects.size > 1)
    expect(mixedDays.length).toBeGreaterThan(0)
  })

  it("handles orphan dependencies gracefully (refs to non-existent units)", () => {
    const unit = buildUnit({
      id: "topic-1",
      depends_on: ["non-existent-id"],
      estimated_minutes: 60,
      deadline: "2024-01-05",
    })

    const result = schedule([unit], baseConstraints, new Set<string>())
    // Orphan dep should be cleaned — unit should still be scheduled
    expect(result.length).toBe(1)
    expect(result[0].topic_id).toBe("topic-1")
  })

  it("handles self-referencing dependency by treating as circular", () => {
    const unit = buildUnit({
      id: "topic-1",
      depends_on: ["topic-1"],
      estimated_minutes: 60,
    })

    const result = schedule([unit], baseConstraints, new Set<string>())
    // Self-dep is cleaned out (not a real dep after cleanup)
    expect(result.length).toBe(1)
  })

  it("handles session_length_minutes larger than any day capacity", () => {
    const unit = buildUnit({
      id: "topic-1",
      estimated_minutes: 300,
      session_length_minutes: 300, // 5 hours — bigger than any day's 120 min
      deadline: "2024-01-05",
    })

    const result = schedule(
      [unit],
      { ...baseConstraints, weekday_capacity_minutes: 120, weekend_capacity_minutes: 120 },
      new Set<string>()
    )

    // Session is too large for any day — should produce no sessions without hanging
    expect(result.length).toBe(0)
  })

  it("handles zero estimated_minutes (no sessions needed)", () => {
    const unit = buildUnit({ estimated_minutes: 0 })
    const result = schedule([unit], baseConstraints, new Set<string>())
    expect(result).toEqual([])
  })

  it("deduplicates units with the same ID", () => {
    const unit1 = buildUnit({ id: "dup", estimated_minutes: 60 })
    const unit2 = buildUnit({ id: "dup", estimated_minutes: 120 })

    const result = schedule([unit1, unit2], baseConstraints, new Set<string>())
    // Only the first should be kept (60 min → 1 session)
    expect(result.length).toBe(1)
  })

  it("overflow recovery keeps delayed topics unscheduled when deadline has passed", () => {
    // Topic 1: needs 3 sessions (180 min), deadline Jan 3
    // Topic 2: needs 1 session (60 min), deadline Jan 2
    // Daily capacity: 60 min
    // Main pass: Jan 1 → T1(1/3), Jan 2 → T1(2/3), Jan 3 → T1(3/3)
    // Topic 2 missed its deadline (Jan 2) because Topic 1 was in progress.
    // Overflow should place Topic 2 on Jan 4 (after T1 completes).
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 180,
      session_length_minutes: 60,
      deadline: "2024-01-05",
    })
    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 60,
      session_length_minutes: 60,
      deadline: "2024-01-02",
    })

    const result = schedule(
      [topic1, topic2],
      {
        ...baseConstraints,
        exam_date: "2024-01-08",
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
      },
      new Set<string>()
    )

    const topic1Sessions = result.filter((s) => s.topic_id === "topic-1")
    const topic2Sessions = result.filter((s) => s.topic_id === "topic-2")

    expect(topic1Sessions).toHaveLength(3)
    expect(topic2Sessions).toHaveLength(0)
  })

  it("does not overflow a single topic past its deadline", () => {
    // Single topic that simply can't fit — no sequencing conflict → no overflow
    const result = schedule(
      [buildUnit({ estimated_minutes: 300, deadline: "2024-01-02" })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result.every((t) => t.scheduled_date <= "2024-01-02")).toBe(true)
  })

  it("handles all days being off days", () => {
    const allOff = new Set(["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06", "2024-01-07"])
    const result = schedule(
      [buildUnit()],
      baseConstraints,
      allOff
    )
    expect(result).toEqual([])
  })

  it("respects rest_after_days before unlocking the next topic in a subject", () => {
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 120,
      session_length_minutes: 60,
      rest_after_days: 2,
      deadline: "2024-01-07",
    })
    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 60,
      session_length_minutes: 60,
      deadline: "2024-01-07",
    })

    const result = schedule(
      [topic1, topic2],
      { ...baseConstraints, weekday_capacity_minutes: 120, weekend_capacity_minutes: 120 },
      new Set<string>()
    )

    const lastTopic1Date = result.filter((s) => s.topic_id === "topic-1").at(-1)?.scheduled_date
    const firstTopic2Date = result.find((s) => s.topic_id === "topic-2")?.scheduled_date
    expect(lastTopic1Date).toBe("2024-01-01")
    expect(firstTopic2Date).toBe("2024-01-03")
  })

  it("keeps strict sequential order during rest-after block", () => {
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 60,
      rest_after_days: 2,
      deadline: "2024-01-03",
    })
    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 180,
      deadline: "2024-01-03",
    })
    const topic3 = buildUnit({
      id: "topic-3",
      topic_name: "Topic 3",
      estimated_minutes: 60,
      deadline: "2024-01-03",
    })

    const result = schedule(
      [topic1, topic2, topic3],
      {
        ...baseConstraints,
        exam_date: "2024-01-03",
        weekday_capacity_minutes: 120,
        weekend_capacity_minutes: 120,
      },
      new Set<string>()
    )

    const day2Topics = result
      .filter((session) => session.scheduled_date === "2024-01-02")
      .map((session) => session.topic_id)

    expect(day2Topics).toHaveLength(0)

    const firstTopic2Date = result.find((session) => session.topic_id === "topic-2")?.scheduled_date
    expect(firstTopic2Date).toBe("2024-01-01")
  })

  it("respects max_sessions_per_day for a topic", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, max_sessions_per_day: 1, deadline: "2024-01-05" })],
      { ...baseConstraints, weekday_capacity_minutes: 180, weekend_capacity_minutes: 180 },
      new Set<string>()
    )

    const sessionsByDay = new Map<string, number>()
    for (const session of result) {
      sessionsByDay.set(session.scheduled_date, (sessionsByDay.get(session.scheduled_date) ?? 0) + 1)
    }

    expect(Math.max(...sessionsByDay.values())).toBe(1)
  })

  it("treats study frequency as standard daily placement", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, study_frequency: "spaced", deadline: "2024-01-07" })],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result.map((session) => session.scheduled_date)).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ])
  })

  it("treats legacy dense frequency as daily for backward compatibility", () => {
    const legacyDense = {
      ...buildUnit({ estimated_minutes: 180, deadline: "2024-01-05" }),
      study_frequency: "dense",
    } as unknown as PlannableUnit

    const result = schedule(
      [legacyDense],
      { ...baseConstraints, weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>()
    )

    expect(result.map((session) => session.scheduled_date)).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ])
  })

  it("supports parallel subject ordering within the same subject", () => {
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 60,
      deadline: "2024-01-05",
    })
    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 60,
      deadline: "2024-01-05",
    })

    const result = schedule(
      [topic1, topic2],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 120,
        weekend_capacity_minutes: 120,
        subject_ordering: { "subject-1": "parallel" },
        max_topics_per_subject_per_day: 2,
      },
      new Set<string>()
    )

    const firstDayTopics = result
      .filter((session) => session.scheduled_date === "2024-01-01")
      .map((session) => session.topic_id)

    expect(new Set(firstDayTopics).size).toBe(2)
  })

  it("keeps strict sequential unlocking regardless of flexible flags", () => {
    const topic1 = buildUnit({
      id: "topic-1",
      topic_name: "Topic 1",
      estimated_minutes: 240,
      deadline: "2024-01-07",
    })
    const topic2 = buildUnit({
      id: "topic-2",
      topic_name: "Topic 2",
      estimated_minutes: 60,
      deadline: "2024-01-07",
    })

    const result = schedule(
      [topic1, topic2],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 120,
        weekend_capacity_minutes: 120,
        subject_ordering: { "subject-1": "flexible_sequential" },
        flexible_threshold: { "subject-1": 0.5 },
        max_topics_per_subject_per_day: 2,
      },
      new Set<string>()
    )

    const firstTopic2Date = result.find((session) => session.topic_id === "topic-2")?.scheduled_date
    const lastTopic1Date = result.filter((session) => session.topic_id === "topic-1").at(-1)?.scheduled_date

    expect(firstTopic2Date).toBe("2024-01-03")
    expect(lastTopic1Date).toBe("2024-01-02")
  })

  it("keeps topic 2 blocked until topic 1 completes (high vs medium pressure)", () => {
    const runScenario = (examDate: string) =>
      schedule(
        [
          buildUnit({
            id: "topic-1",
            topic_name: "Topic 1",
            estimated_minutes: 480,
            deadline: examDate,
          }),
          buildUnit({
            id: "topic-2",
            topic_name: "Topic 2",
            estimated_minutes: 60,
            deadline: examDate,
          }),
        ],
        {
          ...baseConstraints,
          exam_date: examDate,
          weekday_capacity_minutes: 120,
          weekend_capacity_minutes: 120,
          subject_ordering: { "subject-1": "flexible_sequential" },
          max_topics_per_subject_per_day: 2,
        },
        new Set<string>()
      )

    const highPressure = runScenario("2024-01-04")
    const mediumPressure = runScenario("2024-01-05")

    expect(
      highPressure.find((session) => session.topic_id === "topic-2")?.scheduled_date
    ).toBeUndefined()
    expect(
      mediumPressure.find((session) => session.topic_id === "topic-2")?.scheduled_date
    ).toBe("2024-01-05")
  })

  it("keeps topic 2 strictly after topic 1 (medium vs low pressure)", () => {
    const runScenario = (examDate: string) =>
      schedule(
        [
          buildUnit({
            id: "topic-1",
            topic_name: "Topic 1",
            estimated_minutes: 540,
            deadline: examDate,
          }),
          buildUnit({
            id: "topic-2",
            topic_name: "Topic 2",
            estimated_minutes: 60,
            deadline: examDate,
          }),
        ],
        {
          ...baseConstraints,
          exam_date: examDate,
          weekday_capacity_minutes: 120,
          weekend_capacity_minutes: 120,
          subject_ordering: { "subject-1": "flexible_sequential" },
          max_topics_per_subject_per_day: 2,
        },
        new Set<string>()
      )

    const mediumPressure = runScenario("2024-01-06")
    const lowPressure = runScenario("2024-01-07")

    expect(
      mediumPressure.find((session) => session.topic_id === "topic-2")?.scheduled_date
    ).toBe("2024-01-05")
    expect(
      lowPressure.find((session) => session.topic_id === "topic-2")?.scheduled_date
    ).toBe("2024-01-05")
  })

  it("keeps sequential topic flow for ordered topics", () => {
    const firstInOrder = buildUnit({
      id: "topic-1",
      topic_name: "First",
      estimated_minutes: 180,
      deadline: "2024-01-02",
    })
    const secondInOrder = buildUnit({
      id: "topic-2",
      topic_name: "Second",
      estimated_minutes: 60,
      deadline: "2024-01-02",
    })

    const result = schedule(
      [firstInOrder, secondInOrder],
      {
        ...baseConstraints,
        exam_date: "2024-01-02",
        weekday_capacity_minutes: 120,
        weekend_capacity_minutes: 120,
        subject_ordering: { "subject-1": "sequential" },
        max_topics_per_subject_per_day: 2,
      },
      new Set<string>()
    )

    const firstSecondTopicDate = result.find((session) => session.topic_id === "topic-2")?.scheduled_date
    expect(firstSecondTopicDate).toBe("2024-01-02")
  })

  it("respects min_subject_gap_days between sessions of the same subject", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, deadline: "2024-01-10" })],
      {
        ...baseConstraints,
        exam_date: "2024-01-10",
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        min_subject_gap_days: 1,
      },
      new Set<string>()
    )

    expect(result.map((session) => session.scheduled_date)).toEqual([
      "2024-01-01",
      "2024-01-03",
      "2024-01-05",
    ])
  })

  it("respects max_topics_per_subject_per_day even in parallel mode", () => {
    const topic1 = buildUnit({ id: "topic-1", topic_name: "Topic 1", estimated_minutes: 120 })
    const topic2 = buildUnit({ id: "topic-2", topic_name: "Topic 2", estimated_minutes: 60 })

    const result = schedule(
      [topic1, topic2],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 120,
        weekend_capacity_minutes: 120,
        subject_ordering: { "subject-1": "parallel" },
        max_topics_per_subject_per_day: 1,
      },
      new Set<string>()
    )

    const firstDayTopics = result
      .filter((session) => session.scheduled_date === "2024-01-01")
      .map((session) => session.topic_id)

    expect(new Set(firstDayTopics).size).toBe(1)
  })

  it("applies day-of-week capacity overrides", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, deadline: "2024-01-05" })],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        day_of_week_capacity: [null, null, null, 0, null, null, null],
      },
      new Set<string>()
    )

    expect(result.map((session) => session.scheduled_date)).not.toContain("2024-01-03")
  })

  it("keeps day-of-week 0-capacity days blocked even with flexibility", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, deadline: "2024-01-05" })],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        day_of_week_capacity: [null, null, null, 0, null, null, null],
        flexibility_minutes: 60,
        max_daily_minutes: 180,
      },
      new Set<string>()
    )

    expect(result.map((session) => session.scheduled_date)).not.toContain("2024-01-03")
  })

  it("applies custom day capacity overrides", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, deadline: "2024-01-05" })],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        custom_day_capacity: { "2024-01-02": 0 },
      },
      new Set<string>()
    )

    expect(result.map((session) => session.scheduled_date)).not.toContain("2024-01-02")
  })

  it("keeps custom 0-capacity days blocked even with flexibility", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 180, deadline: "2024-01-05" })],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        custom_day_capacity: { "2024-01-02": 0 },
        flexibility_minutes: 60,
        max_daily_minutes: 180,
      },
      new Set<string>()
    )

    expect(result.map((session) => session.scheduled_date)).not.toContain("2024-01-02")
  })

  it("uses flexibility minutes to place a session that exceeds base daily capacity", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 60, deadline: "2024-01-01" })],
      {
        ...baseConstraints,
        exam_date: "2024-01-01",
        weekday_capacity_minutes: 50,
        weekend_capacity_minutes: 50,
        flexibility_minutes: 10,
        max_daily_minutes: 60,
      },
      new Set<string>()
    )

    expect(result).toHaveLength(1)
    expect(result[0].is_flex_day).toBe(true)
    expect(result[0].flex_extra_minutes).toBe(10)
  })

  it("caps total schedulable minutes by max_daily_minutes", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 240, deadline: "2024-01-01" })],
      {
        ...baseConstraints,
        exam_date: "2024-01-01",
        weekday_capacity_minutes: 200,
        weekend_capacity_minutes: 200,
        flexibility_minutes: 60,
        max_daily_minutes: 180,
      },
      new Set<string>()
    )

    expect(result).toHaveLength(3)
    expect(result.every((session) => session.scheduled_date === "2024-01-01")).toBe(true)
    const totalMinutes = result.reduce((sum, session) => sum + session.duration_minutes, 0)
    expect(totalMinutes).toBe(180)
  })

  it("ignores plan order stack and keeps input order", () => {
    const highPriority = buildUnit({
      id: "priority-first",
      topic_name: "Priority First",
      priority: 1,
      deadline: "2024-01-05",
      estimated_minutes: 60,
    })
    const urgentDeadline = buildUnit({
      id: "deadline-first",
      topic_name: "Deadline First",
      priority: 5,
      deadline: "2024-01-02",
      estimated_minutes: 60,
      subject_id: "subject-2",
      subject_name: "Chemistry",
    })

    const priorityFirstStack = schedule(
      [highPriority, urgentDeadline],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        plan_order_stack: ["priority", "deadline"],
      },
      new Set<string>()
    )

    const deadlineFirstStack = schedule(
      [highPriority, urgentDeadline],
      {
        ...baseConstraints,
        weekday_capacity_minutes: 60,
        weekend_capacity_minutes: 60,
        plan_order_stack: ["deadline", "priority"],
      },
      new Set<string>()
    )

    expect(priorityFirstStack[0].topic_id).toBe("priority-first")
    expect(deadlineFirstStack[0].topic_id).toBe("priority-first")
  })

  it("reserves fixed calendar capacity before scheduling free sessions", () => {
    const result = schedule(
      [buildUnit({ estimated_minutes: 120, deadline: "2024-01-03" })],
      { ...baseConstraints, exam_date: "2024-01-03", weekday_capacity_minutes: 60, weekend_capacity_minutes: 60 },
      new Set<string>(),
      [{ date: "2024-01-01", minutes: 60 }]
    )

    expect(result.map((session) => session.scheduled_date)).toEqual([
      "2024-01-02",
      "2024-01-03",
    ])
  })

})
