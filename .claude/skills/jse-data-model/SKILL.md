---
name: jse-data-model
description: The `db` shape for Jobsite Exchange. Ten collections, relationships, ID conventions, ISO date convention on loads + hours, frozen NOW_MIN / TODAY_ISO references.
---

# JSE Data Model

`db` lives in App-level `useState` and persists via `jse_db_v1` localStorage. Single root scalar: `activityLastReadAt: number` — timestamp of most-recent activity event viewed (drives sidebar unread badge).

## Ten collections

| key | seed | shape |
|---|---|---|
| `projects` | `PROJECTS_SEED` | `{ id, code, name, gc, address, startDate, status, material: [] }` |
| `haulers` | `HAULERS_SEED` | `{ id, name, phone, email, projectIds: [], company?, attachments: [{ id, type: 'w9'\|'insurance'\|'msa'\|'other', filename, uploadedAt }] }` |
| `drivers` | `DRIVERS_SEED` | `{ id, name, phone, licenseNumber? }` |
| `trucks` | `TRUCKS_SEED` | `{ id, plate, type, hauler, projectId, haulerId, driverId?, make?, model?, capacityCY? }` |
| `hours` | `HOURS_SEED` | `{ id, driverId, truckId, projectId, clockIn, clockOut?, breakMin, status, date }` |
| `loads` | `LOADS_SEED` | `{ id, driverId, truckId, projectId, material, cy, ticketNo?, time, date, status }` |
| `invoices` | `INVOICES_SEED` | `{ id, haulerId, projectId, number, periodStart, periodEnd, issuedDate, billTo, status, createdAt, sentAt?, paidAt?, paymentRef?, lineItems: [], loadCount, totalCY, notes }` |
| `rates` | `RATES_INIT` | `{ [truckType]: hourlyRate }` |
| `haulRequests` | `HAUL_REQUESTS_SEED` | `{ id, projectId, materialCode, volumeCY, requestedAt, status, matchedHaulerId?, matchedTruckId?, acceptedByDriver?, passedBy: [], notes?, assignments: [...], pickupLocation: { name, address }, dropoffLocation: { name, address }, timing: { startDate, endDate }, siteAccess: { loading: { notes, equipment }, dumping: { notes, equipment } } }` |
| `activity` | `ACTIVITY_SEED` | `{ id, type, actorRole, actorId, summary, refId?, timestamp }` |

## Relationships

```
Project ─< Hauler (hauler.projectIds[])
        ─< Truck (truck.projectId)
        ─< Load/Hours (.projectId)
        ─< HaulRequest (.projectId)
Hauler ─< Truck (truck.haulerId)
       ─< Invoice (invoice.haulerId)
HaulRequest ── Hauler (matchedHaulerId, nullable)
           ── Truck (matchedTruckId, nullable)
Truck ── Driver (truck.driverId, nullable)
      ─< Load/Hours (.truckId)
Driver ─< Load/Hours (.driverId)
Load.material / HaulRequest.materialCode → MATERIALS[].code (CF/TS/CR/EX/SD/GR/CO/AC/RR/MU)
Truck.type → rates[code]   (TAN/SD/ED/BD)
```

**Driver can have multiple trucks today.** DriverShell branches on `db.trucks.filter(t => t.driverId === drId).length` (0 → NoTruck, 1 → DriverHome, >1 → DriverMultiTruckHome).

## ID conventions

- **Projects** — 2-4 char uppercase code (`WP`, `RR`, `ATP`). ID === code. The separate `code` field is a display string like `'WP-24'`.
- **Haulers/trucks/drivers/loads** — `'<prefix>-' + Math.random().toString(36).substring(2, 7)`. Prefixes: `op-` (legacy, retained for hauler migration), `tk-`, `dr-`, `ld-`. Seeds use sequential numbering.
- **Hours** — `'hr-' + random5`.
- **Activity** — `'act-' + random5`.

## ISO date convention

`loads.date` and `hours.date` are real ISO strings (`'2026-05-19'`). Anchored to frozen `TODAY_ISO = '2026-05-19'`. `YESTERDAY_ISO` and `isoDaysAgo(n)` derive everything else.

Helpers (Block 1 of `index.html`, right above the seeds):
- `isToday(iso)`, `isYesterday(iso)`, `isInRange(iso, startIso, endIso)` (inclusive, lexical string compare works because YYYY-MM-DD sorts correctly).
- `isoDaysAgo(n)` — returns `TODAY_ISO` minus n days.
- `isoToWeekdayShort(iso)` / `isoToShortDate(iso)` — display helpers for charts/headers.

New loads via `DriverLogLoad` stamp `date: TODAY_ISO`. New live shifts stamp `date: TODAY_ISO`. Reports filters by `isInRange` for any window. See [[jse-charts]].

## `NOW_MIN` = `11*60 + 5`

Frozen "current time" used by `calcHours` when `clockOut` is null. Don't use `new Date()` for shift duration math — non-deterministic. Always go through `calcHours(clockIn, breakMin, clockOut)`.

## Statuses

| collection | values |
|---|---|
| `projects.status` | `active`, `upcoming`, `completed` |
| `hours.status` | `open`, `pending`, `closed` |
| `loads.status` | `approved`, `pending` |
| `haulRequests.status` | `pending`, `matched`, `accepted`, `completed` |
| (truck, derived) | `inservice` (has open shift) / `idle` |

State machine for haul requests: `pending → matched` (admin assigns hauler+truck) `→ accepted` (driver opts in via [[jse-realtime]]'s [[jse-activity-feed]]-instrumented accept) `→ completed`. `passedBy[]` tracks drivers who declined; request stays pending.

## `haulRequests.assignments[]` (v8)

The source of truth for multi-truck per-request execution. Each entry tracks one truck's day-by-day load list:

```
assignments: [
  { truckId: 'tk-301', haulerId: 'op-002', addedAt: <ms epoch>,
    days: [
      { date: '2026-05-19', startTime: '09:50',
        loads: [{ id: 'hreq-load-xxxxx', time: '10:15', cy: 9 }, ...] },
      { date: '2026-05-20', startTime: '07:30', loads: [] },
    ] },
  ...
]
```

Legacy `matchedHaulerId` / `matchedTruckId` are preserved for backward compat but are no longer the primary key — `assignments[0]` is the first truck assigned, and a request can have N. The v7 → v8 migration synthesizes a one-truck, one-day, zero-loads `assignments` from `matchedTruckId` for old payloads. Completion percent is `sum(all loads.cy) / volumeCY`, rendered by `Donut` ([[jse-charts]]).

See [[jse-design-system]] § Status color story.

## Activity event vocabulary

See [[jse-activity-feed]] for the full type list + `appendActivity` composer.

## Schema version log

| Version | What changed |
|---|---|
| v1 → v2 | Backfilled missing `date` on loads/hours (started as `'yesterday'`, now ISO via v4→v5) |
| v2 → v3 | Added `haulRequests` collection |
| v3 → v4 | Renamed `operators` → `haulers`, `operatorId` → `haulerId` on trucks + invoices |
| v4 → v5 | `loads.date` / `hours.date` from `'today'`/`'yesterday'` labels → ISO strings |
| v5 → v6 | Added `activity` collection + `activityLastReadAt` scalar |
| v6 → v7 | Added `acceptedByDriver` + `passedBy` to every haul request; new `accepted` status |
| v7 → v8 | Added `assignments[]` to every haul request — multi-truck, multi-day, per-truck load lists. Legacy `matchedTruckId` synthesizes a one-truck zero-loads assignment for old payloads. |
| v8 → v9 | Backfilled `attachments: []` on every hauler (W-9, Insurance, MSA, Other docs). Backfilled missing `rates` keys from TRUCK_TYPES defaults (e.g. HS at $140). |
| v9 → v10 | Restored seeded attachments by hauler id (v8→v9 over-blanked them). Bumped rates whose stored value still matches a `RATES_PREV_DEFAULTS` entry but not the current TRUCK_TYPES default — preserves user edits, refreshes unedited defaults. |
| v10 → v11 | Added `status` / `createdAt` / `sentAt` / `paidAt` / `paymentRef` to invoices. Backfilled `status: 'sent'` and `createdAt: issuedDate+T09:00:00Z` for stale payloads (defaults-first spread so existing fields win). When migrated status is `'sent'` or `'paid'` and `sentAt` is missing, synthesizes it from `issuedDate+T15:00:00Z`. `paidAt` / `paymentRef` are never backfilled blindly. |
| v11 → v12 | Added `pickupLocation` / `dropoffLocation` / `timing` / `siteAccess` to every haul request. Defaults-first nested spread so existing values win and partial pre-v12 payloads complete their nested shapes (`siteAccess.loading.notes`, etc.). `EMPTY_LOGISTICS` mirrors the migration defaults for new seed rows. |

`DB_SCHEMA_VERSION = 12`. See [[jse-ship-a-feature]] § Schema migration for how to bump.

## What's NOT in the model

No `users`, no auth, no real timestamps (other than `clockedInAt`/`pausedAt`/`pausedMs` on live shifts), no real geo. Driver/hauler/admin "identity" is just UI shell selection.

## Cross-refs

[[jse-design-system]] · [[jse-routing]] · [[jse-realtime]] · [[jse-wizards]] · [[jse-charts]] · [[jse-activity-feed]] · [[jse-ship-a-feature]]
