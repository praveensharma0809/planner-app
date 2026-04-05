import { describe, expect, it } from "vitest"
import {
  buildPendingUnitsAndMeta,
  buildDroppedReasons,
  buildTaskSourceByTopic,
  buildUnitsFromActiveTopics,
  mapScheduledToSnapshotTasks,
  resolveSessionTaskTitle,
} from "@/lib/planner/planTransforms"
import type { Topic } from "@/lib/types/db"

describe("planTransforms", () => {
  it("resolves session title using weighted source task durations", () => {
    const sourceMap = buildTaskSourceByTopic([
      {
        id: "task-1",
        topic_id: "topic-1",
        title: "Read chapter",
        duration_minutes: 30,
      },
      {
        id: "task-2",
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
              id: "task-1",
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
              id: "task-1",
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
            remainingSessionTitles: ["Foundations-1", "Foundations-2"],
            remainingSessionTypes: ["core", "core"],
            expectedSessions: 2,
            originalTotalSessions: 2,
            remainingSessionNumbers: [1, 2],
            sourceTaskIds: ["task-1", "task-2"],
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
            remainingSessionTitles: ["Mega Session"],
            remainingSessionTypes: ["core"],
            expectedSessions: 1,
            originalTotalSessions: 1,
            remainingSessionNumbers: [1],
            sourceTaskIds: ["task-3"],
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

  it("preserves per-session title, numbering, source mapping, and type on reschedule remap", () => {
    const topic: Topic = {
      id: "topic-1",
      user_id: "user-1",
      subject_id: "subject-1",
      name: "Algebra",
      sort_order: 0,
      archived: false,
      created_at: "2026-01-01T00:00:00Z",
    }

    const { pendingUnitMeta } = buildPendingUnitsAndMeta({
      pendingTasks: [
        {
          id: "row-c",
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Lecture 4",
          duration_minutes: 60,
          session_type: "practice",
          session_number: 4,
          total_sessions: 4,
          scheduled_date: "2026-04-03",
          source_topic_task_id: "source-4",
        },
        {
          id: "row-a",
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Lecture 2",
          duration_minutes: 60,
          session_type: "core",
          session_number: 2,
          total_sessions: 4,
          scheduled_date: "2026-04-01",
          source_topic_task_id: "source-2",
        },
        {
          id: "row-b",
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Lecture 3",
          duration_minutes: 60,
          session_type: "revision",
          session_number: 3,
          total_sessions: 4,
          scheduled_date: "2026-04-02",
          source_topic_task_id: "source-3",
        },
      ],
      topicMap: new Map([["topic-1", topic]]),
      topicParamMap: new Map([
        [
          "topic-1",
          {
            topic_id: "topic-1",
            estimated_hours: 4,
            deadline: "2026-05-01",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 60,
            rest_after_days: 0,
            max_sessions_per_day: 0,
            study_frequency: "daily",
          },
        ],
      ]),
      subjectNameMap: new Map([["subject-1", "Math"]]),
      subjectDeadlineMap: new Map([["subject-1", "2026-05-02"]]),
      examDate: "2026-05-03",
      today: "2026-04-10",
    })

    const { scheduled } = mapScheduledToSnapshotTasks(
      [
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Algebra",
          scheduled_date: "2026-04-10",
          duration_minutes: 60,
          session_type: "core",
          session_number: 1,
          total_sessions: 3,
        },
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Algebra",
          scheduled_date: "2026-04-11",
          duration_minutes: 60,
          session_type: "core",
          session_number: 2,
          total_sessions: 3,
        },
        {
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Algebra",
          scheduled_date: "2026-04-12",
          duration_minutes: 60,
          session_type: "core",
          session_number: 3,
          total_sessions: 3,
        },
      ],
      pendingUnitMeta
    )

    expect(scheduled.map((task) => task.title)).toEqual([
      "Lecture 2",
      "Lecture 3",
      "Lecture 4",
    ])
    expect(scheduled.map((task) => task.session_type)).toEqual([
      "core",
      "revision",
      "practice",
    ])
    expect(scheduled.map((task) => task.session_number)).toEqual([2, 3, 4])
    expect(scheduled.map((task) => task.total_sessions)).toEqual([4, 4, 4])
    expect(scheduled.map((task) => task.source_topic_task_id)).toEqual([
      "source-2",
      "source-3",
      "source-4",
    ])
  })

  it("keeps mixed-subject partial-completion remaps deterministic across repeated runs", () => {
    const algebraTopic: Topic = {
      id: "topic-1",
      user_id: "user-1",
      subject_id: "subject-1",
      name: "Algebra",
      sort_order: 0,
      archived: false,
      created_at: "2026-01-01T00:00:00Z",
    }
    const historyTopic: Topic = {
      id: "topic-2",
      user_id: "user-1",
      subject_id: "subject-2",
      name: "History",
      sort_order: 0,
      archived: false,
      created_at: "2026-01-01T00:00:00Z",
    }

    const { pendingUnitMeta } = buildPendingUnitsAndMeta({
      pendingTasks: [
        {
          id: "t1-s3",
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Lecture 3",
          duration_minutes: 60,
          session_type: "core",
          session_number: 3,
          total_sessions: 4,
          scheduled_date: "2026-04-02",
          source_topic_task_id: "src-a3",
        },
        {
          id: "t1-s4",
          subject_id: "subject-1",
          topic_id: "topic-1",
          title: "Lecture 4",
          duration_minutes: 60,
          session_type: "revision",
          session_number: 4,
          total_sessions: 4,
          scheduled_date: "2026-04-03",
          source_topic_task_id: "src-a4",
        },
        {
          id: "t2-s1",
          subject_id: "subject-2",
          topic_id: "topic-2",
          title: "Chapter 1",
          duration_minutes: 45,
          session_type: "practice",
          session_number: 1,
          total_sessions: 1,
          scheduled_date: "2026-04-01",
          source_topic_task_id: "src-h1",
        },
      ],
      topicMap: new Map([
        ["topic-1", algebraTopic],
        ["topic-2", historyTopic],
      ]),
      topicParamMap: new Map([
        [
          "topic-1",
          {
            topic_id: "topic-1",
            estimated_hours: 4,
            deadline: "2026-05-01",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 60,
            rest_after_days: 0,
            max_sessions_per_day: 0,
            study_frequency: "daily",
          },
        ],
        [
          "topic-2",
          {
            topic_id: "topic-2",
            estimated_hours: 1,
            deadline: "2026-05-01",
            earliest_start: null,
            depends_on: [],
            session_length_minutes: 45,
            rest_after_days: 0,
            max_sessions_per_day: 0,
            study_frequency: "daily",
          },
        ],
      ]),
      subjectNameMap: new Map([
        ["subject-1", "Math"],
        ["subject-2", "History"],
      ]),
      subjectDeadlineMap: new Map([
        ["subject-1", "2026-05-02"],
        ["subject-2", "2026-05-02"],
      ]),
      examDate: "2026-05-03",
      today: "2026-04-10",
    })

    const scheduledSessions = [
      {
        subject_id: "subject-2",
        topic_id: "topic-2",
        title: "History",
        scheduled_date: "2026-04-10",
        duration_minutes: 45,
        session_type: "core" as const,
        session_number: 1,
        total_sessions: 1,
      },
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Algebra",
        scheduled_date: "2026-04-11",
        duration_minutes: 60,
        session_type: "core" as const,
        session_number: 1,
        total_sessions: 2,
      },
      {
        subject_id: "subject-1",
        topic_id: "topic-1",
        title: "Algebra",
        scheduled_date: "2026-04-12",
        duration_minutes: 60,
        session_type: "core" as const,
        session_number: 2,
        total_sessions: 2,
      },
    ]

    const first = mapScheduledToSnapshotTasks(scheduledSessions, pendingUnitMeta)
    const second = mapScheduledToSnapshotTasks(scheduledSessions, pendingUnitMeta)

    expect(first.scheduled).toEqual(second.scheduled)
    expect(first.scheduled.map((task) => task.title)).toEqual([
      "Chapter 1",
      "Lecture 3",
      "Lecture 4",
    ])
    expect(first.scheduled.map((task) => task.session_number)).toEqual([1, 3, 4])
    expect(first.scheduled.map((task) => task.session_type)).toEqual([
      "practice",
      "core",
      "revision",
    ])

    const algebraTitles = first.scheduled
      .filter((task) => task.topic_id === "topic-1")
      .map((task) => task.title)
    expect(new Set(algebraTitles).size).toBe(algebraTitles.length)
  })
})
