# Activity table prune — 2026-06-01

## Why

The Supabase `activity` table had accumulated 320 rows, ~84% of which were
seed/demo entries from before the Phase 2 + Phase 3 driver-data unification
on 2026-05-29. Those seed entries referenced entities — loads, hours,
drivers, projects, haul-request assignments — that have since been purged
or fundamentally restructured (commits `26cc34e`, `b7ebb41`, `7894e42`).
Keeping them around made the admin Activity Feed noisy and confusing.

## What

Deleted every `activity` row with `timestamp_ms < 2026-05-28T06:00:00Z`
(the day before the Phase 3 backfill). That cutoff is generous — the
actual real-ops cutoff is 2026-05-29 — and captures every entry from the
2026-05-22 .. 2026-05-26 seed window.

```sql
WITH cutoff AS (SELECT EXTRACT(EPOCH FROM '2026-05-28T06:00:00Z'::timestamptz) * 1000 AS ms)
DELETE FROM activity WHERE timestamp_ms < (SELECT ms FROM cutoff);
```

## Counts (pre / post)

| | Pre-purge | Post-purge |
|---|---|---|
| Total rows | 320 | 51 |
| Earliest | 2026-05-19 | 2026-05-31 22:30 UTC |
| Latest | 2026-06-01 | 2026-06-01 22:52 UTC |
| Deleted | — | 269 |

## What was deleted (by type)

| Type | Count | Why seed |
|---|---|---|
| `haul_request.updated` | 75 | All 2026-05-22..05-26; haul-request edits from seed |
| `haulRequest.truckAdded` | 36 | Old `assignments[]` flow; superseded by `haul_assigned_trucks` (also purged in commit `7894e42` direction shift) |
| `truck.created` | 26 | Seed truck setup |
| `load.logged` | 22 | Loads table purged in C2 |
| `project.updated` | 15 | Projects entity dropped earlier |
| `shift.started` | 14 | Hours table purged in C2 |
| `shift.ended` | 12 | Hours table purged in C2 |
| `load.removed` | 9 | Loads table purged in C2 |
| `haul_request.deleted` | 9 | Mostly seed cleanup itself |
| `hauler.deleted` | 7 | Seed cleanup |
| `invoice.deleted` | 4 | Invoices table purged in C2 |
| `hauler.created` | 4 | Seed setup |
| `project.created` | 4 | Seed setup |
| One-offs (matched, declined, accepted, approved, etc.) | 9 | Seed lifecycle artifacts |

## What was kept (51 rows)

| Type | Count | Notes |
|---|---|---|
| `session.deleted` | 45 | Real admin deletions of test/orphan driver sessions during stabilization |
| `haul_request.created` | 3 | Includes today's real test job creations |
| `invoice.drafted` | 2 | Real admin actions (2026-06-01) |
| `invoice.sent` | 1 | Real admin action (2026-06-01) |

## Safety

- Cleanup ran via SQL only — no schema or JS-code change. No risk to
  in-flight operational data (driver_sessions, truck_events, event_photos,
  issue_reports all untouched).
- Admin Activity Feed UI surfaces this table directly through
  `useDriverSessionsLive` + the `activity` collection; next page-load
  reflects the prune automatically.
