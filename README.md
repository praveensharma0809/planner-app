# PrepVeda

PrepVeda is a planning app for deadline-driven preparation built on Next.js + Supabase.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase Auth + Postgres + RLS
- Vitest

## Design

- **Light-mode only.** Dark theme has been removed (Phase 12). The design uses a custom light-mode semantic token system (`--surface-*`, `--text-*`, `--pastel-*`) with a three-layer surface model (page → app shell → inset panels).
- Pill-shaped interactive elements, pastel accent chips, diffused shadows.
- See `DESIGN_V2_PLAN.md` for the full design specification.

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
npm run check:hotspot-sizes
npm run test
npm run build
```

Or run all gates:

```bash
npm run ci:check
```

## Source-of-truth docs

- `db_schema.md`

## Migration baseline

- `supabase/migrations/0001_production_schema.sql`
- `supabase/migrations/0002_drop_legacy_rpc.sql`

## Notes

- Runtime is aligned to DB v2 contracts.

