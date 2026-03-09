# StudyHard Progress

Last updated: March 9, 2026

## What is complete

- Auth flow with Supabase session handling
- Protected app shell and onboarding gating in middleware
- Planner analyze -> resolve -> commit pipeline
- Per-subject overload analysis and adjustment suggestions
- Scheduler support for deadlines and off-days
- Dashboard summary cards, backlog, streak, and deadline views
- Week and month calendar task views
- Subject CRUD with archive support and subtopics
- Off-day management in settings
- Plan history logging and task completion flow
- Monthly execution board with categories, items, entries, metrics, and month cloning
- Live schema reconciliation for DB docs and AI handoff docs
- Off-day insert flow fixed to work with the live `off_days` schema
- Quick-start onboarding path to auto-generate and commit a first plan
- Missed-work reschedule flow from dashboard backlog warning
- Production trust layer baseline:
	- CI workflow with typecheck, lint, test, and build gates
	- Structured server telemetry for planner critical actions
	- Optional DB-backed ops telemetry table (`ops_events`)
	- Operations runbook and reliability targets

## What is still worth improving

- Increase automated coverage for newer UI-heavy flows
- Continue UX polish passes for edge cases and empty states
- Audit and tighten remaining type drift against the live DB where useful
- Add alerting integrations (PagerDuty/Slack/email) on top of telemetry data
- Add dashboard-facing ops analytics UI if operational visibility is needed in-app

## Repo maintenance notes

- The old oversized `info/` document set has been reduced to a small current doc set.
- `info/AI_CONTEXT.md` is the AI-oriented handoff document with code-level behavior notes and live DB facts.
- README has been aligned with the current file tree.
- `supabase/migrations` now exists and includes planner + ops telemetry migrations.
- Generated caches like `tsconfig.tsbuildinfo` can be deleted safely when cleaning local workspace state.

## Recommended reference order

1. `README.md`
2. `info/AI_CONTEXT.md`
3. `info/DB_SCHEMA.md`
4. `info/ARCHITECTURE.md`
