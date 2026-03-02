# StudyHard

**A Strategic Execution Engine for serious preparation.**

StudyHard converts a person's workload, available time, and deadline into a disciplined, day-by-day execution plan. It is not a to-do list. It is not a journaling tool. It is a capacity-aware, deadline-driven scheduling system built for anyone who treats preparation like a mission.

---

## What it does

- Accepts subjects with item counts, durations, and deadlines
- Analyzes feasibility before writing any plan (blueprint-before-generation)
- Detects overload and guides the user through conflict resolution inline
- Generates a task schedule across calendar days, respecting daily capacity and off-days
- Tracks execution: task completion, streak, backlog, subject progress
- Surfaces everything on a structured dashboard and calendar

---

## Use Cases

- **Students preparing for exams**: Plan study schedules for multiple subjects with deadlines.
- **Professionals managing certifications**: Balance work and study time effectively.
- **Project planners**: Break down tasks into manageable chunks and track progress.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS) |
| Server client | `@supabase/ssr` — cookie-based, used in all server actions |
| Styling | Tailwind CSS v4 |
| Language | TypeScript (strict) |
| Tests | Vitest |
| Session middleware | Next.js `middleware.ts` — refreshes session on every protected route |

---

## Architecture principles

- **No client-side database calls.** All data access goes through server actions or React Server Components.
- **No auto-mutations.** The system never changes a user's plan without explicit confirmation.
- **Past data is sacred.** Completed tasks and past dates are never modified or deleted by the system.
- **Blueprint before generation.** The plan is only written after the user confirms the feasibility analysis.
- **RLS on all tables.** Every row is scoped to the authenticated user via `auth.uid()`.

---

## Project structure

```
app/
  actions/
    plan/           → completeTask, analyzePlan, commitPlan, rescheduleTask, resolveOverload
    dashboard/      → getStreak, getWeeklySnapshot, getBacklog, getUpcomingDeadlines
  auth/             → login, signup (Supabase client-side auth flows)
  dashboard/        → main dashboard, subjects page, calendar page
  onboarding/       → profile creation for new users
  planner/          → plan generation wizard (analyze → resolve → commit)

lib/
  supabase/
    server.ts       → createServerSupabaseClient (cookie-based, used in all server actions)
  supabase.ts       → browser Supabase client (used only in auth pages and onboarding)
  planner/
    analyzePlan.ts  → pure function: feasibility analysis → BlueprintResult
    scheduler.ts    → pure function: subject list → ScheduledTask[]
    overloadAnalyzer.ts → per-subject capacity check
    generatePlan.ts → thin server-side orchestrator
  types/
    db.ts           → TypeScript interfaces: Profile, Subject, Task

supabase/
  migrations/       → all schema migrations, applied in order

tests/
  actions/          → server action unit tests
  planner/          → pure planning engine unit tests
  utils/            → shared Supabase mock helpers
```

---

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd planner-app
npm install
```

### 2. Environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both values are available in your Supabase project under **Settings → API**.

### 3. Apply database migrations

Run all migrations in order from the Supabase SQL editor, or via the Supabase CLI:

```bash
supabase db push
```

Migrations in `supabase/migrations/`, applied in filename order:

| File | Description |
|---|---|
| `202602280001_phase1_schema.sql` | Streak columns on profiles; `off_days` table with RLS |
| `202602280002_complete_task_streak.sql` | `complete_task_with_streak` SQL function (admin helper) |
| `202602280003_schema_corrections.sql` | `off_days.id` default; `profiles → auth.users` FK; rebuilt function |

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run tests

```bash
npm test
```

All 9 tests pass with zero TypeScript errors.

---

## Key data flows

### Task completion

```
User clicks "Mark Complete"
  → completeTask(taskId) server action
    1. UPDATE tasks SET completed = true
       WHERE id = ? AND user_id = ? AND completed = false   ← idempotent guard
    2. UPDATE subjects SET completed_items = completed_items + 1
    3. UPDATE profiles SET streak_current/longest/last_date = computed values
  → revalidatePath("/dashboard/calendar")
  → revalidatePath("/dashboard")
```

### Plan generation

```
User clicks "Analyze Plan"
  → analyzePlanAction() — pure analysis, no DB write → BlueprintResult

(optional) resolveOverload(adjustment) — recomputes blueprint, no DB write

User confirms
  → commitPlan({ tasks }) server action
    → DELETE tasks WHERE user_id = ? AND is_plan_generated = true AND scheduled_date >= today
    → INSERT new ScheduledTask[]
```

---

## Auth flow

- **Login/signup:** Supabase client-side auth at `/auth/login` and `/auth/signup`
- **Session:** stored as cookies, refreshed by `middleware.ts` on every protected route request
- **Protection:** middleware redirects unauthenticated users to `/auth/login`; users without a profile row are sent to `/onboarding`
- **Server actions:** all use `createServerSupabaseClient()` which reads the session from cookies — auth context is always available server-side

---

## Security model

| Concern | Mechanism |
|---|---|
| Cross-user data access | RLS on every table (`auth.uid() = user_id`) |
| Unauthenticated access to protected routes | `middleware.ts` redirect before page renders |
| Missing profile / unfinished onboarding | Middleware checks for profile row; redirects to `/onboarding` |
| Task completion by non-owner | `.eq("user_id", user.id)` in every mutation; RLS as second layer |
| Streak double-count on same day | `.eq("completed", false)` guard — 0 rows updated if already done |

---

## Deployment

### Hosting on Vercel

1. Connect your GitHub repository to Vercel.
2. Set the environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy the project.

### Supabase Configuration

Ensure the Supabase project has the correct RLS policies and database schema as defined in the migrations.

---

## Contributing

1. Fork the repository.
2. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your message here"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

---

## Known Issues

- **Task rescheduling conflicts:** Rescheduling tasks may lead to overlapping deadlines if not resolved manually.
- **Browser compatibility:** Fully tested on Chrome and Firefox; other browsers may have minor UI inconsistencies.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

## Contact

For questions or support, please contact the maintainers at [support@studyhard.com](mailto:support@studyhard.com).
