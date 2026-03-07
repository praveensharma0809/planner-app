# StudyHard Progress

Last updated: March 6, 2026

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

## What is still worth improving

- Increase automated coverage for newer UI-heavy flows
- Recreate a versioned schema dump or migration folder if long-term DB history matters
- Continue UX polish passes for edge cases and empty states
- Audit and tighten remaining type drift against the live DB where useful

## Repo maintenance notes

- The old oversized `info/` document set has been reduced to a small current doc set.
- `info/AI_CONTEXT.md` is the AI-oriented handoff document with code-level behavior notes and live DB facts.
- README has been aligned with the current file tree.
- The working tree still has no checked-in `supabase/` folder, so schema SQL history is not versioned in this snapshot.
- Generated caches like `tsconfig.tsbuildinfo` can be deleted safely when cleaning local workspace state.

## Recommended reference order

1. `README.md`
2. `info/AI_CONTEXT.md`
3. `info/DB_SCHEMA.md`
4. `info/ARCHITECTURE.md`
