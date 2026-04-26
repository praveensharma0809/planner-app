# Contributing to PrepVeda

Hey there! Glad you want to help build PrepVeda. Here's everything you need to get started.

## Setup

```bash
git clone <repo-url>
cd planner-app
npm install
```

Create `.env.local` in the project root with these two keys:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Then fire up the dev server:

```bash
npm run dev
```

App runs at `http://localhost:3000`.

## Development Workflow

- Branch off `dev-v1` using one of these prefixes:
  - `feature/<desc>` — new capabilities
  - `fix/<desc>` — bug fixes
  - `chore/<desc>` — tooling, deps, cleanup
- Open a PR targeting `dev-v1` for review.
- Merges to `main` (or `master`) are reserved for production releases.

## Quality Gates

Run these before opening a PR — they all must pass:

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run typecheck` | `tsc --noEmit` (TypeScript strict)    |
| `npm run lint`      | ESLint v9 with `eslint-config-next`   |
| `npm run test`      | vitest (unit + integration)           |
| `npm run build`     | `next build` (must succeed)           |
| `npm run ci:check`  | Runs **all** of the above plus extra texture checks |

## Commit Conventions

- **Imperative mood, present tense** — "add toast duration constant", not "added toast duration constant".
- **Subject line under 50 characters**.
- **Body explains WHY**, not what (the diff already shows what changed).

Example:

```
fix: prevent double-submit on plan generation

useTransition was not wrapping the generate call, so rapid
double-clicks created two plan snapshots. Added startTransition
wrapper in Step3Generate.
```

## PR Checklist

- [ ] `npm run ci:check` passes
- [ ] Manual QA on mobile (375 px) and desktop (1440 px)
- [ ] Manual QA: planner wizard (all 3 steps work)
- [ ] Manual QA: schedule drag-and-drop works
- [ ] Manual QA: subjects page CRUD works
- [ ] No breaking changes to existing APIs
- [ ] Server Actions use `revalidatePath` where needed

## Tech Stack

| Layer        | Tech                          |
| ------------ | ----------------------------- |
| Framework    | Next.js 16.1.6 (App Router)   |
| UI           | React 19.2.3                  |
| Language     | TypeScript 5.9.3 (strict)     |
| Database     | Supabase (Postgres + RLS + SSR auth) |
| Styling      | Tailwind CSS v4               |
| Drag & Drop  | @dnd-kit v6                   |
| Unit/Int.    | Vitest 2.1.4                  |
| Linting      | ESLint v9 (flat config)       |
| E2E          | Playwright 1.59.1             |

---

Thanks for contributing!
