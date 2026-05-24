# Data Revert + Delete-Hauler-Reappears — Root Cause Analysis

**Date:** 2026-05-23
**Reporter:** Robert
**Symptoms (two related bugs):**
1. *"When you attempt to delete a hauler it does not actually delete the hauler"* — deleted haulers reappear later.
2. *"I updated a lot of information and it reverted back to an old version"* — edits roll back to old values.

**Verdict:** Both bugs share a single root cause in the schema-migration cascade. A separate, lower-severity Phase 3 echo-skip race is also confirmed and will be hardened in the same change.

---

## Summary

The hydrate cascade in `hydrateDb` (`index.html:2603`) is structured as a chain of forward migrations from v1 → v18. Each step is supposed to be either *idempotent* (safe to re-run on already-migrated data) or *strictly progressive* (only adds/transforms what's missing).

**Two steps in the cascade are unconditionally destructive:**

| Step      | Line          | Effect on re-run                                        |
| --------- | ------------- | ------------------------------------------------------- |
| v14 → v15 | `index.html:2785` | `out.haulers = HAULERS_SEED;` — **wipes user haulers**  |
| v15 → v16 | `index.html:2822` | `out.projects = PROJECTS_SEED;` — **wipes user projects** |

Combined with a second bug — **cloud `meta.schema_version` is stuck at 17 while client code is at 18** — the cascade runs *on every page load* for every device. So every refresh wipes hauler + project edits and resurrects deleted haulers.

```
cloudMeta.schema_version (Supabase): 17
DB_SCHEMA_VERSION (index.html):      18
```

When `parsed.schemaVersion < DB_SCHEMA_VERSION`, hydrateDb runs **every** migration step from v1, including the destructive v14→v15 and v15→v16. There is no "start from `parsed.schemaVersion`" logic — each step is supposed to handle being re-run on newer data.

This was confirmed by querying the live Supabase project (`https://naqqlztgbayxcgfphrxg.supabase.co/rest/v1/meta`) and inspecting the cascade structure.

---

## How the bugs manifest

### Bug 1: Delete-hauler doesn't stick

1. Robert deletes hauler `op-006` (J&C Trucking). Local state filters it out; `syncDbToCloud` sends `DELETE haulers/op-006` to Supabase. Verified via REST: the DELETE succeeds (HTTP 204) and `trucks.hauler_id` is `SET NULL` automatically (FK constraint behaves correctly — that part of the original commit was right).
2. Activity log confirms a `hauler.deleted` event landed in Supabase (`act-u9hj0` at `1779518545326` for J&C).
3. Robert refreshes the page (or opens a new tab).
4. `bootstrapCloud` fetches Supabase. `cloudMeta.schema_version = 17`. `assembleDbFromCloud` constructs `raw` and routes it through `hydrateDb`.
5. Cascade runs. At v14→v15: `out.haulers = HAULERS_SEED` — **all six seed haulers, including J&C, are written back into `out`**. The cloud data (which correctly omitted J&C) is discarded.
6. `setDbRaw(result.db)` puts J&C back in local state. UI shows the deleted hauler is "back."

The activity log shows Robert had to **re-delete J&C and Garcia** today (`act-xeb63`, `act-cfimr` at ~`1779591662401`) after deleting them yesterday (`act-u9hj0`, `act-mmei0` at ~`1779518545326`). That's the bug pattern — every deleted hauler resurrects on next load until Robert hits Delete a second time.

(Z&Z only needed one delete event because between yesterday and today, Robert may not have refreshed in a state where Z&Z came back, or he checked the haulers list less often.)

### Bug 2: Hauler/project edits revert on next page load

Same root cause:

1. Robert edits a hauler (or project) — name, contact, address, attachments, direction-toggle, etc.
2. `syncDbToCloud` upserts the row to Supabase. Verified — the upsert succeeds and the row is updated.
3. Refresh.
4. `bootstrapCloud` → `assembleDbFromCloud` → `hydrateDb` cascade.
5. v14→v15: `out.haulers = HAULERS_SEED` (or v15→v16: `out.projects = PROJECTS_SEED`). **Robert's edited values are clobbered by seed values.**
6. UI shows the pre-edit version.

The activity log corroborates this: between 1779569191024 and 1779569201944 (~10 sec window), Robert rapid-toggled "5800 Federal direction" between HAS and NEEDS **10 times in ~11 seconds**, then again at 1779576109462+. That's the classic pattern of someone clicking, seeing the value snap back, clicking again, snap back, etc.

---

## Walk of all suspect paths

| # | Path                                                  | Verdict                                                                                                                                                                                                                                                                                          |
| - | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a | Realtime echo race / single-slot `recentLocalWrites`  | **Confirmed real bug** — the `Map<string, {value, expiresAt}>` keyed by `${jsKey}:${rowKey}` only stores the LATEST snapshot. If the same row is upserted N times within 10s, earlier echoes are mis-classified as remote changes and applied via `setDbRaw`, overwriting state with stale values. Not the primary cause of Robert's report, but a real revert mechanism for any rapid same-row editing flow. Hardened in this commit. |
| b | Bootstrap re-seed of empty tables                     | **Ruled out** — `seedMissingTables` only triggers when `byKey[k].length === 0`. Haulers table never went empty (op-001/003/004 remained). No empty-table re-seed happened.                                                                                                                       |
| c | Cross-tab `storage` event clobbering fresher state    | **Possible but not primary** — the listener blindly `setDbRaw(hydrateDb(e.newValue))`. If two tabs are open and disagree, the latter writer wins, which could resurrect deleted data. Robert primarily uses one tab, so this is secondary. Same `hydrateDb` cascade also fires here, so same migration bug applies through this path too. |
| d | Stale localStorage winning vs. Supabase fetch         | **Confirmed via the migration cascade** — localStorage state is correct, but bootstrap's `assembleDbFromCloud` re-runs `hydrateDb` and clobbers it with seed values via v14→v15 / v15→v16.                                                                                                       |
| e | Concurrent Code session pushing seed data             | **Ruled out** — recent commits don't change `HAULERS_SEED`/`PROJECTS_SEED`. Last touch was `1261050` (v15 hauler reseed) on May 21.                                                                                                                                                              |
| f | Reset Demo accidentally triggered                     | **Ruled out** — `ChromeMenu.onReset` (`index.html:1429`) still gates with `window.confirm(...)`. Activity log shows no truncation — older events from yesterday are intact.                                                                                                                       |
| g | FK constraint blocking hauler delete                  | **Ruled out** — verified by REST API probe: created `op-fkprobe` with attached truck `tk-fkprobe`, deleted hauler, response `204` and `trucks.hauler_id` set to `null` automatically. The Supabase FK migrations from commit `d0b42b4` are correct.                                              |
| h | **Schema cascade re-running destructive migrations**  | **CONFIRMED — primary cause of both bugs.** Cloud `meta.schema_version = 17`, code `DB_SCHEMA_VERSION = 18`. Cascade runs from v1 every page load. v14→v15 (`out.haulers = HAULERS_SEED`) and v15→v16 (`out.projects = PROJECTS_SEED`) are unconditionally destructive.                          |

---

## Why this slipped through

Each previous schema bump (v1→v2 through v13→v14) was strictly additive: backfill new fields, rename `operators`→`haulers`, etc. Re-running these on already-migrated data is a no-op.

Starting at v14→v15, the bumps changed character — Robert wanted the SEED itself replaced (real Denver haulers, real project list), and the migration was written as `out.haulers = HAULERS_SEED;` / `out.projects = PROJECTS_SEED;`. This is correct for **one-time-only** migrations but wrong for the cascade pattern, which expects every step to be safe to re-run.

The bug remained latent because:
- Cloud `schema_version` was correctly bumped to 17 at some point (when v17 shipped).
- It was NOT bumped to 18 when v18 (loads/hours haulRequestId backfill) shipped.
- The v17→v18 step is itself idempotent, so v17 cloud + v18 code seems to work — *until* you remember the cascade re-runs v14→v15 and v15→v16 from scratch every time `parsed.schemaVersion < DB_SCHEMA_VERSION`.

There is **no mechanism in the app to bump cloud `meta.schema_version` after a code release.** It only gets written on first-run cloud seeding (`seedMissingTables`) or on `resetDemoCloud`. So `DB_SCHEMA_VERSION` and cloud `schema_version` drift apart silently with every release.

---

## Fix shipped in this commit

### 1. Make destructive migrations idempotent (durable)

`v14 → v15` haulers reset — only run when the data still looks like v14 shape (any hauler id in `op-007..op-010`, OR none of the v15 seed ids present). Otherwise leave `out.haulers` alone.

`v15 → v16` projects reset — only run when the data still looks like v15 shape (any project id in `WP|GW|CH|AS`, OR none of the v16 seed ids present). Otherwise leave `out.projects` alone.

This means re-running the cascade on already-migrated data is a no-op for these steps.

### 2. Bump cloud `meta.schema_version` to 18 (immediate)

Performed via REST API as part of this RCA work. Stops the bleeding for anyone with the current bundle. Combined with fix #1, the system is durable against this class of bug going forward.

### 3. Multi-slot `recentLocalWrites` (durable)

Replace the single-slot `Map<key, {value, expiresAt}>` with a multi-slot ring buffer (`Map<key, Array<{value, expiresAt}>>`). `markLocalWrite` appends; `isLocalEcho` matches against ANY snapshot within TTL.

This fixes the "rapid same-row edit causes earlier echoes to be misclassified as remote changes" race for any flow that touches the same row multiple times within 10 seconds.

### 4. Auto-sync cloud schema_version after a successful migration (durable)

When the cascade runs and reaches a higher version, write the new `schema_version` back to cloud meta. Other devices and future page loads then take the early-exit path in `hydrateDb` and skip the cascade entirely.

This is gated on `parsed.schemaVersion !== DB_SCHEMA_VERSION` so it only fires when actually needed. If two clients on different code versions race, the higher version wins on the meta row, but old clients keep working because `if (parsed.schemaVersion > DB_SCHEMA_VERSION) return seed;` is a separate path (it only triggers when reading a payload from cloud at a higher version — which is fine; old client gets a seed for that session, doesn't write back).

---

## Preventive guidance for future schema work

When adding a new migration step in `hydrateDb`:

- **Write the step as idempotent.** Re-running on already-migrated data must be a no-op.
- **If a seed replacement is intentional, gate it on shape detection.** E.g., `if (haulersStillContainV14Ids(out.haulers)) out.haulers = HAULERS_SEED;`.
- **Treat the cascade as "run from v1 every time" by default.** Don't rely on `parsed.schemaVersion >= N` to skip earlier steps — until/unless we refactor the cascade to start from `parsed.schemaVersion`.
- **Bump `DB_SCHEMA_VERSION`** AND **rely on the auto-sync (fix #4)** to push the new version to cloud meta on first page load after deploy.

---

## Verification

- Manual test on local preview: refresh after deleting a hauler — hauler stays deleted.
- Manual test: edit a hauler name, refresh — edit persists.
- REST probe of `meta.schema_version` after fix: returns `18`.
- Bundle pushed to Netlify; etag flipped; jobsiteexchange.com canary unchanged.
