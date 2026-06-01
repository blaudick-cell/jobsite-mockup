# Test data cleanup — 2026-06-01

## What

A second Yair Cortez session row had `driver_name = "Yair Cortez PERSIST-TEST"`,
left over from persist-fix verification work in a prior session. Was visible
in production on Dispatch Overview cards.

## Scope of audit

SQL search across `driver_sessions` (driver_name) and `haul_requests`
(project_label, contractor_name) for `TEST`, `PERSIST`, `E2E`:

```sql
SELECT 'driver_sessions' AS source, id::text, driver_name AS label, started_at::text AS ts
FROM driver_sessions
WHERE driver_name ILIKE '%TEST%' OR driver_name ILIKE '%PERSIST%' OR driver_name ILIKE '%E2E%'
UNION ALL
SELECT 'haul_requests', id::text, project_label, requested_at::text
FROM haul_requests
WHERE project_label ILIKE '%TEST%' OR project_label ILIKE '%PERSIST%' OR project_label ILIKE '%E2E%'
   OR contractor_name ILIKE '%TEST%' OR contractor_name ILIKE '%E2E%';
```

## Findings

| Source | ID | Test marker | Action |
|---|---|---|---|
| `driver_sessions` | `fe886a9b-af90-4163-8751-657df4117566` | `Yair Cortez PERSIST-TEST` | restored `driver_name = "Yair Cortez"` |

No matching haul_requests rows (the earlier `hreq-test-c4`, `hreq-c5-a`,
`hreq-c5-b`, `hreq-pie-test`, `hreq-bothways-test`, `hreq-e2e-jc` were all
cleaned up in their respective verification cycles).

## Audit-trail entry left on the cleaned row

A short note was appended to `dispatcher_notes` recording the restore + timestamp
so the next dispatcher who opens the drawer can see why the name changed.
