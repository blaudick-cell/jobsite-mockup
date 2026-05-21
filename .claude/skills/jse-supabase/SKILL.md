---
name: jse-supabase
description: Data-layer migration plan from in-memory + localStorage to Supabase Postgres. Phase 1 (schema) shipped; Phase 2-4 ahead. Lockstep rule: JS schema bumps require matching SQL alter table BEFORE pushing.
---

# JSE Supabase

The Jobsite Exchange mockup is migrating its data layer from in-memory `useState` + `localStorage` to a Supabase Postgres backend, **incrementally**, without ever breaking the live demo.

## Project facts

- **Supabase URL:** `https://naqqlztgbayxcgfphrxg.supabase.co`
- **Publishable anon key:** `sb_publishable_oA0wnxRiDG2QzXIeNT3zLQ_3YikcDRl` (safe to ship in `index.html`).
- **Dashboard:** `https://supabase.com/dashboard/project/naqqlztgbayxcgfphrxg`
- **Region:** `us-west-1`. **Tier:** Pro.
- **Realtime:** enabled on every table (Phase 3).
- **Auth:** none right now — using the publishable key with permissive RLS. Auth lands in Phase 4.

This Supabase instance is **separate** from the real JSE Supabase (`pmfxzedlezybfooqvojv`). The mockup is a sandbox for schema + interaction patterns; integration with the real product is "promote schemas + patterns," never "share the database at runtime."

## Migration phases

| Phase | Status | What |
|---|---|---|
| **1** | **shipped** | Supabase project created; all 12 collection tables created mirroring the JS `db` shape; jsonb columns for nested fields; RLS permissive. The JS app still reads/writes its own state via `localStorage`. |
| **2** | next | Read path: on hydrate, the JS app fetches each table once via `supabase-js` and seeds local state from the response. localStorage stays as fallback if Supabase is unreachable. |
| **3** | later | Write path + Realtime: every `setDb` mutation upserts to Supabase. Subscriptions to each table replace the existing storage-event cross-tab sync ([[jse-realtime]]). |
| **4** | later | Cleanup: drop localStorage, drop in-memory seeds, switch RLS to user-scoped, add auth UI. |

## The 12 tables

| table | jsonb columns | notes |
|---|---|---|
| `projects` | `material` | + scalar `contact_name`, `contact_phone`, `contact_email`, `volume_cy_needed`, `volume_cy_known`, `pickup_location`, `dump_location`, `haul_type` (v15+v16+v17) |
| `haulers` | `project_ids`, `attachments` | + `logo` (v15), `contact` |
| `drivers` | — | flat |
| `trucks` | — | flat |
| `hours` | — | flat — note: `clockedInAt`/`pausedAt`/`pausedMs` are real ms epoch numbers |
| `loads` | — | flat |
| `invoices` | `line_items` | `haul_request_id` (v13 nullable), `payment_ref` |
| `rates` | — | single-row key-value (truck type → hourly rate) |
| `haul_requests` | `assignments`, `pickup_location`, `dropoff_location`, `timing`, `site_access`, `passed_by` | The biggest jsonb load — v8 `assignments[]` + v12 logistics fields all nested |
| `activity` | — | append-only event log |
| `geocode` | — | key/value cache (address → lat/lng). v14. |
| `routes` | `coords` | jsonb array of `[lng, lat]` pairs. v17. |

## Migration log

| Date | Script | What |
|---|---|---|
| Phase 1 | `jse_mockup_initial_schema` | All 12 tables + RLS + Realtime ON. |
| 2026-05-21 | `haulers_add_logo` | `alter table haulers add column logo text;` (matches JS v15) |
| 2026-05-21 | `projects_add_contact_columns` | `alter table projects add column contact_name text, contact_phone text, contact_email text, volume_cy_needed numeric, volume_cy_known boolean default true;` (matches JS v16) |
| 2026-05-21 | `projects_add_pickup_dump` + `routes_table` | `alter table projects add column pickup_location text, dump_location text;` and `create table routes (key text primary key, coords jsonb, distance_meters numeric, duration_seconds numeric);` (matches JS v17) |

(Run via Supabase MCP `apply_migration`. Inspect with `list_migrations`.)

## Lockstep rule (load-bearing)

**Any JS `DB_SCHEMA_VERSION` bump MUST have a matching Supabase `alter table` applied BEFORE the JS commit is pushed.** No exceptions.

**Why:** Phase 2's read path will try to upsert the new column on first hydrate after the deploy. If the column doesn't exist in Postgres yet, the upsert errors, the seed step bails out, and the live demo silently regresses to localStorage-only mode. Worse: when Phase 3 lands, the write path will fail for any column added in JS but missing in SQL — and we won't notice until a user mutation drops on the floor.

**How to apply:**
1. Producer (background Cowork or main builder) flags the new column / table in the proposal's **Risk notes** section with the phrase `SCHEMA-DRIFT RISK:` plus the exact `alter table` SQL needed.
2. Orchestrator (Robert + Claude on main) runs that SQL via the Supabase MCP's `apply_migration` BEFORE pushing the JS commit.
3. Orchestrator confirms in the deploy verify step: `list_migrations` shows the new entry, then push.
4. The producer's commit message + the Supabase migration name reference the same JS schema version (e.g. "schema v17" + `projects_add_pickup_dump`).

If you skip step 2 and push anyway: revert immediately, run the SQL, re-push.

## RLS mode

Shared/permissive right now: any client with the publishable anon key can read and write any row. **Don't** put anything in the mockup database that you'd be embarrassed to leak — Robert's seed data only.

Switching to user-scoped RLS in Phase 4 means adding `created_by uuid references auth.users` to every table and writing per-table policies (`auth.uid() = created_by` on update/delete; public read for now). The mockup will need an auth flow at that point.

## Naming convention

Postgres uses snake_case (`contact_name`, `pickup_location`). JS uses camelCase (`contactName`, `pickupLocation`). A thin adapter at the Supabase boundary handles the rename — defined once, applied uniformly:

```js
const toRow = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()), v]));
const fromRow = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));
```

Don't sprinkle case conversions through the code — funnel everything through these two helpers at the Supabase read/write boundary.

## Cross-refs

[[jse-data-model]] · [[jse-ship-a-feature]] · [[jse-realtime]]
