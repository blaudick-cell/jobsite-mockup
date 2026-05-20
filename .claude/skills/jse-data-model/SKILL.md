---
name: jse-data-model
description: The `db` shape for Jobsite Exchange. Nine collections, the relationships between them, ID conventions, the today/yesterday date convention on loads + hours, and the frozen `NOW_MIN` time.
---

# JSE Data Model

`db` lives in App-level `useState` and persists via `jse_db_v1` localStorage. See [[jse-ship-a-feature]] for persistence semantics.

## Nine collections

| key | seed name | shape |
|---|---|---|
| `projects` | `PROJECTS_SEED` | `{ id, code, name, gc, address, startDate, status, material: [] }` |
| `haulers` | `HAULERS_SEED` | `{ id, name, phone, email, projectIds: [] }` |
| `drivers` | `DRIVERS_SEED` | `{ id, name, phone }` |
| `trucks` | `TRUCKS_SEED` | `{ id, plate, type, hauler, projectId, haulerId, driverId? }` |
| `hours` | `HOURS_SEED` | `{ id, driverId, truckId, projectId, clockIn, clockOut?, breakMin, status, date, clockedInAt?, pausedMs?, pausedAt? }` |
| `loads` | `LOADS_SEED` | `{ id, driverId, truckId, projectId, material, cy, ticketNo?, time, date, status }` |
| `invoices` | `INVOICES_SEED` | `{ id, haulerId, projectId, ..., lineItems: [] }` |
| `rates` | `RATES_INIT` | `{ [truckType]: hourlyRate }` |
| `haulRequests` | `HAUL_REQUESTS_SEED` | `{ id, projectId, materialCode, volumeCY, requestedAt, status, matchedHaulerId?, matchedTruckId?, notes? }` (added in v3) |

## Relationships

```
Project ─┬─< Hauler (via hauler.projectIds[] — many-to-many)
         ├─< Truck (truck.projectId — one-to-many)
         ├─< Load (load.projectId)
         ├─< Hours (hours.projectId)
         └─< HaulRequest (haulRequest.projectId)

Hauler ─┬─< Truck (truck.haulerId)
        ├─< Invoice (invoice.haulerId)
        └─< Hours (via the hauler's trucks)

HaulRequest ─┬── Hauler (haulRequest.matchedHaulerId, nullable until matched)
             └── Truck  (haulRequest.matchedTruckId, nullable until matched)

Truck ─┬── Driver (truck.driverId, nullable)
       ├─< Load (load.truckId)
       └─< Hours (hours.truckId)

Driver ─┬─< Load (load.driverId)
        └─< Hours (hours.driverId)

Load uses load.material → MATERIALS[].code (10 codes — CF, TS, CR, EX, SD, GR, CO, AC, RR, MU)
HaulRequest uses haulRequest.materialCode → same MATERIALS[].code set
Truck uses truck.type   → rates[code]         (truck-type code keyed hourly rate)
```

**A driver can have multiple trucks today.** `db.trucks.filter(t => t.driverId === drId)` is the canonical lookup. DriverShell renders `DriverMultiTruckHome` when length > 1, `DriverHome` when length === 1, `DriverNoTruck` when 0.

**Trucks must have both a `projectId` and `haulerId`.** The wizard ensures this. There's no UI to assign a truck without a hauler. Don't write code that allows it.

## ID conventions

- **Projects** — 2-4 char uppercase code (`WP`, `RR`, `ATP`). Auto-derived from project name initials in the wizard, user-editable, uniqueness-checked. ID === code (they're the same string). The separate `code` field is a display string like `'WP-24'` derived as `id + '-' + paddedIndex`.
- **Haulers / trucks / drivers / loads** — `'<prefix>-' + Math.random().toString(36).substring(2, 7)`. Prefixes: `op-`, `tk-`, `dr-`, `ld-`. Seed records use sequential numbering (`op-001`, `tk-447`, `ld-1001`). The `op-` prefix on hauler IDs is retained from v1–v3 for migration compatibility; new haulers also use it.
- **Hours** — `'hr-' + random5`. Seed uses `hr-1`, `hr-2`, etc.

**Why:** mixed conventions exist because seeds were written for readability; runtime creation uses random suffixes to avoid collision. Match the runtime convention for new records.

## The `date` field

`loads` and `hours` records carry `date: 'today' | 'yesterday'` (string literals, not real dates — this is mock data).

- Seed loads: ~52 marked `today`, ~10 marked `yesterday`.
- Seed hours: 4 short-haul shifts marked `today` (clocked out earlier); 20 full shifts marked `yesterday`.
- New loads created via `DriverLogLoad` are stamped `date: 'today'`.
- New live shifts (clock-in) are stamped `date: 'today'`.

**Why:** without this field, "loads today vs yesterday" can't be computed (hours have no real timestamps and loads carry `time: 'HH:MM'` strings, not dates).

**How to apply:** any new load/hours creation path must include `date: 'today'`. Any "today" filter is `db.loads.filter(l => l.date === 'today')`.

## `NOW_MIN` = 11*60 + 5

Defined at `index.html:487`. The frozen "current time" used by `calcHours` when `clockOut` is null (live shifts). Don't use `new Date()` for shift-duration math — it makes the mockup non-deterministic. Always go through `calcHours(clockIn, breakMin, clockOut)`.

## Truck `type` codes

`TAN | SD | ED | BD` (Tandem, Side Dump, End Dump, Belly Dump) — keys into `db.rates`. Used by reporting to compute revenue. `TRUCK_TYPES` constant (~`index.html:270`) has the display labels.

## Statuses

| collection | status values |
|---|---|
| `projects.status` | `active`, `upcoming`, `completed` |
| `hours.status` | `open` (live), `pending` (clocked out, awaiting approval), `closed` (approved) |
| `loads.status` | `approved`, `pending` |
| `haulRequests.status` | `pending` (unassigned), `matched` (hauler + truck assigned), `completed` (delivered) |
| (truck) | `inservice` / `idle` — derived, not stored. `inservice` = has an open shift on this truck. |

See [[jse-design-system]] for how each status maps to a color/pill.

## What's NOT in the data model

- **No `users` collection.** Driver/hauler/admin "identity" is just a UI shell selection.
- **No auth.**
- **No real timestamps** (other than `clockedInAt`/`pausedAt`/`pausedMs` on live shifts, used for the live ticker).
- **No multi-day history.** "Today" and "yesterday" are the only two buckets. Don't add `'two-days-ago'` unless you also build the UI to filter it.
- **Schema versioning is in place** (v4 as of the Operator → Hauler rename). `DB_SCHEMA_VERSION` lives at the bottom of `index.html`; `hydrateDb` migrates forward (v1→v2 backfills load/hour dates, v2→v3 seeds `haulRequests`, v3→v4 renames the `operators` collection to `haulers` and the `operatorId` field to `haulerId` on trucks + invoices) and reseeds on a future-version payload. See [[jse-ship-a-feature]] § Persistence semantics.
