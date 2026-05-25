# Supabase migrations needed before Phase 2 can ship

**Project ref:** `naqqlztgbayxcgfphrxg`
**Discovery method:** Per-table column probing via PostgREST against the publishable key, plus minimal-insert + delete probes to read back the full column inventory of empty tables.
**Today:** 2026-05-22
**Status:** Phase 2 (read path) implementation HALTED per the brief's schema-lockstep clause. No `index.html` changes have been committed. Awaiting Dispatch to apply these `ALTER TABLE` statements via the Supabase MCP. Once applied, Phase 2 + Phase 3 can proceed without further schema work.

---

## 2026-05-23 URGENT — write path broken on loads + hours

Robert reported: *"any new field added or edited no longer saves correctly."* Root cause: commit `d528abf` (schema v17→v18, `feat(loads): canonical db.loads as single source`) added `haulRequestId` to `loads` and `hours` rows in JS + the `SB_FIELDS_JS` whitelist, but the matching `ALTER TABLE`s were never applied. Every load/hours upsert since that deploy has 400'd with:

```
PGRST204 — Could not find the 'haul_request_id' column of 'loads' in the schema cache
PGRST204 — Could not find the 'haul_request_id' column of 'hours' in the schema cache
```

`syncDbToCloud` swallows the error (`.catch(e => console.warn(...))`), so the local state appears to save but Supabase never receives it. On the next page refresh, bootstrap reads the pre-edit cloud state and any field changes vanish — affecting **every** edit that triggers a loads or hours upsert (add load, change load CY/ticket/photo/time/date, change clock-in/out, assign load to a haul, etc.).

**Apply these:**

```sql
ALTER TABLE loads ADD COLUMN IF NOT EXISTS haul_request_id text REFERENCES haul_requests(id) ON DELETE SET NULL;
ALTER TABLE hours ADD COLUMN IF NOT EXISTS haul_request_id text REFERENCES haul_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_loads_haul_request_id ON loads(haul_request_id);
CREATE INDEX IF NOT EXISTS idx_hours_haul_request_id ON hours(haul_request_id);
```

The `text` type matches the `haul_requests.id` PK shape (`hreq-001` etc.). `SET NULL` on delete is consistent with the other hauler/project FK cleanup pattern. The two indexes are because the load/hour rollup queries in `AdminHaulRequestDetail` filter by `haul_request_id`.

**JS-side stopgap shipped at the same time:** `haulRequestId` removed from `SB_FIELDS_JS.loads` + `SB_FIELDS_JS.hours` so upserts succeed (sacrificing cross-device load↔haul assignment until the migration lands). After Dispatch applies the migration, restore the two whitelist entries and bump `DB_SCHEMA_VERSION` to invalidate the localStorage cache.

---

---

## TL;DR — apply these 8 ALTER TABLEs, then re-run me

```sql
-- haulers: JS db.haulers carries contact + address; SB has neither
ALTER TABLE haulers  ADD COLUMN IF NOT EXISTS contact text;
ALTER TABLE haulers  ADD COLUMN IF NOT EXISTS address text;

-- trucks: JS truck.hauler is a denormalized display name kept in sync by
-- the v15 migration (any UI still reading truck.hauler stays correct). SB
-- has hauler_id but no hauler text mirror.
ALTER TABLE trucks   ADD COLUMN IF NOT EXISTS hauler text;

-- invoices: JS shape is much richer than SB. number / issuedDate / billTo /
-- lineItems / notes are user-facing critical fields surfaced everywhere in
-- AdminPayments and AdminInvoiceDetail. Without them the invoice UI breaks.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS number      text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_date date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_to     text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items  jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes       text;
```

That's everything. No table drops, no rename-with-data, no constraint changes — pure additive. Safe to re-run (`IF NOT EXISTS` on every column).

After applying, also bump the `meta` row so the cascade marker matches what the JS code expects to see on hydrate:

```sql
UPDATE meta SET value = to_jsonb(17::int), updated_at = now() WHERE key = 'schema_version';
```

(Current meta.schema_version is `13`; current JS `DB_SCHEMA_VERSION` is `17`. JS already has migration cascades v13→v17 so this works either way, but bumping after the column additions makes the state self-consistent.)

---

## Per-table reconciliation report

Format: **JS field → Supabase column.** Status: ✓ matches, ⚠ adapter rename (no schema change), ✖ schema change required.

### projects ✓ (no schema change)

| JS                | SB                       | Status |
|-------------------|--------------------------|--------|
| id                | id                       | ✓      |
| code              | code                     | ✓      |
| name              | name                     | ✓      |
| gc                | gc                       | ✓      |
| address           | address                  | ✓      |
| startDate         | start_date               | ⚠ snake↔camel |
| status            | status                   | ✓      |
| material (array)  | materials (array)        | ⚠ JS singular → SB plural (rename in adapter) |
| haulType          | haul_type                | ⚠ snake↔camel |
| contactName       | contact_name             | ⚠ snake↔camel |
| contactPhone      | contact_phone            | ⚠ snake↔camel |
| contactEmail      | contact_email            | ⚠ snake↔camel |
| volumeCYNeeded    | volume_cy_needed         | ⚠ snake↔camel |
| volumeCYKnown     | volume_cy_known          | ⚠ snake↔camel |
| pickupLocation    | pickup_location (text)   | ⚠ snake↔camel |
| dumpLocation      | dump_location (text)     | ⚠ snake↔camel |
| —                 | material_type, loads_target, loads_completed, estimated_completion, created_at, updated_at | unused on JS — leave null |

### haulers ✖ (2 columns to add)

| JS         | SB                       | Status |
|------------|--------------------------|--------|
| id         | id                       | ✓      |
| name       | name                     | ✓      |
| **contact**| —                        | ✖ ADD `contact text` |
| phone      | phone                    | ✓      |
| email      | email                    | ✓      |
| **address**| —                        | ✖ ADD `address text` |
| projectIds | project_ids (array)      | ⚠ snake↔camel |
| logo       | logo                     | ✓      |
| attachments| attachments (jsonb/array)| ✓      |
| —          | company, created_at, updated_at | unused on JS — leave null |

### drivers ✓

| JS    | SB    | Status |
|-------|-------|--------|
| id    | id    | ✓      |
| name  | name  | ✓      |
| phone | phone | ✓      |
| —     | license, default_truck_id, created_at, updated_at | unused on JS — leave null |

### trucks ✖ (1 column to add)

| JS        | SB         | Status |
|-----------|------------|--------|
| id        | id         | ✓      |
| plate     | plate      | ✓      |
| type      | type       | ✓      |
| **hauler**| —          | ✖ ADD `hauler text` (denormalized display name, kept in sync by v15 migration; some UI still reads `truck.hauler`) |
| haulerId  | hauler_id  | ⚠ snake↔camel |
| projectId | project_id | ⚠ snake↔camel |
| driverId  | driver_id  | ⚠ snake↔camel |
| —         | make, model, capacity_cy, rate_per_hour, created_at, updated_at | unused on JS — leave null |

### materials ✓ (constant; one-time seed only)

| JS const  | SB    | Status |
|-----------|-------|--------|
| code      | code (PK) | ✓ |
| label     | label | ✓ |
| —         | rate  | unused on JS — leave null |

`MATERIALS` is currently a JS-side constant (not in `db`) and isn't user-editable. Phase 2 will seed the table once from the JS constant on first run; the UI keeps reading the JS constant for now. If you ever want the materials list to be admin-editable per device, we'd lift it into `db.materials` in a later phase.

### rates ⚠ (shape adapter only — no schema change)

JS `db.rates` is a flat object: `{ SD: 115, TAN: 125, ED: 135, BD: 145, HS: 140 }`.
SB `rates` is row-shaped: `(truck_type PK, rate_per_hour, updated_at)`.

Adapter logic:
- **Read:** `SELECT truck_type, rate_per_hour FROM rates` → `Object.fromEntries(rows.map(r => [r.truck_type, r.rate_per_hour]))`
- **Write:** flat object → array of `{truck_type, rate_per_hour}` rows → `upsert(rates, ..., onConflict: 'truck_type')`

### loads ⚠ (1 adapter rename only)

| JS         | SB        | Status |
|------------|-----------|--------|
| id         | id        | ✓      |
| driverId   | driver_id | ⚠      |
| truckId    | truck_id  | ⚠      |
| projectId  | project_id| ⚠      |
| material   | material  | ✓      |
| cy         | cy        | ✓      |
| **ticketNo** | **ticket** | ⚠ rename in adapter |
| time       | time      | ✓      |
| date       | date      | ✓      |
| status     | status    | ✓      |
| —          | photo, notes, created_at | unused on JS — leave null |

### hours ✓

| JS         | SB         | Status |
|------------|------------|--------|
| id         | id         | ✓      |
| driverId   | driver_id  | ⚠      |
| truckId    | truck_id   | ⚠      |
| projectId  | project_id | ⚠      |
| clockIn    | clock_in   | ⚠      |
| clockOut   | clock_out  | ⚠      |
| breakMin   | break_min  | ⚠      |
| status     | status     | ✓      |
| date       | date       | ✓      |
| —          | created_at | unused on JS — leave null |

### invoices ✖ (5 columns to add)

| JS              | SB                | Status |
|-----------------|-------------------|--------|
| id              | id                | ✓      |
| haulerId        | hauler_id         | ⚠      |
| projectId       | project_id        | ⚠      |
| haulRequestId   | haul_request_id   | ⚠      |
| **number**      | —                 | ✖ ADD `number text` |
| periodStart     | period_start      | ⚠      |
| periodEnd       | period_end        | ⚠      |
| **issuedDate**  | —                 | ✖ ADD `issued_date date` |
| **billTo**      | —                 | ✖ ADD `bill_to text` |
| status          | status            | ✓      |
| createdAt       | created_at        | ⚠      |
| sentAt          | sent_at           | ⚠      |
| paidAt          | paid_at           | ⚠      |
| paymentRef      | payment_ref       | ⚠      |
| **lineItems**   | —                 | ✖ ADD `line_items jsonb NOT NULL DEFAULT '[]'` |
| loadCount       | loads             | ⚠ rename in adapter (`loads` column already exists on SB) |
| totalCY         | total_cy          | ⚠      |
| **notes**       | —                 | ✖ ADD `notes text` |
| —               | hours, amount     | unused on JS — leave null |

### haul_requests ✓ (clean alignment)

| JS                | SB                 | Status |
|-------------------|--------------------|--------|
| id                | id                 | ✓      |
| projectId         | project_id         | ⚠      |
| materialCode      | material_code      | ⚠      |
| volumeCY          | volume_cy          | ⚠      |
| requestedAt       | requested_at       | ⚠      |
| status            | status             | ✓      |
| matchedHaulerId   | matched_hauler_id  | ⚠      |
| matchedTruckId    | matched_truck_id   | ⚠      |
| acceptedByDriver  | accepted_by_driver | ⚠      |
| passedBy          | passed_by (array)  | ⚠      |
| notes             | notes              | ✓      |
| assignments       | assignments (jsonb)| ✓      |
| pickupLocation    | pickup_location (jsonb) | ⚠ |
| dropoffLocation   | dropoff_location (jsonb)| ⚠ |
| timing            | timing (jsonb)     | ✓      |
| siteAccess        | site_access (jsonb)| ⚠      |
| —                 | created_at         | unused on JS — leave null |

### activity ⚠ (1 adapter rename)

| JS         | SB             | Status |
|------------|----------------|--------|
| id         | id             | ✓      |
| type       | type           | ✓      |
| actorRole  | actor_role     | ⚠      |
| actorId    | actor_id       | ⚠      |
| summary    | summary        | ✓      |
| refId      | ref_id         | ⚠      |
| **timestamp** | **timestamp_ms** | ⚠ rename in adapter |
| —          | created_at     | unused on JS — leave null |

### meta ✓

Key/value/updated_at row table. JS stores `schemaVersion` and `activityLastReadAt` as two `meta` rows.

Currently populated:
```
schema_version: 13
source: "jobsite-mockup-demo"
mode: "shared"
```

After applying the column-add migrations above, also run:
```sql
UPDATE meta SET value = to_jsonb(17::int), updated_at = now() WHERE key = 'schema_version';
```

---

## JS-only collections (NOT mirrored to Supabase by design)

These stay in localStorage only — they are computed/derived caches, not user-edited state:

- **`db.geocode`** — Nominatim resolutions for street addresses. Cache; rebuilds on demand.
- **`db.routes`** — OSRM driving polylines. Cache; rebuilds on demand.

Putting these on Supabase would bloat row counts (every address × every browser) without user-visible benefit. The Live Operations Map already lazy-fetches missing routes/geocodes and writes them back to local `db` via `setDb`.

If Robert wants these mirrored too (e.g. "every new browser should see Robert's already-computed routes without re-querying OSRM"), we can add `geocode` and `routes` jsonb tables in a follow-up — but it isn't on the critical path for the cross-device persistence story.

---

## What I verified before halting

- All 12 tables exist and accept SELECT/INSERT/DELETE with the publishable key + permissive RLS. ✓
- No probe rows left behind in any table (verified empty after my discovery inserts). ✓
- `meta` is populated with the three rows above. ✓
- Current JS `db` shape post-hydrate matches the column inventory above (cross-checked against `buildSeed()`, `hydrateDb()` migration cascade output, and the v17 schema additions). ✓

---

## Next action

1. **Dispatch:** apply the 8 `ALTER TABLE` statements above via Supabase MCP. (~30 seconds.)
2. **Optional:** apply the `UPDATE meta` bump.
3. **Re-dispatch me** with "schema applied, proceed with Phase 2." I will then:
   - Build the `_sb` adapter (snake↔camel mapping per the table above, plus the `rates` shape adapter and the 3 explicit field renames: `ticketNo↔ticket`, `loadCount↔loads`, `timestamp↔timestamp_ms`, `material[]↔materials[]`)
   - Refactor `hydrateDb` to read from Supabase first, fall back to localStorage on network failure (Phase 2 task 3)
   - Add the loading + offline indicators
   - Commit + push Phase 2 alone
   - Verify on the live Netlify URL
   - Then build Phase 3 (write path + realtime) and ship a second commit

No JS commits land until the migrations are applied, per the schema-lockstep clause.

---

## v18 follow-up — JSE-issued haul-request invoices (2026-05-22)

The Print invoices feature (commit `feat(haul-detail): print invoices …`) introduces JSE-issued invoices generated from haul-request detail pages. These are distinct from the existing per-hauler invoices (hauler → GC) — they're from Jobsite Exchange → GC, encoded by a `kind` field set to `'interim'` or `'final'`.

For demo robustness `kind` is currently a JS-only field (number prefix `INV-INT-` / `INV-FIN-` carries the information into Supabase as a derivable fallback). To make `kind` first-class and survive cross-tab Realtime broadcasts cleanly, apply:

```sql
-- v18: distinguish JSE-issued haul-request invoices from per-hauler invoices.
-- 'interim' bills delivered CY to date; 'final' bills the closed haul. NULL on
-- legacy per-hauler invoices (haulerId set, kind unset).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS kind text;
```

After applying, add `'kind'` to `SB_FIELDS_JS.invoices` in `index.html` so writes include the column and reads decode it.

Not load-bearing — demo works without this. Dispatch can apply when convenient.

---

## v19 follow-up — driver shift pause + millisecond clock timestamps (2026-05-22)

Driver shift state on `hours` uses four fields that live only on the JS side today:

- `clockedInAt` (epoch ms) — exact tick of clock-in (the `clock_in` column is `HH:MM` only)
- `clockedOutAt` (epoch ms) — exact tick of clock-out
- `pausedAt` (epoch ms or null) — when the current pause started; null = not paused
- `pausedMs` (int) — total accumulated paused milliseconds since clock-in

`elapsedMs` calc in DriverHome/DriverTruckDetail depends on all four for the live "ON THE CLOCK" timer. `pausedAt` truthiness is what flips the Pause button to Resume. Without them on Supabase, a page reload during an active shift loses pause state and resets the elapsed-time math to the rounded `breakMin` only.

In-tab the Pause button works (commit `fix(driver): Pause button …` round-trips the markLocalWrite snapshot through jsRowToSb+sbRowToJs so the Realtime echo doesn't overwrite the JS-only fields). Cross-tab + cross-reload persistence needs:

```sql
-- v19: shift pause + ms-precision clock timestamps on hours
ALTER TABLE hours ADD COLUMN IF NOT EXISTS clocked_in_at  bigint;
ALTER TABLE hours ADD COLUMN IF NOT EXISTS clocked_out_at bigint;
ALTER TABLE hours ADD COLUMN IF NOT EXISTS paused_at      bigint;
ALTER TABLE hours ADD COLUMN IF NOT EXISTS paused_ms      bigint NOT NULL DEFAULT 0;
```

After applying, add `'clockedInAt', 'clockedOutAt', 'pausedAt', 'pausedMs'` to `SB_FIELDS_JS.hours` in `index.html` so writes include the columns and reads decode them. The camelToSnake adapter already maps them correctly (no overrides needed).

Not load-bearing for the in-tab Pause fix; needed only for cross-reload persistence of pause state.

---

## v20 follow-up — link loads + hours to a haul request (2026-05-23)

Architectural unification: `db.loads` and `db.hours` become the canonical source of truth for every load / hours surface (truck detail page, haul detail page, truck mini-phone widget on /admin/trucks/active). To do that, each row needs to know which haul request it belongs to so that the haul detail page's per-truck day-list can filter `db.loads.filter(l => l.haulRequestId === req.id && l.truckId === assignment.truckId)` instead of reading the legacy `req.assignments[].days[].loads[]` array.

```sql
-- v20: link loads + hours to a haul request (nullable; legacy rows stay NULL)
ALTER TABLE loads ADD COLUMN IF NOT EXISTS haul_request_id text;
ALTER TABLE hours ADD COLUMN IF NOT EXISTS haul_request_id text;

-- helpful read-path indexes
CREATE INDEX IF NOT EXISTS loads_haul_request_id_idx ON loads(haul_request_id);
CREATE INDEX IF NOT EXISTS hours_haul_request_id_idx ON hours(haul_request_id);
```

After applying, add `'haulRequestId'` to both `SB_FIELDS_JS.loads` and `SB_FIELDS_JS.hours` in `index.html`. The camelToSnake adapter already maps `haulRequestId ↔ haul_request_id` correctly (no overrides needed — same convention as `invoices.haulRequestId`).

Additive, idempotent, safe to re-run. Dispatch can auto-apply.

**Photo upload on haul-detail loads:** No new bucket needed. The existing truck-page photo upload stores a base64 data URL inline in `loads.photo` (existing `text` column), already round-trips through Supabase via `SB_FIELDS_JS.loads.photo`. The haul-detail photo column mirrors that same data-URL pattern — no Storage code path required.

---

## v21 follow-up — clock-in photo on hours (2026-05-25)

The restored driver widget adds an optional "Add a photo" prompt at clock-in (truck condition, dump body, gear check). One photo per shift, stored on the hours row.

```sql
-- v21: optional clock-in photo URL/data-URL on hours
ALTER TABLE hours ADD COLUMN IF NOT EXISTS photo text;
```

After applying, add `'photo'` to `SB_FIELDS_JS.hours` in `index.html` so the field round-trips through Supabase + Realtime.

**Storage:** No new bucket needed. The clock-in photo follows the same pattern as `loads.photo` — base64 data URL inline in the column. Avoids Supabase Storage configuration on the demo project.

**Code-side handling:** Optional — user can Skip. Reads use `h.photo` with conditional thumbnail render. No write if no photo attached. Existing rows continue to work unchanged.

Additive, idempotent, safe to re-run. Dispatch can auto-apply.
