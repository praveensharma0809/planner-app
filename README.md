# StudyHard

StudyHard is a planning and execution app for deadline-driven preparation. It turns a user's workload, available time, and deadlines into a daily plan, then tracks execution across dashboard, calendar, and monthly execution views.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth + Postgres + RLS
- Vitest

## Current modules

- `app/planner` - analyze -> adjust -> commit planning flow
- `app/dashboard` - daily status, backlog, streak, deadlines, calendar views
- `app/execution` - monthly execution board separate from planner-generated tasks
- `app/onboarding` - profile, subject, off-day, blueprint setup
- `app/actions` - all server-side reads and mutations
- `lib/planner` - pure planning logic (`analyzePlan.ts`, `overloadAnalyzer.ts`, `scheduler.ts`)
- `lib/types/db.ts` - shared runtime-facing data shapes
- `info/` - lightweight reference docs kept in sync with the current app and live DB

## Project structure

```text
app/
  actions/
  auth/
  dashboard/
  execution/
  onboarding/
  planner/

lib/
  planner/
  supabase/
  constants.ts
  supabase.ts
  types/

info/
  AI_CONTEXT.md
  ARCHITECTURE.md
  DB_SCHEMA.md
  PROGRESS.md

tests/
  actions/
  planner/
  utils/
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3. Start the app:

```bash
npm run dev
```

4. Run tests:

```bash
npm test
```

5. Run full local production checks:

```bash
npm run ci:check
```

## Reliability Layer

- CI gate workflow: `.github/workflows/ci.yml`
- Operational runbook: `info/OPERATIONS.md`
- Server telemetry helper: `lib/ops/telemetry.ts`
- Telemetry schema migration: `supabase/migrations/006_ops_events.sql`

Telemetry defaults to structured server logs. To persist telemetry in DB, set:

```env
ENABLE_DB_TELEMETRY=true
```

## Database note

This repo snapshot does not currently include SQL migration files. The in-repo schema reference lives in `info/DB_SCHEMA.md` and `info/AI_CONTEXT.md`, and those docs have been refreshed from a live Supabase schema dump captured on March 6, 2026.

If you want migration history versioned again, export the live Supabase schema into a fresh `supabase/` folder later.

## Core rules

- Blueprint before generation
- No silent auto-mutations
- Never rewrite past scheduled work
- All app data access goes through server actions or server components
- RLS scopes data to the authenticated user

## Reference docs

- `info/AI_CONTEXT.md` - best single-file handoff for ChatGPT or another AI assistant
- `info/ARCHITECTURE.md` - current system shape and data flow
- `info/DB_SCHEMA.md` - current table-level schema summary based on the live DB
- `info/PROGRESS.md` - what is complete and what still needs attention
