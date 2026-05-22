# Supabase migrations needed before Phase 2 can ship

**Project ref:** `naqqlztgbayxcgfphrxg`
**Discovery method:** Per-table column probing via PostgREST against the publishable key, plus minimal-insert + delete probes to read back the full column inventory of empty tables.
**Today:** 2026-05-22
**Status:** Phase 2 (read path) implementation HALTED per the brief's schema-lockstep clause. No `index.html` changes have been committed. Awaiting Dispatch to apply these `ALTER TABLE` statements via the Supabase MCP. Once applied, Phase 2 + Phase 3 can proceed without further schema work.

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
