# StudyHard

StudyHard is a planning app for deadline-driven preparation built on Next.js + Supabase.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth + Postgres + RLS
- Vitest

## Key areas

- `app/actions` - server-side reads/mutations
- `app/(dashboard)` - dashboard, planner, schedule pages
- `app/onboarding` - setup flow
- `lib/planner/engine.ts` - scheduling engine core
- `lib/planner/repository.ts` - planner DB access layer
- `lib/planner/planTransforms.ts` - planner transformation helpers
- `lib/planner/contracts.ts` - runtime contract validators

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

3. Start app:

```bash
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test:contracts
npm run test
npm run build
```

Or run all gates:

```bash
npm run ci:check
```

## Source-of-truth docs

- `information/Current_db_Schema.md`
- `information/db-v2-contract-matrix.md`
- `information/backend-rewrite-master-plan.md`

## Notes

- Runtime is aligned to DB v2 contracts.
- Contract guard tests prevent reintroduction of removed legacy fields/concepts.
