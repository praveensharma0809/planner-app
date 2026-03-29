# Cleanup Residuals

Last updated: 2026-03-27

## Final status
- Runtime app/backend paths are clean of removed legacy concepts.
- Planner actions and scheduler logic are aligned to DB v2.
- Contract guard tests enforce no regression of removed identifiers.

## What remains intentionally
- RPC argument key `p_config_snapshot` is still used in app RPC payload for SQL signature compatibility.

## Ongoing policy
- Keep `information/Current_db_Schema.md` and `information/db-v2-contract-matrix.md` as canonical references.
- Treat any reintroduction of removed identifiers as a regression.
