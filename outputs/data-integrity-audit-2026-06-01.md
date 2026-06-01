# Data integrity audit — 2026-06-01

Catalog produced by `wf_9a6941f5-b79` (4 parallel SQL audits against the
mockup Supabase project `naqqlztgbayxcgfphrxg`). No fixes made during
this step — flagged items are tracked as dispatcher follow-ups.

## 1. Sessions with `hauler_id IS NULL`

```sql
SELECT id, driver_name, company, started_at, ended_at, hauler_id
FROM driver_sessions
WHERE hauler_id IS NULL
ORDER BY started_at DESC;
```

**Row count: 5** (all closed, none active)

| Driver | Company | ended_at |
|---|---|---|
| Marco | MBL 503 | 2026-05-30 22:51 |
| Yair Cortez | j&c | 2026-05-30 13:42 |
| Yair Cortez | J&C Trucking | 2026-05-30 15:57 |
| Jesus Zamora | Fenco | 2026-05-29 15:47 |
| Cowgirl | Cowgirl Demo | 2026-05-29 02:45 |

**Verdict:** Low-priority dispatcher cleanup. None of these are active sessions
— no live data is leaking. But the closed shifts won't roll up to any
contractor's totals. Suggested action:
1. Backfill `hauler_id` on the four real-looking rows by matching the
   `company` string to `haulers.name`:
   - Marco / MBL 503
   - Yair Cortez / j&c + J&C Trucking (likely the same contractor with two name spellings → merge to op-pnxzr)
   - Jesus Zamora / Fenco
2. Delete or leave the `Cowgirl / Cowgirl Demo` row (looks like a demo artifact).

Longer-term: consider making `hauler_id` `NOT NULL` or adding a
session-start validation that requires a hauler match.

## 2. Sessions with negative or >24h computed hours

```sql
SELECT id, driver_name, started_at, ended_at,
       EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))/3600 AS hours
FROM driver_sessions
WHERE started_at IS NOT NULL
  AND (
    EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) < 0
    OR EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))/3600 > 24
  )
ORDER BY hours DESC;
```

**Row count: 0**

**Verdict:** No anomalies. All 7 sessions in the table have both
`started_at` and `ended_at` populated, durations from ~2.7 min to ~9.2 h
(average ~4.3 h) — all within normal single-shift envelope. Recommend
running this audit nightly as session volume grows so any future
forgot-to-clock-out or clock-skew bugs surface early.

## 3. Reverse-geocode coverage gaps in `truck_events`

**Note:** Original query referenced a `location` column that doesn't exist
on this table. Coordinates live in `latitude` / `longitude` (double precision).
Adapted query:

```sql
SELECT id, event_type, event_at,
       (latitude IS NOT NULL AND longitude IS NOT NULL) AS has_location,
       address
FROM truck_events
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  AND (address IS NULL OR trim(address) = '')
  AND event_at < NOW() - INTERVAL '5 minutes'
ORDER BY event_at DESC
LIMIT 50;
```

**Row count: 6** (all from 2026-05-29, 3+ days stale)

| event_type | event_at |
|---|---|
| pickup_load | 2026-05-29 14:27 |
| dropoff_load | 2026-05-29 14:27 |
| pickup_load | 2026-05-29 13:39 |
| end_shift | 2026-05-29 02:45 |
| dropoff_load | 2026-05-29 02:44 |
| pickup_load | (further 1 not shown) |

**Verdict:** ⚠ Reverse-geocode is **not keeping up**. The gap spans the full
event vocabulary (pickup, dropoff, end_shift), so this isn't an isolated
code path — likely the Nominatim worker hasn't run since 2026-05-29 OR
silently errored. Suggested actions:
1. Check whether the reverse-geocode worker is running / has errored since 2026-05-29
2. Run a backfill job over these 6 rows (and any older orphans not captured by LIMIT 50)
3. Add a Supabase alert when the count of `(lat/lng present AND address NULL AND event_at < now() - 5 min)` rows exceeds zero so this can't silently grow

## 4. Driver widget recent sessions: `truck_number` + `dispatch_company`

```sql
SELECT id, driver_name, started_at, truck_number, dispatch_company, plate_input
FROM driver_sessions
WHERE started_at >= NOW() - INTERVAL '7 days'
ORDER BY started_at DESC
LIMIT 30;
```

**Row count: 7** (all pre-2026-06-01)

| Driver | started_at | truck_number | dispatch_company | plate_input |
|---|---|---|---|---|
| Marco | 2026-05-30 13:37 | NULL | NULL | NULL |
| David Vasquez | 2026-05-30 13:22 | NULL | NULL | NULL |
| Yair Cortez | 2026-05-30 13:08 | NULL | NULL | NULL |
| Yair Cortez | 2026-05-30 12:57 | NULL | NULL | NULL |
| David Vasquez | 2026-05-29 14:06 | NULL | NULL | NULL |
| (2 more, same shape) | | | | |

**Verdict:** **Inconclusive** — not a confirmed regression. All 7 sessions
in the last 7 days landed *before* the new driver widget shipped on
2026-06-01 (commit `a6d2f6b`), so NULLs on `truck_number` /
`dispatch_company` / `plate_input` are expected for those rows. Zero
sessions exist from 2026-06-01 onward, so there's no post-ship data to
validate the new write path against.

Suggested next action:
1. Wait for (or manually trigger) a real driver session on the live widget today
2. Re-run the query — if a post-2026-06-01 row still shows NULL on
   `truck_number`/`dispatch_company`/`plate_input`, that **is** a
   regression and the writer code in the driver widget (commit `a6d2f6b`)
   needs investigation
3. In the meantime, smoke-test the driver widget locally to confirm the
   insert payload actually includes the new fields before more user
   traffic accumulates

## Summary

| Audit | Findings | Severity |
|---|---|---|
| Unassigned sessions | 5 rows (all closed) | Low — dispatcher cleanup |
| Duration anomalies | 0 rows | None |
| Reverse-geocode gaps | 6 rows stale since 2026-05-29 | ⚠ Worker may be down — investigate |
| Driver widget truck_number coverage | Inconclusive (no post-ship sessions) | Cannot verify — needs live driver data |
