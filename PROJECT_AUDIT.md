# PrepVeda — End-to-End Project Audit (Dev V2)

> **Audit scope**: Full A‑to‑Z review of the dev-v2 branch.
> **Author lens**: simultaneously CEO (product/market), CXO (UX), and CTO (engineering / scalability / DB).
> **Tone**: brutally honest. Focuses on what is **bad**, weak, missing, broken, or dangerous. Compliments are omitted on purpose — the user asked for the bad.
> **Date**: 2026‑05‑04 (audit date)

---

## 0. Executive Summary

PrepVeda has a thoughtful product idea (deterministic capacity-aware exam planner) and a respectable architectural skeleton (Next.js 16 App Router + Supabase + RLS + RPC commit). On paper, the team has clearly invested effort: feasibility classification, atomic commit RPC, optimistic UI, a quality roadmap, ARCHITECTURE.md, JSDoc, Zod row contracts, and ~370 unit tests.

**However, in its current state it is not a shippable consumer product.** Below is the ranked truth:

| Dimension | Score (out of 10) | One-line verdict |
|---|---|---|
| Engineering quality | **5.5** | Sane stack but huge components, dead code, unsafe casts, broken onboarding action |
| Architecture | **6.5** | Solid Server Actions + RLS pattern, undermined by a per-request middleware DB hit and forked 2.7k-line components |
| Database & backend | **6.0** | Clean schema + RLS, but RPC validation is weak in places, hash dedupe is non-canonical, no soft-deletes, no audit log |
| Scalability | **4.0** | Per-request DB read in middleware, N+1 reorder loops, 9 MB of onboarding PNGs preloaded, no caching, no real-time |
| Security | **5.0** | RLS is correct, but raw error messages leak to the UI, weak password policy, no email verification gate, no rate limit, no CSP |
| UI/UX (visual) | **6.5** | Marketing pages look polished; in-app surfaces are dense, inconsistent, and full of inline-styled emoji |
| First-time user experience | **3.5** | Brittle onboarding, broken column write, no sample data, no empty-state nudges, no contextual help inside the app |
| Mobile experience | **3.0** | Landing hides hero on mobile, drag-and-drop is a fingertip nightmare, dense data tables don't fit small screens |
| Reliability / bugs | **4.5** | A live, reproducible production bug in onboarding; permissive middleware fail-open paths; greedy scheduler can silently drop sessions |
| Observability | **3.5** | Console + an `ops_events` table that's only enabled with a flag; no Sentry, no APM, no alerting |
| Testing | **5.5** | 30+ unit tests but only **4 trivial Playwright smokes**; no DB-integration tests, no a11y tests, no perf tests |
| Documentation | **7.0** | The internal docs are unusually good for a side project — but they describe an aspirational state, not the actual one |
| Product-market fit signal | **4.0** | A planner whose "deterministic constraint solver" is a single 1,200-line greedy heuristic with documented dropouts |
| **Composite** | **5.0 / 10** | Promising prototype. Brutally not production-ready. |

The rest of this document explains *why* every one of those numbers is what it is, names the specific files and line numbers, and gives a concrete fix for every problem.

---

## 1. Tech Stack — What's Actually There vs. What's Claimed

### Claimed (README + ARCHITECTURE.md)
- Next.js 16 App Router, React 19.2, TypeScript 5.9 strict
- Supabase (Postgres + RLS + `@supabase/ssr`)
- Tailwind CSS v4
- `@dnd-kit` for drag-and-drop
- Zod 4 at action boundaries
- Vitest + RTL + Playwright

### What I actually found

| Piece | Reality |
|---|---|
| **State management** | None. No Zustand/Jotai/Redux. Pure `useState` + `useOptimistic` + `useTransition` everywhere, **including in 800–2,700-line components**. |
| **Forms / validation** | No form library (Formik/RHF). Manual `useState` for every field. Zod is used for *DB row shapes*, not for input validation in most actions. |
| **Data fetching** | No SWR/React Query. Server Components for reads, Server Actions for writes. Client refresh by `revalidatePath`, no incremental cache. |
| **Real-time** | Supabase real-time is *not used* anywhere despite being billed in `lib/supabase.ts` as "for real-time subscriptions". |
| **Edge / CDN** | None. No `runtime: 'edge'`, no Vercel/Netlify-specific config, no image CDN config, no Cloudflare. |
| **i18n** | None. Every string is hard-coded English. |
| **Analytics** | None. No Posthog, no GA, no Plausible. `ops_events` is internal and not user-behavior analytics. |
| **Error tracking** | None. No Sentry / Bugsnag / Datadog. Only `console.error` + JSON-structured logger that goes nowhere. |
| **Feature flags** | None. |
| **A11y tooling** | No `eslint-plugin-jsx-a11y`, no `@axe-core/playwright`. |
| **Background jobs** | None. No queue, no cron, no edge function. The atomic commit RPC is the only "background-ish" thing and runs synchronously. |
| **Email** | None. Sign-up sends a confirm email *via Supabase default*, but no transactional email service for password resets, deadline reminders, streak alerts, etc. |
| **Payments** | None. Landing page advertises "free plan" implying a paid plan exists. There is no Stripe code. |

**Score: 5.5 / 10.** The selected primitives are reasonable. The *gaps* are the problem.

---

## 2. Architecture Audit

### 2.1 Big-picture pattern — fine in theory

```
Browser → proxy.ts (middleware) → route group layout → page → Server Action → Supabase (RLS)
```

This is the recommended Next.js 16 App-Router pattern with Supabase. Two clients, cookie-based auth, RLS on every table, Server Actions for all writes. All of that is correct in principle.

### 2.2 Where the architecture actually hurts

#### 🔴 (a) Middleware does a database read on every protected request

`proxy.ts:88` — `supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()`

Every page navigation to `/dashboard`, `/planner`, `/schedule`, `/onboarding` (and any sub-route) makes:
1. `auth.getUser()` (Supabase JWT verify, network round-trip if cache cold).
2. **A `profiles` SELECT against the database**.

That is **two backend round-trips before your page even starts rendering**. At 10k DAU this becomes a massive cost driver and a latency tax of ~150–400 ms per nav for users far from your Supabase region.

**Fix**: Cache the "profile-exists" claim into a JWT custom claim (Supabase `app_metadata.has_profile = true`) the moment onboarding completes, and read it from the JWT in middleware. Drop the DB read entirely.

#### 🔴 (b) Middleware fail-open on errors

```ts
// proxy.ts:84-94
let profile = null
try {
  const { data } = await supabase.from("profiles")...
  profile = data
} catch {
  return response   // ← user gets through to the protected page on ANY error
}
```

If Supabase has a hiccup, **a user with no profile bypasses the onboarding gate and lands on `/dashboard`** with no data. Worst-case, this hides outages by serving broken UI; not a CVE, but it is a quiet stability bug.

**Fix**: Return `redirect('/onboarding')` on the catch path, or fail loudly with a status page.

#### 🔴 (c) Two forks of subjects-data-table totalling 4,200+ lines

The architecture doc proudly justifies the fork:

> "The planner fork needs a NavigationColumn… Merging them with mode flags proved unmaintainable…"

That is a rationalisation. The truth: **you have two divergent copies of the same table** with shared primitives in `app/components/subjects-data-table/`, but the divergence is largely in branching logic, modals, and column composition — exactly the kind of thing a *headless* table abstraction (TanStack Table) was built to express in <500 lines. The current state means every future bug or feature has to be implemented twice.

**Fix**: Adopt `@tanstack/react-table`. Express both pages as ~300-line consumers of one headless model.

#### 🔴 (d) Massive single-file pages

| File | Lines |
|---|---|
| `app/(dashboard)/planner/subjects-data-table.tsx` | **2,770** |
| `app/actions/planner/plan.ts` | **1,480** |
| `app/(dashboard)/dashboard/subjects/subjects-data-table.tsx` | **1,440** |
| `app/actions/planner/setup.ts` | **1,321** |
| `lib/planner/engine.ts` | **1,199** |
| `app/(dashboard)/planner/components/PlanPreview.tsx` | **981** |
| `app/components/onboarding/TutorialWizard.tsx` | **870** |
| `app/landingpage/page.tsx` | **825** |
| `app/(dashboard)/schedule/page.tsx` | **822** |
| `app/(dashboard)/dashboard/page.tsx` | 566 |

You have a `scripts/check-hotspot-sizes.mjs` size-guard. It is not protecting you. **9 files cross 800 lines.** Anything over ~400 lines in a React/Next codebase is an organisational smell.

**Fix**: Extract sub-components, hooks, and data transforms into named modules. Treat the size guard as a hard cap, not a polite warning.

#### 🟠 (e) Server Action fan-out is too granular

`app/actions/` has **27** distinct action files, each repeating the same boilerplate:
1. `createServerSupabaseClient()`
2. `auth.getUser()`
3. unauthorized branch
4. validate
5. mutate
6. `revalidatePath` x N
7. try/catch + logger.error

Pull this into a `withAuth(async (user, supabase) => …)` higher-order helper. You'll cut 200+ lines of duplication and you'll finally get a single place to add rate-limiting, CSRF, audit logging, and structured telemetry.

#### 🟠 (f) `revalidatePath` carpet-bombing

`tasks.ts:83` calls `revalidatePath` on five routes after every mutation. Many of those routes are unrelated to the change. This invalidates Next.js's full-route cache 5× per click, defeating most of the SSR caching benefit you'd otherwise get. Use `revalidateTag` with tagged fetches instead.

**Architecture score: 6.5 / 10.**

---

## 3. Database & Backend Audit

The schema (`supabase/migrations/0001_production_schema.sql`) is the **strongest** part of the codebase. It is well-normalised, uses partial indexes correctly, and has thoughtful CHECK constraints. The bad parts are subtler.

### 3.1 Real bugs, not opinions

#### 🔴 BUG 1 — Onboarding writes a column that no longer exists

```ts
// app/actions/onboarding/completeOnboarding.ts:25
.upsert({
  id: user.id,
  full_name: user.email?.split("@")[0] ?? "User",
  onboarding_completed: true,   // ← THIS COLUMN DOES NOT EXIST
})
```

`supabase/migrations/0003_drop_onboarding_state.sql` drops `onboarding_step` and `onboarding_goal` and the prior `0001_production_schema.sql` never had `onboarding_completed`. The `profiles` table in production does not have this column.

Net effect: every first-time user clicks "Go to Subjects" and **the onboarding completion API call returns a Postgres error like `column "onboarding_completed" of relation "profiles" does not exist`**. The wizard handles errors silently (silently routes to dashboard anyway). Profile row is still created on the upsert because the on-conflict path may swallow it depending on Supabase behaviour, OR — worse — the entire upsert fails and **no profile row gets written**, which then means `proxy.ts:96` permanently bounces the user back to `/onboarding` in an infinite loop.

This is the single biggest reliability issue in the app. It is on the **first-run path**.

**Fix**: Remove the `onboarding_completed` field from the upsert OR re-introduce the column in a new migration if you actually want the flag.

#### 🔴 BUG 2 — `commit_plan_atomic_v2_wrapper` hash is non-canonical

```sql
-- 0001_production_schema.sql:711-718
encode(
  digest(
    (coalesce(auth.uid()::text, '') || ':' || coalesce(p_tasks::text, '[]'))::text,
    'sha256'
  ), 'hex'
)
```

`p_tasks::text` is **whatever the client sent**, including key order, whitespace, and (depending on PostgREST round-tripping) JSON normalisation. The TS code in `app/actions/planner/plan.ts:154` builds a *different* canonical hash by sorting per-session signatures. The two will sometimes match and sometimes not. Effect: the `duplicate_commit` dedupe is unreliable — you can commit twice with the same plan if any field re-orders, and you can fail-as-duplicate with a legitimately new plan if the JSON happens to match.

**Fix**: Compute the canonical hash on the *server* using `jsonb_build_object` field-by-field, or pass the explicit hash from TS (which the code already supports — kill the wrapper).

#### 🔴 BUG 3 — `reorderTasks` does N round-trips with no transaction

```ts
// app/actions/subjects/tasks.ts:604-615
for (let index = 0; index < uniqueTaskIds.length; index += 1) {
  const { error } = await supabase.from("topic_tasks")
    .update({ sort_order: index })
    .eq("id", uniqueTaskIds[index])
  ...
}
```

Reordering 50 tasks = 50 sequential `UPDATE` round-trips, each ~30–80 ms. That's **2–4 seconds**, no transaction, partial failure leaves the list scrambled. **Same pattern repeats** in chapter reordering and subject reordering.

**Fix**: One bulk `UPDATE … FROM (VALUES …)` SQL or an RPC `reorder_topic_tasks(uuid[])`. Atomic. Single round-trip.

#### 🔴 BUG 4 — Greedy scheduler is documented as deterministic; can silently drop sessions

`lib/planner/engine.ts:699` is a 440-line greedy scheduler with:
- A `safetyCounter > safetyLimit` early-break (line 934, 1024)
- An "overflow" pass that may not converge (line 1075)
- Capacity auto-scaling when load > base (line 815) that *silently increases* the user's daily commitment — without telling them
- `isTopicSpacingOK()` is a no-op (`return true;` — line 845)
- `computeInternalSubjectGapDays(_loadRatio, configuredGapDays)` ignores its first argument

It returns `PARTIAL` when sessions are dropped, but the dropped-reason explanation is built post-hoc by comparing expected vs. placed counts (line 1183). The user sees "we couldn't fit X sessions" but the actual fit is non-deterministic in edge cases (because `inProgressTopics` is a `Set` whose iteration order depends on insertion).

The landing page meanwhile claims:
> "PrepVeda uses a deterministic constraint solver. Same inputs produce the same plan every time."

That is **marketing copy that contradicts the implementation**. With identical inputs you'll get the same plan today, but a small change in topic order or session length can cause large, unpredictable shuffles in output, which is the opposite of what users expect from "deterministic".

**Fix**: Either replace the greedy with a real CP-SAT/ILP solver (`@google/google-cloud-optimization-ai` or a wasm-based MIP), or be honest in the marketing and the UI about the heuristic nature. Short-term, at least:
- Sort all maps/sets explicitly before iteration.
- Remove dead `isTopicSpacingOK`/unused param.
- Surface "we scaled your capacity by X%" to the user.

#### 🟠 BUG 5 — RLS on `ops_events` insert is too permissive

```sql
create policy ops_events_owner_insert on public.ops_events
for insert with check (user_id is null or auth.uid() = user_id);
```

Any logged-in user can insert *anonymous* (`user_id is null`) rows freely. It's not catastrophic but it means a malicious user can flood your telemetry table. Combined with `ENABLE_DB_TELEMETRY` defaulting off in CI but on in prod, you have a lot of opacity.

**Fix**: Move telemetry behind a Postgres function that only the service_role can call, or use a dedicated edge function with rate-limiting.

### 3.2 Design problems (not bugs but still bad)

| Issue | Why bad |
|---|---|
| **No soft delete anywhere** | Subjects/topics/tasks deletes cascade through `ON DELETE CASCADE`. A user who clicks "delete subject" with 200 plan tasks will permanently lose history. |
| **No audit log table** | You can't answer "who deleted Subject X" or "what changed". |
| **No `created_by`/`updated_by` columns** | Same. |
| **`ops_events.metadata` is `jsonb` with no shape** | You'll regret this when you try to query it. |
| **No partitioning on `tasks` or `ops_events`** | They will both grow unbounded. `ops_events` especially. |
| **`plan_snapshots.schedule_json` is the entire plan** | A user with 10k tasks ships ~2 MB of JSON per snapshot. Each commit doubles storage. There's no retention policy. |
| **Indexes on `(user_id, …)` only** | You will eventually want admin / cohort queries. They will all sequence-scan. |
| **`commit_plan_atomic_v2` re-walks the JSONB array 5× for validation** | At 5,000 tasks this is O(25,000) JSON ops per commit. Validate once, in TS, before sending. |
| **No consistency between TS Zod schemas and SQL** | `lib/contracts/schemas.ts:plannerSettingsSchema` does not match `planner_settings` columns at all (no `weekday_capacity_minutes` field). It's clearly stale. |
| **`subjects.no_others_subject` constraint is brittle** | `lower(trim(name)) <> 'others'` blocks "Others" but allows "OtherS " with a Unicode space. Use Unicode-normalised compare. |

**Database & backend score: 6.0 / 10.**

---

## 4. Server-Action Layer Audit

### 4.1 What's right

- All actions consistently `await supabase.auth.getUser()` and short-circuit on null.
- All actions use the typed `createServerSupabaseClient()` which goes through `next/headers` cookies — no token leaking.
- All actions catch errors and run them through `logger.error()`.

### 4.2 What's wrong

#### 🟠 Inputs are not Zod-validated

`addSubject.ts:29` — input shape is hand-validated. No length cap, no XSS sanitisation on `name`, and `name.trim()` does not normalise NFC, so a homoglyph attack on "Others" (e.g. Cyrillic "О") trivially bypasses `isReservedSubjectName`.

`tasks.ts:230` (`bulkCreateSubjectTasks`) caps count at 100 but does not cap title length, and accepts `separator` as any string — allowing newlines, control chars, ANSI escapes into stored data. Consumers must escape on render.

**Fix**: Define a Zod schema *for inputs* (you already have `lib/contracts/schemas.ts` for outputs) at the top of every action and call `schema.parse(input)`.

#### 🟠 Error messages are passed straight through to the client

`addSubject.ts:64` returns the raw `error.message` from Postgres back to the UI in many code paths. Likewise `chapters.ts`, `tasks.ts:215`, `setup.ts`. This leaks internal column names, RLS policy names, and Postgres error structure to logged-out attackers (server actions are reachable post-auth, but an authenticated low-trust user is still a threat surface). It also produces ugly user copy.

**Fix**: Map Postgres errors to a small error code enum at the boundary; log the raw message server-side, return a user-safe code+copy.

#### 🟠 No rate limiting on any action

`generatePlanAction` runs the 1,200-line scheduler. **A user can click "Generate" 100 times per second.** No debounce on the button (the wizard sets `isGenerating` but it's client-side only — bypassable with curl). Same for `commitPlan`, `rescheduleMissedPlan`, `bulkCreateSubjectTasks`.

**Fix**: An Upstash/Redis-based or `pg_advisory_xact_lock` per-user-per-action throttle. The `commit_plan_atomic_v2` already takes an advisory lock; extend the pattern.

#### 🟠 No CSRF defence-in-depth

Next.js 16 Server Actions have built-in CSRF protection (origin check + encrypted action ID). That is *almost* enough, but combined with no SameSite=Strict cookie config visible, an XSS on any subdomain becomes total account takeover. There's no Content-Security-Policy header set in `next.config.ts` — that file is **8 lines** and only configures `distDir`.

**Fix**: Add a `headers()` block to `next.config.ts` setting CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy. This is table stakes.

#### 🟠 Dual auth path (browser supabase + server supabase) is footgun-prone

`app/auth/login/page.tsx:28` calls `supabase.auth.signInWithPassword` from the *browser* using `lib/supabase.ts` (the singleton browser client). On success it `router.push("/dashboard")`. No coordination with `lib/supabase/server.ts`. The session is only in cookies *after* the next request, so there's a moment where the client believes the user is signed in but the server still sees them as anonymous. This is why your "redirect after login" works "most of the time" but flakes occasionally.

**Fix**: Move auth to a Server Action — `signIn(email, password)` — that calls `supabase.auth.signInWithPassword` server-side and immediately uses `revalidatePath` + `redirect`.

**Server-action layer score: 5.5 / 10.**

---

## 5. Frontend / UI / UX Audit

### 5.1 Visual quality

The **landing page** (`app/landingpage/page.tsx`, 825 lines) and the **auth pages** are competently designed — good typography, decent rhythm, decent colour. The **in-app surfaces** are a different story.

### 5.2 What's wrong inside the app

#### 🔴 Dashboard density is overwhelming

`app/(dashboard)/dashboard/page.tsx:238` — your home screen on first login dumps:
- Greeting + "New Plan" CTA
- Today's progress hero card (4 stats)
- Today's tasks card (with separate Pending/Done split, completed-section accordion)
- Alerts sidebar (up to 6 different alert tones)
- Subject progress sidebar (5 subjects with health badges)
- Up to 8 visible tasks + "+N more" hint

For a brand-new user this is empty-state-after-empty-state with no narrative. There is **no first-load tour, no sample data, no "where do I begin?"**. The empty states say things like "Add subjects to start tracking progress" — which directs to a different page entirely.

#### 🔴 Onboarding is a 6-slide marketing tour, not an onboarding

`app/components/onboarding/TutorialWizard.tsx` is **870 lines** of carousel:
- 6 main steps
- Each "guided flow" step auto-advances 11 sub-slides every few seconds
- Preloads **ALL** flow images on mount (`useEffect` calls `preload(src, { as: "image" })` for every PNG — that's ~9 MB of `public/onboarding/*.png` shoved into the browser cache before the first paint)
- Ends by routing to `/dashboard/subjects` with the broken `completeOnboarding` action mentioned in §3.1

The user has been *shown* what to do. They have not *done* anything. The single most important onboarding metric — **time-to-first-subject-created** — is nowhere near the documented goal of <60 s, because the tour leaves them on an empty subjects page with no scaffolded data and no "create my first subject in one click" affordance.

**Fix**: Replace the carousel with an interactive 3-step inline onboarding inside `/dashboard/subjects`:
1. "Name your first subject" (single input).
2. "Add 3 chapters" (three pre-filled rows).
3. "Set your exam date and daily minutes."
Done. The user has data. The animation can live in a "Take the tour" button.

#### 🔴 Mobile UX is broken

- Landing page: `lg:grid-cols-[1fr_1.1fr]` with `hidden lg:block` for the hero image → mobile users get a left-aligned form with no visual context.
- Login/signup: same pattern. On a phone you literally see 50% of the design.
- Schedule page: drag-and-drop from `@dnd-kit` with `PointerSensor` — usable on mouse, miserable on touch. There is a `MobileDay` selector but the cards still rely on hover affordances (the `RowActionButton` triggers reveal only on hover).
- Subjects data table: 3 columns with internal scroll, ~60 px row height, dropdown actions in narrow cells. On a 390-px viewport this is unusable.
- `app/(dashboard)/schedule/page.tsx` is 822 lines and the "mobile day" UX is grafted on top — there's no separate mobile component.

**Fix**: Adopt a real responsive strategy. The schedule on mobile should be a vertical agenda. The subjects table should be a card list. Don't ship a desktop-first SaaS in 2026.

#### 🔴 No accessibility plumbing

- No `eslint-plugin-jsx-a11y` in eslint.config.mjs.
- Toast container has `role="status" aria-live="polite"` (good) but the dismiss button lacks visible focus state in many themes.
- Most icons are `<svg>` with no `<title>` and no `aria-label`.
- `app/components/onboarding/TutorialWizard.tsx` keyboard handler (line 454) hijacks Arrow keys at the window level — that breaks screen-reader virtual cursors and breaks Arrow-key navigation in any input that bubbles.
- `app/error.tsx:28` shows raw `error.message` in `<pre>` — both an info disclosure and a UX failure.
- No skip-link, no `<main>`-on-page-load focus management for route changes.

**Fix**: Install `eslint-plugin-jsx-a11y`, run `axe-playwright` in CI, audit all icons.

#### 🟠 Inline emoji + inline styles + Tailwind + 2,462-line global stylesheet

`app/globals.css` is **2,462 lines** of hand-written CSS classes (`dashboard-hero-card`, `dashboard-subject-row`, `onb-screenshot-frame`, …). This negates much of Tailwind's purge benefit because each class has bespoke implementation. Mixed with `style={{ background: 'var(--sh-card)' }}` JSX inline styles in `dashboard/page.tsx`, the design language is incoherent: you have **three** styling systems running simultaneously (Tailwind utility classes, custom CSS classes, inline style props).

#### 🟠 No design tokens contract

`lib/design-tokens.ts` exists but is only ~110 lines and is referenced by very few components. CSS custom properties (`--sh-text-primary`, `--sh-card`) are sprinkled across the global stylesheet. There is no single source of truth for spacing, radius, or colour.

#### 🟠 Toasts are positional, not actionable

`app/components/Toast.tsx`: bottom-right toasts that auto-dismiss in `TOAST_DURATION_MS`. Errors disappear silently. There's no "undo" toast, no toast queue cap, and no toast type for in-progress (the page often shows raw "Saving…" buttons in different copy across the app).

**UI/UX score: 6.5 / 10 visual, 3.5 / 10 first-time experience.**

---

## 6. The First-Time User Journey — Brutal Walkthrough

Imagine **Maya**, a UPSC aspirant who clicked the landing-page CTA. Here's what she actually experiences.

### Step 0 — Landing
- Lands on `/landingpage`. Decent. But "AI Scheduling" is the headline; you have no AI in the product (it's a greedy heuristic). She is being mis-sold from second one.
- Clicks "Create free account" → `/auth/signup`.

### Step 1 — Signup
- 6-character minimum password. **Industry standard is 8–12 with strength meter.** No social auth.
- Submits. Toast: "Account created – check your email to confirm." Router pushes back to `/auth/login`. **Email not yet confirmed.** She enters her credentials and is greeted with a Supabase error she can't action because Supabase requires email-confirm-first by default.
- Confusion. Maya re-checks her inbox. Confirms via the magic link. The magic link goes back to whatever Supabase default it is — it does NOT come back into your app's design — branded onboarding ends here.

### Step 2 — First login
- Returns to `/auth/login`. Logs in. Pushed to `/dashboard`.
- Middleware (`proxy.ts:96`) sees no `profiles` row → redirects to `/onboarding`.

### Step 3 — Onboarding tour
- 6 carousel steps with screenshots she has no context for. ~2 minutes of passive viewing if she watches the auto-advancing flows.
- Clicks "Go to Subjects" on the last step.
- `completeOnboarding()` fires → **broken** (writes nonexistent column). One of two outcomes:
  - **Outcome A**: Postgres errors. Toast: nothing or generic. The wizard router-pushes anyway. She lands on `/dashboard/subjects` *without a profile row* → the next nav redirects her right back to `/onboarding`. **Infinite loop.**
  - **Outcome B**: Supabase upserts the row but ignores the unknown column. Profile exists. She gets through. (This depends on PostgREST/SSR client behaviour — *which means your users have an inconsistent first-run experience depending on Supabase version*.)

### Step 4 — Subjects empty state
- `/dashboard/subjects` is empty. The table has columns but no rows. The header CTA is "Add Subject". No sample data.
- She hits "Add Subject". Modal opens. She types "Math". Saves.
- Now there's a subject. **No chapter.** She has to figure out that subjects have chapters, chapters have tasks. The hierarchy is implicit.

### Step 5 — Add chapter and tasks
- She drills into the subject, adds a chapter ("Calculus"), then has to find the "Add Task" or "Bulk Series" feature. She tries Bulk Series. The composer demands she invent `baseName`, `count`, `startAt`, `numberPadding`, `separator`, `placement` — **6 parameters** for what should be "name + count".
- Onboarding tour told her about this *visually* but she's in a different page now. There is **no contextual hint, no in-page tutorial overlay, no inline help**.

### Step 6 — Planner
- Clicks "Planner" in the sidebar. Step 1 (Intake) shows her subjects+chapters+tasks with checkboxes. She doesn't understand why some tasks are pre-checked and others aren't. There's no legend.
- Step 2 (Setup) asks for `study_start_date`, `exam_date`, `weekday_capacity_minutes`, `weekend_capacity_minutes`, `max_active_subjects`, `flexibility_minutes`, `day_of_week_capacity` (per-day overrides), and a host of advanced fields. **9 inputs minimum**, no recommended defaults, no "I don't know — pick reasonable" auto-fill.
- Step 3 (Review) generates the plan. If feasibility is RED, the Plan Issue Modal opens. The fix-it suggestions are good but the language ("Increase daily study time by 47 minutes") is jarring without context.

### Step 7 — Commit
- She clicks "Commit". `commitPlan` runs. Possible outcomes she sees:
  - SUCCESS: tasks appear on `/schedule` and `/dashboard/calendar`.
  - "Duplicate commit detected. Please wait a moment before retrying." — what? She pressed it once. (See §3.1 BUG 2.)
  - "Failed to commit plan: invalid_session_counters" — internal RPC errors leak through `mapCommitRpcErrorMessage` (`plan.ts:184`).

### Step 8 — Daily use
- Tomorrow she comes back. Dashboard shows today's tasks. She marks a task complete. The toggle works (`DashboardTaskToggle` does an optimistic update).
- She drags a task to a different day in `/schedule`. **On mobile the drag is impossible.** On desktop it works.
- Two days later she misses a task. The "RescheduleMissedButton" handles this — but only re-runs the *greedy heuristic* over pending tasks. If the heuristic drops sessions, she gets a "1 task could not be rescheduled" warning with a `droppedReasons[]` she can't act on without going back to the planner setup.

### Steps that don't exist at all

There is **no**:
- Forgot password flow.
- Email change flow.
- Profile picture / display name editor outside of signup.
- Account deletion.
- Data export (GDPR).
- Notifications (push, email reminders, deadline alerts).
- Goal-tracking / "you've studied 12 hours this week" insights.
- Pomodoro / timer integration.
- Calendar integration (.ics export, Google Calendar push).
- Streak protection ("freeze your streak").
- Sharing (study with a friend, accountability partner).

**First-time user journey score: 3.5 / 10.** The product can be used after manual handholding. Cold, it confuses and frustrates.

---

## 7. Reliability & Bug Inventory

| # | Severity | Location | Issue |
|---|---|---|---|
| R1 | 🔴 Critical | `app/actions/onboarding/completeOnboarding.ts:29` | Writes non-existent `onboarding_completed` column. **Breaks first-run.** |
| R2 | 🔴 High | `proxy.ts:84-94` | Fail-open on profile-fetch error → users with no profile reach protected pages. |
| R3 | 🔴 High | `lib/planner/engine.ts:815` | Capacity is silently scaled up on overload — user is not told their daily commitment grew. |
| R4 | 🔴 High | `supabase/migrations/0001_production_schema.sql:710` | `commit_plan_atomic_v2_wrapper` hash uses non-canonical `p_tasks::text`. Dedupe is unreliable. |
| R5 | 🟠 Medium | `app/actions/subjects/tasks.ts:604` | `reorderTasks` runs N sequential UPDATEs in no transaction. Partial failure scrambles order. |
| R6 | 🟠 Medium | `lib/planner/engine.ts:842` | `isTopicSpacingOK()` is a no-op (`return true`) — dead code that suggests an unimplemented feature. |
| R7 | 🟠 Medium | `lib/planner/engine.ts:589` | `computeInternalSubjectGapDays` ignores `_loadRatio` parameter — dead/stale logic. |
| R8 | 🟠 Medium | `app/components/onboarding/TutorialWizard.tsx:469` | `preload()` of all guided-flow images on mount → loads ~9 MB before first paint. |
| R9 | 🟠 Medium | `app/error.tsx:28` | Raw `error.message` rendered to user → information disclosure. |
| R10 | 🟠 Medium | `lib/contracts/schemas.ts:110` | `plannerSettingsSchema` is stale — does not match SQL columns. Will silently `.passthrough()` invalid data. |
| R11 | 🟠 Medium | `app/auth/signup/page.tsx:36` | After signup, `localStorage.setItem("showFounderMessage", "true")` — uses local storage as cross-page state. Fragile, breaks in incognito. |
| R12 | 🟠 Medium | `commit_plan_atomic_v2` | The `keep_mode='until'` and `keep_mode='future'` branches do the **identical** thing (lines 520–531 of migration). Dead branch. |
| R13 | 🟠 Medium | `app/(dashboard)/schedule/page.tsx` | 822-line component holds 12+ `useState`. The custom hooks (`useWeekNavigation`, `useDayOrder`, `useScheduleFilters`) help but the page still renders too much per state change. |
| R14 | 🟢 Low | `next.config.ts` | Only sets `distDir`. No `headers()`, no `images.remotePatterns`, no `poweredByHeader: false`. |
| R15 | 🟢 Low | `playwright.config.ts` | Smoke test (`e2e/smoke.spec.ts`) only checks 4 URLs return 200. No real flow tested. |
| R16 | 🟢 Low | Toast component | No queue cap. A loop of failed actions can fill the screen with toasts. |
| R17 | 🟢 Low | `subjects.no_others_subject` SQL constraint | Bypassable with Unicode homoglyphs. |
| R18 | 🟢 Low | `app/landingpage/page.tsx:107` | A 3-second autoplay carousel with no pause-on-focus, no reduced-motion respect on hero slides. |

**Reliability score: 4.5 / 10** — a critical first-run bug alone caps this.

---

## 8. Performance & Scalability Audit

### 8.1 Frontend bundle

- The `scripts/check-bundle-size.mjs` exists but is not enforced (continue-on-error in CI).
- `public/onboarding/*.png` totals **9.1 MB**. Every onboarding mount preloads the whole set.
- `public/app_screenshots/auth_cover.png` and similar large PNGs on landing/auth pages.
- No `next/image` `priority` hierarchy, no LQIP, no AVIF/WebP variants.
- `globals.css` 2,462 lines = ~80 KB of CSS shipped on first paint.
- Two giant client components (`subjects-data-table.tsx`) load JavaScript on routes the user may never visit. There's no `dynamic()` import for them.

### 8.2 Database scalability

- Per-request `profiles` SELECT in `proxy.ts` (described in §2.2a). At 1k RPS this is 1k queries/sec just for navigation.
- `idx_tasks_user_date (user_id, scheduled_date)` is good, but `getTasksForDate` (in `lib/tasks/getTasksForDate.ts`) loads the whole week and filters in JS, not in SQL. For a power user with 1,000 tasks/week, this is wasteful.
- `plan_snapshots.schedule_json` grows unboundedly. `getPlanSnapshots` returns the latest 20 — fine — but each row may be 1–5 MB. Network egress will hurt.
- No read replica / no Postgres connection pooling visible.
- No edge / regional deploy guidance — Supabase is single-region by default, your Next deployment is likely Vercel default → guaranteed cross-region latency for non-US users.

### 8.3 Algorithmic

- `lib/planner/engine.ts:schedule()` is **O(days × topics × subjects × overflow_rounds)**. With 200 topics × 365 days × 5 overflow rounds, you're at ~365k iterations per generate. That's tolerable. But you call `generatePlanAction` from the *server action* synchronously, blocking the request. At 100 concurrent generates, your Node process holds the event loop.
- The reoptimize preview re-runs the entire scheduler client-triggered, server-executed, no caching by input hash.

### 8.4 Caching

- Next.js caching is broken by `revalidatePath` carpet bombing.
- No HTTP cache headers set.
- No SWR/React Query in client.
- No Redis/upstash.

**Scalability score: 4.0 / 10.**

---

## 9. Security Audit

| Area | State | Verdict |
|---|---|---|
| Row-level security | Comprehensive on all 9 tables | ✅ Strong |
| Server-side auth check | Every action calls `getUser()` | ✅ Strong |
| Input validation (Zod) | Only at row level, not action inputs | ❌ Weak |
| Output escaping (XSS) | React handles auto-escape; no raw `dangerouslySetInnerHTML` found | ✅ OK |
| CSP / Security headers | None set in `next.config.ts` | ❌ Missing |
| Rate limiting | None | ❌ Missing |
| Bot protection | None (no hCaptcha on signup) | ❌ Missing |
| Email enumeration | Default Supabase `signUp` returns different shapes for existing vs. new emails | 🟠 Vulnerable |
| Password policy | Min 6 chars, no complexity, no breach check | ❌ Weak |
| MFA | Not implemented | ❌ Missing |
| Session rotation | Default Supabase JWT TTL; `auth.getUser()` refreshes | ✅ OK |
| CSRF | Next.js Server Action protection | ✅ OK |
| Secret leakage | `.env.local` is gitignored (`.env*`); .env (Builder.io public key) is gitignored too | ✅ OK |
| Error message hygiene | Raw Postgres errors flow to UI in many actions | ❌ Leak |
| Audit logging | None | ❌ Missing |
| GDPR right-to-erase | Cascade deletes work, but no user-visible flow | ❌ Missing |

**Security score: 5.0 / 10.**

---

## 10. Testing & Quality Gates Audit

`package.json:18` runs `vitest run && vitest run --config vitest.config.dom.ts`. CI also runs Playwright.

| Category | What exists | Gap |
|---|---|---|
| Unit (server actions) | 14 files | No DB integration; all use mocks. False confidence. |
| Unit (components) | 7 UI primitives | None for the 2,770-line subjects-data-table or the 822-line schedule page. |
| Unit (planner) | 5 files (`scheduler`, `analyzePlan`, `overloadAnalyzer`, `planIssues`, `planTransforms`) | No fuzz tests — the greedy heuristic begs for property-based tests. |
| E2E (Playwright) | **`e2e/smoke.spec.ts` — 32 lines, 4 cases, none authenticated** | The actual product flow (signup → onboarding → subject → chapter → plan → commit → schedule) is not tested anywhere. |
| Visual regression | None | No Percy / Chromatic. |
| A11y | None | No axe / pa11y. |
| Performance | None | No Lighthouse CI, no bundle-budget enforcement. |
| Coverage threshold | None | Vitest has no `coverage.thresholds` set. |
| Migration tests | None | No way to verify a migration is idempotent or reversible. |
| Load tests | None | No k6 / Artillery scripts. |

**Testing score: 5.5 / 10** — the unit tests exist but the *important* tests (E2E auth, schedule integrity, RLS) don't.

---

## 11. DevOps / Operability Audit

| Area | Status |
|---|---|
| CI | GitHub Actions 3-job matrix (typecheck/lint/test/build, e2e, audit). Reasonable. |
| CD | Not visible. No `vercel.json`, no Netlify, no GH deploy job. |
| Environments | One. No staging/prod split visible. |
| Migrations workflow | `supabase/migrations/000X_*.sql` exists; no script to apply, no DB integration test that runs them. |
| Monitoring | None. |
| Alerting | None. |
| Backups | Whatever Supabase ships by default. No verified restore. |
| Runbook | Absent. |
| Secrets management | `.env*` gitignored. No rotation plan. |
| Branching | `dev-v1`, `dev-v2`, `main` — described in commits as a "quality roadmap". OK. |

**DevOps / operability score: 4.5 / 10.**

---

## 12. Documentation Audit

`docs/` contains:
- `ARCHITECTURE.md` (287 lines, well-written)
- `CONTRIBUTING.md` (small)
- `IMPLEMENTATION_PLAN.md` (31 KB)
- `execution.md` (32 KB)
- `onboarding_better.md` (17 KB)
- `db_schema.md` (root level, mostly accurate)

The doc quality is unusually high for a codebase of this size and is one of the few unalloyed positives. **However**, some docs describe an aspirational state. For example, `db_schema.md` documents the column drops accurately, but `completeOnboarding.ts` was never updated to match (the bug in §3.1).

A documented system that the code doesn't follow is worse than no documentation — it makes new devs trust statements that aren't true.

**Documentation score: 7.0 / 10.**

---

## 13. Product / CXO View

### What the product *says* it is
> "A planning app for deadline-driven preparation."
> "AI-powered study planner."
> "Deterministic constraint solver."
> "Flags impossible deadlines before you even begin studying."

### What it *actually* is
A solid scaffolding for a **manual study tracker** with a bolted-on **greedy schedule generator** that mostly works for small inputs and silently degrades for large ones. The core differentiator advertised in marketing — feasibility analysis with structured fix-it suggestions — is the strongest part of the codebase (`lib/planner/draft.ts:buildPlanIssues`). It is also the part the user encounters last in the funnel.

### Strategic problems

1. **You're selling AI but shipping a heuristic.** Users will figure this out in week 2 and feel deceived. Either ship real optimisation (LP/CP) or change the marketing.
2. **No retention loop.** No streaks-as-feature (the table has streak columns, but the UI is a number; no notifications, no shareable artifact).
3. **No virality.** No sharable plan link, no "study with a friend".
4. **No monetisation hook.** "Free plan" implied; no paywall, no Stripe, no premium-only feature defined.
5. **One persona.** The data model assumes a single subject hierarchy with topics and tasks. There's no support for a user who has *two parallel exams*, or *a non-exam goal*, or *project work*.
6. **No offline.** A study app that doesn't work on a flaky train connection is missing a major use-case.

**Product/CXO score: 4.0 / 10.**

---

## 14. The Fix-Everything Roadmap

A pragmatic, ordered plan. **Stop adding features until items 1–8 are done.**

### Now (this week)
1. **Fix the onboarding bug.** Remove `onboarding_completed` from `completeOnboarding.ts:29`. Or add a column. Either way, end the infinite loop.
2. **Fix the middleware fail-open.** `proxy.ts:84-94` must redirect on error, not pass through.
3. **Strip `error.message` from `app/error.tsx`.** Show a generic message, log the detail.
4. **Add `app/error.tsx` siblings for each route group** with friendlier copy.
5. **Add CSP/security headers** in `next.config.ts`.
6. **Cap the toast queue** at 3.
7. **Replace marketing copy** about "AI" and "deterministic" with an accurate "smart heuristic".

### Next (this sprint)
8. **Replace the carousel onboarding** with an interactive "create your first subject + chapter + 3 tasks + plan in 60 s" flow.
9. **Move auth to Server Actions.** Kill the browser-side `signInWithPassword`.
10. **Bulk reorder via single SQL.** Eliminate the N×UPDATE loops in `tasks.ts`, `chapters.ts`, `reorderSubjects.ts`.
11. **Ship password reset, email change, account deletion.**
12. **Add `eslint-plugin-jsx-a11y`** and fix the top 50 issues.
13. **Server-action input Zod schemas.** Wrap actions in `withAuth()` HOF.
14. **Real E2E**: signup → onboarding → first subject → first chapter → first plan → commit → schedule visible. One headless run in CI.

### Soon (this quarter)
15. **Mobile**: ship a real mobile schedule view (vertical agenda) and a card-list subjects view.
16. **Image pipeline**: AVIF/WebP conversion, lazy preload only the active onboarding step.
17. **Refactor** the two 2,770-line/1,440-line subjects tables into one TanStack-Table-backed implementation.
18. **Push profile claim into JWT**, drop the middleware DB read.
19. **Replace the greedy scheduler** with either a CP-SAT/wasm solver or, at minimum, a deterministic-iteration version with explicit user-facing capacity-scaling messages.
20. **Add Sentry + structured Pino logger**, and wire `ops_events` to a real BI tool.
21. **Bundle size budget enforcement** (fail CI, not warn).
22. **Visual regression tests** on the dashboard, schedule, planner step-3 preview.

### Eventually
23. Real-time updates (`supabase.channel`) so a second tab reflects task completion.
24. Notifications (deadline reminders, streak warnings) via email + push.
25. Calendar (.ics) export.
26. Pricing / Stripe.
27. Multi-goal / multi-exam support.
28. Native iOS/Android shell or PWA install banner.

---

## 15. Final Verdict

PrepVeda is a **well-intentioned, mid-quality, half-finished SaaS prototype** that has been over-documented relative to its actual readiness. It would, today, fail the most basic test for a paid consumer product:

> *"Hand it to a stranger. Watch them sign up, finish onboarding, build a plan, and commit it without help."*

The single first-run bug in `completeOnboarding.ts` alone is enough to fail that test. Layered on top are mobile-hostile UX, an aspirational but actually-greedy "deterministic solver", a 4-line smoke E2E suite that tests nothing meaningful, and zero observability.

The good news is that **almost every problem in this audit is fixable in days, not months**, because the foundations (RLS, Server Actions, the schema, the feasibility analyser) are sound. Stop building new features. Spend two weeks on the items in §14.1–8. Then re-audit.

> **Composite final score: 5.0 / 10.**
> Promising bones, broken first-run, leaking abstractions, and marketing several leagues ahead of engineering reality.

---

*End of audit. — generated by an automated review of the dev-v2 branch on 2026‑05‑04.*
