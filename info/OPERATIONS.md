# Operations Guide

This document defines the production trust layer for StudyHard.

## 1. Reliability Targets

- Planner action success rate (generate, commit): >= 99.5%
- Quick start success rate: >= 98%
- Dashboard server action P95 latency: < 1500 ms
- Commit action P95 latency: < 2500 ms

## 2. CI Release Gates

CI workflow: `.github/workflows/ci.yml`

Required checks per push and pull request:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

Local equivalent:

```bash
npm run ci:check
```

## 3. Telemetry Events

Telemetry helper: `lib/ops/telemetry.ts`

Critical events currently emitted:

- `planner.generate`
- `planner.commit`
- `planner.quick_start`
- `planner.reschedule_missed`

Payload fields:

- `event_name`
- `event_status` (`started`, `success`, `warning`, `error`)
- `user_id`
- `duration_ms`
- `metadata`
- `created_at`

## 4. Telemetry Storage

Migration file: `supabase/migrations/006_ops_events.sql`

By default, telemetry writes to structured server logs only.

To also persist telemetry in DB, set:

```env
ENABLE_DB_TELEMETRY=true
```

When enabled, events are inserted into `ops_events`.

## 5. Operational Queries

Error rate by event (last 24 hours):

```sql
select
  event_name,
  count(*) as total,
  count(*) filter (where event_status = 'error') as errors,
  round(
    100.0 * count(*) filter (where event_status = 'error') / nullif(count(*), 0),
    2
  ) as error_pct
from ops_events
where created_at >= now() - interval '24 hours'
group by event_name
order by error_pct desc, total desc;
```

P95 latency by event (last 24 hours):

```sql
select
  event_name,
  percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
  avg(duration_ms) as avg_ms,
  count(*) as samples
from ops_events
where created_at >= now() - interval '24 hours'
  and duration_ms is not null
group by event_name
order by p95_ms desc;
```

Quick start funnel (last 7 days):

```sql
select
  event_status,
  count(*)
from ops_events
where event_name = 'planner.quick_start'
  and created_at >= now() - interval '7 days'
group by event_status
order by event_status;
```

## 6. Incident Response

If error rate spikes:

1. Confirm if CI/deploy changed in the same window.
2. Identify top failing event in `ops_events`.
3. Inspect `metadata.reason` distribution.
4. Validate Supabase service health and DB load.
5. Roll back latest deployment if failure is release-induced.
6. Add a follow-up test for the failing path.

If latency spikes:

1. Check P95 by event and isolate endpoint.
2. Compare DB query timings and row volume.
3. Identify expensive branch via `metadata`.
4. Mitigate with query/index fix or temporary feature flag.

## 7. Weekly Ops Checklist

- Review 7-day error trends for all planner events.
- Review 7-day P95 latency trends.
- Confirm no failing CI checks were bypassed.
- Verify migrations are forward and rollback safe.
- Add tests for every production incident fixed.
