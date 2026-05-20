---
name: jse-data-model
description: The `db` shape for Jobsite Exchange. Ten collections, the relationships between them, ID conventions, the ISO date convention on loads + hours, and the frozen `NOW_MIN` / `TODAY_ISO` references.
---

# JSE Data Model

`db` lives in App-level `useState` and persists via `jse_db_v1` localStorage. See [[jse-ship-a-feature]] for persistence semantics.

`db` also carries a single root-level scalar: `activityLastReadAt: number` — the millisecond timestamp of the most-recent activity event the admin has viewed. Used by the sidebar to compute the unread badge. Updated by `AdminActivity` on mount.

## Ten collections

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
| `haulRequests` | `HAUL_REQUESTS_SEED` | `{ id, projectId, materialCode, volumeCY, requestedAt, status, matchedHaulerId?, matchedTruckId?, acceptedByDriver?: driverId \| null, passedBy: string[], notes? }` (added in v3; `acceptedByDriver` + `passedBy` added in v7) |
| `activity` | `ACTIVITY_SEED` | `{ id, type, actorRole, actorId, summary, refId?, timestamp }` (added in v6) |

## Activity events

`db.activity` is an append-only feed of business events. Each event:

- `id` — `'act-' + random5`
- `type` — dotted string, e.g. `load.logged`, `load.approved`, `load.rejected`, `hours.approved`, `shift.started`, `shift.ended`, `invoice.sent`, `project.created`, `hauler.created`, `driver.created`, `truck.created`, `haulRequest.matched`
- `actorRole` — `'driver' | 'hauler' | 'admin'`
- `actorId` — driver/hauler ID, or `null` for admin events
- `summary` — pre-rendered display string (the activity feed doesn't re-derive from refs)
- `refId` — optional ID for click-through routing (load → project, truck → hauler, etc.)
- `timestamp` — `Date.now()` at append time

**Composer:** `appendActivity(state, evt)` — append inside any `setDb` updater that performs a tracked mutation. See [[jse-ship-a-feature]] § Persistence semantics for the pattern.

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

`loads` and `hours` records carry `date: 'YYYY-MM-DD'` — real ISO date strings. The whole demo is anchored to a frozen `TODAY_ISO = '2026-05-19'` so the page produces stable charts regardless of when it's opened. `YESTERDAY_ISO` and `isoDaysAgo(n)` derive everything else.

- Seed loads: ~52 stamped `TODAY_ISO`, ~10 stamped `YESTERDAY_ISO`, ~35 spread across `isoDaysAgo(2)`..`isoDaysAgo(7)` to give the reports bar chart real variance.
- Seed hours: 4 short-haul shifts on `TODAY_ISO`, 20 on `YESTERDAY_ISO`, plus ~10 more spread across days 2-6.
- New loads created via `DriverLogLoad` are stamped `date: TODAY_ISO`.
- New live shifts (clock-in) are stamped `date: TODAY_ISO`.

**Helpers** (defined just above the seeds in `index.html`):
- `isToday(iso)` — equivalent to `iso === TODAY_ISO`.
- `isYesterday(iso)` — equivalent to `iso === YESTERDAY_ISO`.
- `isInRange(iso, startIso, endIso)` — inclusive string compare on ISO dates (sorts lexically because YYYY-MM-DD is ISO 8601).
- `isoDaysAgo(n)` — returns `TODAY_ISO` minus n days as `YYYY-MM-DD`.
- `isoToWeekdayShort(iso)` — `'Mon'`, `'Tue'`, ... for chart axes.
- `isoToShortDate(iso)` — `'May 19'` for headers/tooltips.

**Why:** lets AdminReports filter by arbitrary date ranges (Today / Yesterday / Last 7 days / Last 30 days / Custom) instead of just today-vs-yesterday. Drives the 7-day bar chart + KPI sparklines.

**How to apply:** any new load/hours creation path must include `date: TODAY_ISO`. Any "today" filter is `db.loads.filter(l => isToday(l.date))` (or `l.date === TODAY_ISO`). Any "in range" filter is `db.loads.filter(l => l.date && isInRange(l.date, startIso, endIso))`.

## `NOW_MIN` = 11*60 + 5

The frozen "current time" used by `calcHours` when `clockOut` is null (live shifts). Don't use `new Date()` for shift-duration math — it makes the mockup non-deterministic. Always go through `calcHours(clockIn, breakMin, clockOut)`. Defined in the helpers section of `index.html` right after `TODAY_ISO`.

## Truck `type` codes

`TAN | SD | ED | BD` (Tandem, Side Dump, End Dump, Belly Dump) — keys into `db.rates`. Used by reporting to compute revenue. `TRUCK_TYPES` constant (~`index.html:270`) has the display labels.

## Statuses

| collection | status values |
|---|---|
| `projects.status` | `active`, `upcoming`, `completed` |
| `hours.status` | `open` (live), `pending` (clocked out, awaiting approval), `closed` (approved) |
| `loads.status` | `approved`, `pending` |
| `haulRequests.status` | `pending` (unassigned), `matched` (hauler + truck assigned by admin), `accepted` (driver opted in), `completed` (delivered) |
| (truck) | `inservice` / `idle` — derived, not stored. `inservice` = has an open shift on this truck. |

See [[jse-design-system]] for how each status maps to a color/pill.

## What's NOT in the data model

- **No `users` collection.** Driver/hauler/admin "identity" is just a UI shell selection.
- **No auth.**
- **No real timestamps** (other than `clockedInAt`/`pausedAt`/`pausedMs` on live shifts, used for the live ticker).
- **Schema versioning is in place** (v7 as of the driver accept/pass flow). `DB_SCHEMA_VERSION` lives at the bottom of `index.html`; `hydrateDb` migrates forward (v1→v2 backfills load/hour dates, v2→v3 seeds `haulRequests`, v3→v4 renames the `operators` collection to `haulers` and the `operatorId` field to `haulerId` on trucks + invoices, v4→v5 converts load/hours `date` from `'today'`/`'yesterday'` labels to ISO date strings, v5→v6 seeds `activity` and `activityLastReadAt`, v6→v7 backfills `acceptedByDriver: null` + `passedBy: []` on every haul request and introduces the `accepted` status value) and reseeds on a future-version payload. See [[jse-ship-a-feature]] § Persistence semantics.
