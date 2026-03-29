import { describe, expect, it } from "vitest"
import {
  buildDroppedReasons,
  buildTaskSourceByTopic,
  buildUnitsFromActiveTopics,
  resolveSessionTaskTitle,
} from "@/lib/planner/planTransforms"
import type { Topic } from "@/lib/types/db"

describe("planTransforms", () => {
  it("resolves session title using weighted source task durations", () => {
    const sourceMap = buildTaskSourceByTopic([
      {
        topic_id: "topic-1",
        title: "Read chapter",
        duration_minutes: 30,
      },
      {
        topic_id: "topic-1",
        title: "Practice set",
        duration_minutes: 90,
      },
    ])

    const title = resolveSessionTaskTitle(
      "Algebra",
      sourceMap.get("topic-1") ?? [],
      2,
      2
    )

    expect(title).toBe("Algebra - Practice set")
  })

  it("builds only plannable units with positive source-task minutes", () => {
    const topics: Topic[] = [
      {
        id: "topic-1",
        user_id: "user-1",
        subject_id: "subject-1",
        name: "Algebra",
        sort_order: 0,
        archived: false,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "topic-2",
        user_id: "user-1",
        subject_id: "subject-1",
        name: "Geometry",
        sort_order: 1,
        archived: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]

    const units = buildUnitsFromActiveTopics({
      activeTopics: topics,
      paramMap: new Map([
        [
          "topic-1",
          {
            topic_id: "topic-1",
            estimated_hours: 2,
            priority: 1,
            deadline: "2026-03-10",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 60,
            rest_after_days: 0,
            max_sessions_per_day: 1,
            study_frequency: "daily",
          },
        ],
      ]),
      topicTaskSourceMap: new Map([
        [
          "topic-1",
          [
            {
              title: "Read chapter",
              durationMinutes: 60,
              sortOrder: 0,
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        ],
        ["topic-2", []],
      ]),
      subjectNameMap: new Map([["subject-1", "Math"]]),
      subjectDeadlineMap: new Map([["subject-1", "2026-03-20"]]),
      examDate: "2026-03-25",
    })

    expect(units).toHaveLength(1)
    expect(units[0].id).toBe("topic-1")
  })

  it("prefers source-task duration over legacy 60-minute session default", () => {
    const topics: Topic[] = [
      {
        id: "topic-1",
        user_id: "user-1",
        subject_id: "subject-1",
        name: "Calculus",
        sort_order: 0,
        archived: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]

    const units = buildUnitsFromActiveTopics({
      activeTopics: topics,
      paramMap: new Map([
        [
          "topic-1",
          {
            topic_id: "topic-1",
            estimated_hours: 3,
            priority: 3,
            deadline: "2026-03-10",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 60,
            rest_after_days: 0,
            max_sessions_per_day: 1,
            study_frequency: "daily",
          },
        ],
      ]),
      topicTaskSourceMap: new Map([
        [
          "topic-1",
          [
            {
              title: "Lecture 1",
              durationMinutes: 180,
              sortOrder: 0,
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        ],
      ]),
      subjectNameMap: new Map([["subject-1", "Math"]]),
      subjectDeadlineMap: new Map([["subject-1", "2026-03-20"]]),
      examDate: "2026-03-25",
    })

    expect(units).toHaveLength(1)
    expect(units[0].estimated_minutes).toBe(180)
    expect(units[0].session_length_minutes).toBe(180)
  })

  it("builds dropped reasons for dependency and oversized sessions", () => {
    const dropped = buildDroppedReasons({
      pendingUnitMeta: new Map([
        [
          "topic-1",
          {
            unitId: "topic-1",
            topicId: "topic-1",
            subjectId: "subject-1",
            subjectName: "Math",
            topicName: "Foundations",
            titleFallback: "Foundations",
            sessionType: "core",
            expectedSessions: 2,
            originalTotalSessions: 2,
            remainingSessionNumbers: [1, 2],
            sessionLengthMinutes: 60,
            dependsOn: ["topic-x"],
          },
        ],
        [
          "topic-2",
          {
            unitId: "topic-2",
            topicId: "topic-2",
            subjectId: "subject-1",
            subjectName: "Math",
            topicName: "Mega Session",
            titleFallback: "Mega Session",
            sessionType: "core",
            expectedSessions: 1,
            originalTotalSessions: 1,
            remainingSessionNumbers: [1],
            sessionLengthMinutes: 300,
            dependsOn: [],
          },
        ],
      ]),
      scheduledCountByUnit: new Map([
        ["topic-1", 1],
        ["topic-2", 0],
      ]),
      maxAvailableSlot: 120,
    })

    expect(dropped).toEqual([
      {
        topicId: "topic-1",
        title: "Foundations",
        droppedSessions: 1,
        reason: "dependency ordering left no room before the deadline",
      },
      {
        topicId: "topic-2",
        title: "Mega Session",
        droppedSessions: 1,
        reason: "session is longer than any remaining available day capacity",
      },
    ])
  })
})
