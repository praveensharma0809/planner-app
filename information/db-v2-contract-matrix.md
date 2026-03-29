# DB v2 Contract Matrix

Last updated: 2026-03-27
Source of truth: information/Current_db_Schema.md

## Purpose
This matrix locks runtime code to the active DB v2 schema and lists where each table/column is read or written.

## Table: planner_settings
Columns used in runtime:
- study_start_date
- exam_date
- weekday_capacity_minutes
- weekend_capacity_minutes
- max_active_subjects
- day_of_week_capacity
- custom_day_capacity
- flexibility_minutes
- max_daily_minutes

Read paths:
- app/actions/planner/setup.ts (getPlanConfig)
- app/actions/planner/plan.ts (generate/reoptimize/reschedule)

Write paths:
- app/actions/planner/setup.ts (savePlanConfig)

Contract notes:
- Legacy strategy fields are runtime defaults, not persisted columns.
- Engine-required defaults:
  - plan_order = balanced
  - final_revision_days = 0
  - buffer_percentage = 0
  - max_topics_per_subject_per_day = 1

## Table: topics
Columns used in runtime:
- id, user_id, subject_id, name, sort_order, archived
- estimated_hours, priority, deadline, earliest_start
- depends_on, session_length_minutes, rest_after_days, max_sessions_per_day, study_frequency

Read paths:
- app/actions/planner/setup.ts (getStructure, getTopicParams, feasibility)
- app/actions/planner/plan.ts (generate/reoptimize/reschedule)
- app/actions/dashboard/getSubjectProgress.ts
- app/actions/dashboard/getUpcomingDeadlines.ts

Write paths:
- app/actions/planner/setup.ts (saveTopicParams, saveStructure)
- app/actions/subjects/chapters.ts

Contract notes:
- Topic scheduling params are merged into topics; no legacy params table usage.

## Table: tasks
Columns used in runtime:
- id, user_id, subject_id, topic_id, title, scheduled_date
- duration_minutes, session_type, priority, completed
- task_source, plan_snapshot_id
- session_number, total_sessions, sort_order
- created_at, updated_at

Read paths:
- app/actions/planner/plan.ts
- app/actions/schedule/getWeekSchedule.ts
- app/actions/schedule/importPlannerSchedule.ts
- app/actions/dashboard/getBacklog.ts
- app/actions/dashboard/getMonthTasks.ts
- app/actions/dashboard/getWeeklySnapshot.ts

Write paths:
- app/actions/planner/plan.ts
- app/actions/plan/createTask.ts
- app/actions/schedule/upsertScheduleTask.ts
- app/actions/subjects/tasks.ts

Contract notes:
- task_source enum values are strictly:
  - manual
  - plan
- Planner-generated tasks must always use task_source = plan.

## Table: plan_snapshots
Columns used in runtime:
- id, user_id, task_count, schedule_json, settings_snapshot, summary, created_at

Read paths:
- app/actions/planner/plan.ts (getPlanHistory)

Write paths:
- app/actions/planner/plan.ts (reschedule snapshot insert)
- commit_plan_atomic RPC path (commitPlan)

Contract notes:
- Runtime code uses settings_snapshot naming.
- RPC argument naming may remain p_config_snapshot for backward SQL signature compatibility.

## Table: subjects
Columns used in runtime:
- id, user_id, name, sort_order, archived, deadline

Read paths:
- planner/dashboard/schedule pages and actions

Write paths:
- app/actions/planner/setup.ts (saveStructure)
- app/actions/subjects/* subject actions

## Table: off_days
Columns used in runtime:
- id, user_id, date, reason

Read/write paths:
- app/actions/offdays/getOffDays.ts
- app/actions/offdays/addOffDay.ts
- app/actions/offdays/deleteOffDay.ts
- planner generation/reschedule paths for capacity exclusion

## Guard Rules (must stay true)
1. No runtime reference to removed tables:
- removed planner params/settings table aliases
- legacy hierarchy tables
- execution_*

2. No runtime reference to removed task fields:
- removed generated-flag/version field aliases

3. task_source must never write planner (invalid under DB v2 check constraint).

4. Planner settings reads/writes must use only existing planner_settings columns.
