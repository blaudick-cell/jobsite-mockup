# Phase 4 C1 — Data-flow audit (mockup `db.loads` / `db.hours` / `db.activity` vs driver-side tables)

Generated 2026-05-29. File audited: `index.html` @ 15,644 lines.

Helpers cited verbatim from the May 24 value-source audit:
`deliveredCYForRequest` (line 2491), `totalBilledHoursForRequest` (line 2468),
`dollarsForRequest` (line 2508), `assignedTruckCountForRequest` (line 2572),
`haulerRollupV31` (line 2541). Line numbers drifted by ~30-90 since
that audit; all citations below are current.

**Important context the user should know before reading C2/C3 plans:**
The May 25 driver-UI elimination report (`outputs/driver-ui-elimination-report.md`)
declared `AdminActiveTrucks`, `DriverShell`, `DriverHome`, `DriverLogLoad`,
`DriverTruckDetail`, `DriverMultiTruckHome`, `DriverNoTruck`,
`DriverIncomingRequests`, `MiniPhone`, and `AdminNewDriver` deleted. They
are all back in the file. The router still serves `/driver`,
`/admin/trucks/active`, and `/admin/drivers/new`. The "MiniPhone embed of
DriverHome inside AdminActiveTrucks" pattern noted as the integration
target is the same one the elimination report removed and Robert then
restored. C2 must decide whether to keep that pattern or excise it
again — see Section F.

---

## Section A — Read sites for `db.loads`

48 reads in the file. Grouped by component.

### A1. `AdminReports` (line 6014 — `/admin/reports`)
Range-scoped KPIs + sparklines + project rows + hauler rows + truck rows.

| line | reads | meaning | driver-table swap |
|---|---|---|---|
| 6043 | `db.loads.filter(date in range)` | "loadsCount" KPI + sparkline | `truck_events.event_type='pickup_load'` in range (full pickup→dropoff cycle ambiguity flagged — see below) |
| 6069 | same, prior window | delta % | same, prior window |
| 6092 | per-day count last 7 days | bar chart | `truck_events.event_type='pickup_load'` grouped by day |
| 6105 | per-project loads-in-range | project row | NO equivalent — driver tables have no `projectId` (only `job_id` on `driver_sessions`). Flag: per-project rollups need a `job_id → project` mapping we don't have yet |
| 6171 | per-hauler loads-in-range | hauler row | `truck_events` joined via `driver_sessions.matched_truck_id → trucks.haulerId` |
| 6192 | per-truck loads-in-range | truck utilization | `truck_events` joined via `driver_sessions.matched_truck_id` |

**"Load" ambiguity:** every count here treats a `db.loads` row as a single
load event. The driver tables emit a `pickup_load` and a `dropoff_load`
event per cycle. C2 must pick a definition. Recommend: count
`event_type='pickup_load'` to match the mockup's "one row = one bucket
loaded" semantic — drop-offs are the same load, not a second load.

### A2. `AdminHaulers` (line 9217 — `/admin/haulers`)
Hauler list cards + KPI strip.

| line | reads | meaning | swap |
|---|---|---|---|
| 9234 | `loads.filter(status='approved' && date=TODAY_ISO)` | `todayLoads` base set | `truck_events.event_type='pickup_load' && event_at::date = today`. **Drop `status='approved'`** — driver events have no status |
| 9246 | `todayLoads.filter(truckIds.has(l.truckId))` | per-hauler `completedToday` | join through `driver_sessions.matched_truck_id → trucks.haulerId` |
| 9247 | same, sum cy | per-hauler `cyToday` | CY-per-truck-type lookup × pickup_load count |
| 9264 | per-project `loads.filter(projectId)` | "delayed project" health flag | needs `job_id → project` map (see A1 flag) |
| 9378 | inner loop, same as 9264 | FleetMiniViz dot color | same |

### A3. `AdminHaulerDetail` (line 9704 — `/admin/haulers/:id`)
`haulerRollupV31` covers the headline cards. Direct reads only at:

| line | reads | meaning | swap |
|---|---|---|---|
| 9721 | `loads.filter(truckIds.has(l.truckId))` | scoping (used downstream, not displayed directly per the canonical-rollup migration note at 9737-9750) | sessions+events filtered by `driver_sessions.matched_truck_id` IN hauler's trucks |

### A4. `AdminHaulRequestDetail` (line 7438 — `/admin/requests/:id`)
Per-haul detail page. Heavy `db.loads` usage. All scoped by `haulRequestId`.

| line | reads | meaning | swap |
|---|---|---|---|
| 7752 | `loads.find(id===photoFor)` | photo lightbox | `event_photos.photo_url` (sessions+events have first-photo on the event; the lightbox can also read `event_photos` rows) |
| 7776 | `loads.filter(haulRequestId===req.id && truckId)` | `loadsOnTruck` confirm-prompt count | needs a `truck_events.job_id` or equivalent — driver tables only have session-level `job_id`, NOT event-level. Flag: per-haul-request scoping doesn't pass through cleanly. C2 must either (a) decide all events on a session belong to its `job_id` or (b) add a `job_id` per truck event |
| 7801 | same + `date` | day-level count | same flag |
| 7840 | per-truck loads → cy sum | invoice line-item `deliveredCY` (informational) | CY constants × pickup_load count, scoped same way |
| 7886 | count loads on req | invoice `loadCount` field | pickup_load count where session.job_id === req.id |
| 8550 | same per-truck CY sum (rendered in HaulOperationalCard footer) | per-truck rollup | same |
| 8733 | per-(req,truck,date) load rows | day-row table | same |
| 8806 | photo path | per-day photo grid | `event_photos` |

### A5. `AdminInvoiceDetail` / `AdminReporting` invoice generators (10262, 10283, 10327, 14579, 15172)
All write paths reading `loads` to build invoice line items. Same scope as A4. These are **secondary** — they're driven by deliveredCYForRequest and don't need separate plumbing if A4 is solved.

### A6. `HaulerHome` (line 12453 — `/hauler/o/:id`)
Self-serve hauler dashboard.

| line | reads | meaning | swap |
|---|---|---|---|
| 12482 | `loads.filter(myTruckIds.has(truckId))` sorted, slice(0,8) | "Recent loads" table | `truck_events.event_type='pickup_load'` joined via session.matched_truck_id, ordered by event_at DESC |
| 12605 | `loadsForReqTruck` helper | per-truck load count chip on active assignments | sessions+events scoped same way |
| 12706 | per-req sum cy | `deliveredCY` shown on active-assignment card | CY constants × pickup_load count |

### A7. `HaulerProject` (line 12856 — `/hauler/o/:id/p/:projId`)
Per-project rollup.

| line | reads | meaning | swap |
|---|---|---|---|
| 12864 | `loads.filter(truckIds.has)` | scoping | sessions+events filtered by hauler's trucks |
| 12866 | `filter(status='approved').reduce(cy)` | "Total CY" stat card | sum of CY-per-truck-type over pickup_load events |
| 12868 | `filter(status='pending').length` | "Pending loads" KPI | **DELETE** — driver events have no pending/approved status |

### A8. `HaulerTruckView` (line 12949 — admin and hauler views of a single truck)
Same fields as the haul-detail per-truck panel but truck-scoped instead of (truck,req)-scoped.

| line | reads | meaning | swap |
|---|---|---|---|
| 12970 | `loads.filter(truckId===truckId)` | base truck loads | `truck_events` via `driver_sessions.matched_truck_id` |
| 13014 | `find(id===id)` | confirm-delete prompt | n/a (write path — see Section E) |
| 13080 | photo lightbox | photo viewer | `event_photos` |

### A9. Driver UI (still in the file)
`DriverHome` line 14360, `DriverMultiTruckHome` 14904+14925, `DriverTruckDetail` 15000, `DriverLogLoad` 14716+14719, `AdminActivity` 11566.

These read `loads` filtered by `driverId` + truck + isToday(date). Per Section F they SHOULD all become irrelevant when the trucker widget that runs at `/driver` is replaced by the real field widget (which now writes directly to Supabase, not to `db.loads`).

### A10. AdminBackup / Reporting placeholders (line 10240)
`(db.loads || []).filter(status='approved').reduce(cy)` — "tonnage hauled" stat card. Swap to sum-of-CY over all `truck_events.event_type='pickup_load'`. Drop the `'approved'` gate.

### A11. AdminProjects placeholder (line 13837-13838)
`loadCount` / `totalCY` — this is inside a dead-code path that the May 25 Projects-drop commit nominally eliminated. Confirm before C2 whether anything still calls it; if not, delete in C3.

### A12. Status filtering — call out
`l.status === 'approved'` appears at: 9234, 9265, 9379, 10240, 12866, 12868, 13091, 13837, 13838, 14360+14904 (driver isToday filters), 9234 (HaulerLanding), 14360 (DriverHome ticker).
`l.status === 'pending'` appears at: 9265, 9379, 12868, 13083.

**There is no `status` column on `truck_events`.** Every site filtering by status either becomes "always true" (drop the filter, driver-logged events are real by definition) or becomes a new admin-side concept layered on top — most likely the former. Robert call: confirm we drop status entirely.

---

## Section B — Read sites for `db.hours`

42 reads. Grouped by component.

### B1. `AdminReports` (6014)
| line | reads | meaning | swap |
|---|---|---|---|
| 6033 | `db.hours.filter(status='open')` | "On shift now" KPI | `driver_sessions where ended_at IS NULL` |
| 6044 | range-scoped hours | "hoursTotal" KPI | per-(session) duration = (ended_at OR last truck_event.event_at OR now) − started_at, summed over sessions whose started_at falls in range |
| 6094 | per-day hours-summed | sparkline | same, grouped by started_at::date |
| 6172 | per-hauler hours-in-range | hauler row | sessions joined via matched_truck_id → trucks.haulerId |
| 6195 | per-truck `status='open'` flag | "inservice" col in truck table | sessions where matched_truck_id===truck.id AND ended_at IS NULL |

### B2. `AdminHaulers` (9217)
| line | reads | meaning | swap |
|---|---|---|---|
| 9238 | `hours.filter(truckIds.has && status='open')` | per-hauler active-truck count | sessions where matched_truck_id IN hauler.trucks AND ended_at IS NULL |
| 9244 | `openShifts.map(h.projectId)` | "active hauls" KPI (distinct projects) | flag — session has `job_id` (haul request), no `projectId`; needs job→project map |
| 9307 | global `hours.some(truckId,status='open')` | "Trucks active" KPI (F2 from May 24 audit) | sessions filtered by truck IN realTrucks AND ended_at IS NULL |

### B3. `AdminHaulerDetail` (9704)
| line | reads | meaning | swap |
|---|---|---|---|
| 9720 | `hours.filter(truckIds.has)` | scoped (used by haulerRollupV31 downstream) | sessions filtered same way |
| 9992 | inline `hours.some(truckId, status='open')` | "Trucks active now" sub-stat under "Trucks" card | same as B2 9307 |

### B4. `AdminHaulRequestDetail` (7438)
| line | reads | meaning | swap |
|---|---|---|---|
| 7697 | `hours.find(haulRequestId,truckId,date)` | upsert lookup before patching | n/a — admin-side write (Section E) |
| 7711 | `hours.map(id===existingHr.id)` | hours-row patch | same |
| 7728 | `hours: [...prev.hours, newHr]` | new-row insert | same |
| 7793 | `filter(haulRequestId !==req.id ...)` | cascade on truck-remove | same |
| 7817 | same | cascade on day-remove | same |
| 7855 | `hours.filter(haulRequestId,truckId)` | per-truck invoice line-item hours sum | session-duration sum over sessions where matched_truck_id===a.truckId AND session.job_id===req.id |
| 8559 | same as 7855 | per-truck rollup card footer | same |
| 8734 | per-(req,truck,date) row | day-row chip | same |
| 9030 | same | settlement-statement builder | same |

### B5. `HaulerHome` / `HaulerProject` / `HaulerTruckView`
12863 (`HaulerProject` — sum of calcHours for cards), 12867 (active-trucks count), 12971 (`HaulerTruckView` truck-scoped hours rows), 13029 (insert new hours row — write).

### B6. `AdminActiveTrucks` (11366)
`(db.hours || []).filter(status='open')` then maps to per-truck. This drives the "Active right now / Paused / Idle" KPIs and which mini-phone widgets appear with which badge. Direct swap: `driver_sessions where ended_at IS NULL`. `pausedAt` is a mockup-only field — there's no pause concept in the driver tables, so the Paused KPI either drops or maps to something new.

### B7. Driver UI (still in file)
14359, 14905, 14922, 14997 — all do `hours.find(truckId, driverId, status='open')`. They drive the clock-in / clock-out / pause / quick-log buttons. Per F, these become moot.

### B8. Truck-day-row hour editors — DELETE candidates (Section E)
HaulerTruckView at lines 13290-13325 + 13042 ("add hours row" button + per-row clockIn/clockOut/breakMin editors + "× delete row" button) — these are exactly the kind of admin-side manual hour entry that the scope says should go away. Same on AdminHaulRequestDetail day-row chip at line 8732+.

---

## Section C — Read sites for `db.activity`

Only 5 reads — the feed is one component plus a sidebar badge.

| line | component | reads |
|---|---|---|
| 6597 | `AdminHaulRequests` dispatch-board feed (right-side recent-events strip, top 8) | `(db.activity).sort.slice(0,8)` |
| 11534-11538 | `AdminActivity` main feed at `/admin/activity` | full sort + group-by-day |
| 12149-12151 | `AdminSidebar` unread badge | `filter(timestamp > lastRead).length` |
| 14323 | `DriverHome` `isEdited` check | `activity.some(type='load.edited' && refId===load.id)` |

### Activity row types currently emitted

(grepped on `type:` in setDb composers — counts of distinct types)

| Type | Where emitted | Keep / drop |
|---|---|---|
| `load.logged` | 13540 (HaulerLogLoadForm), 14410 (DriverHome quick-log), 14744 (DriverLogLoad), 15044 (DriverMultiTruckHome) | **Becomes redundant** with `truck_events.event_type='pickup_load'`. Replace at the render layer. |
| `load.removed` / `load.edited` / `load.approved` / `load.rejected` | 13019, 14228, 13715, 13728 | Admin-side mutation tracking. KEEP (these aren't drivers — they're admin/hauler edits). |
| `shift.started` / `shift.ended` | 14480, 14528, 15093, 15122 | **Becomes redundant** with `driver_sessions.started_at` / `ended_at`. Replace at the render layer. |
| `hours.approved` / `hours.added` | 13743, 13055 | Admin-side mutation tracking. KEEP. |
| `haul_request.created` / `.updated` / `.deleted` | 6975, 7522, 7551 | Admin actions. KEEP. |
| `haulRequest.matched` / `.acceptedByHauler` / `.declinedByHauler` / `.truckAdded` | 2646, 12532, 12560, 7605 | Admin/hauler state machine. KEEP. |
| `hauler.created` / `.deleted` | 5389, 9798 | Admin actions. KEEP. |
| `truck.created` | 5664 | KEEP. |
| `driver.created` | 5556 (inside AdminNewDriver — orphan, no path to invoke it) | DELETE the emitter (Section E). |
| `invoice.drafted` / `.sent` / `.paid` / `.deleted` | 7896, 10336, 10353, 10374, 10642, 10666, 10682, 10720, 10915, 10938, 12524 | Admin actions. KEEP. |
| `project.created` / `.updated` | 2660, 7538 | Admin actions. KEEP. |

**Bottom line for the feed:** every `load.logged` / `shift.started` /
`shift.ended` row becomes a duplicate once we blend in `truck_events`.
Either (a) stop emitting them from the admin/hauler write paths (the
field widget is the source now), or (b) keep emitting but tag them
"echo" and have the render layer dedupe against the corresponding
truck_event. Recommend (a) — simpler, no dedup state to maintain.

Drop the `load.logged` emitter from HaulerLogLoadForm (13537-13546) too,
since `HaulerLogLoadForm` lets a hauler manually log a load on someone
else's behalf — that path also becomes obsolete (see Section E).

---

## Section D — Other mock data with driver-side equivalents

### `db.drivers`
**Still in active use**, even though the May 25 elimination report claimed
the UI was scrubbed. Re-added since. Reads at lines 6193, 7839, 10282,
11375 (AdminActiveTrucks), 12737, 12771, 12968 (HaulerTruckView header),
13292 (HaulerTruckView day-row driver-name span), 13738 (settlement),
13825, 14065 (DriverShell). The driver UI itself is back — every
embedded MiniPhone widget in AdminActiveTrucks needs a `db.drivers[id]`
lookup to render the name on the eyebrow ("Marcus Lane · #447").

**Decision needed:** the driver tables have `driver_sessions.driver_name`
as a free-text field (the field widget collects it). They do NOT carry
the mockup's `dr-001` IDs. We can either:
- Map `truck.driverId → db.drivers[id].name → driver_sessions.driver_name`
  (one-way: mockup → real)
- Drop `db.drivers` and have any "who's driving" UI read
  `driver_sessions.driver_name` directly

The right answer probably depends on whether dispatch wants to keep the
"assign Marcus Lane to truck #447" affordance — if yes, `db.drivers`
stays; if no, drop.

### `truck.driverId`
Used in 9 places to look up the driver. Same decision: stays if we keep
admin-assignment of drivers to trucks; goes otherwise.

### `db.geocode` / `db.routes`
Searched — 72 references to `db.trucks` alone but `db.geocode` /
`db.routes` are orthogonal to driver data. They feed the live-ops map
pickup/dropoff pins (lines 4779-5252+). **Confirmed out of scope for
Phase 4.**

### `db.haulRequests.assignments[].days[]` (the day-skeleton)
This is a hairy one. The detail page builds an empty `{date,startTime,hours,loads:[]}` skeleton per (truck, day) which the admin
uses to "add a day to this truck on this haul." `d.hours` overrides
`db.hours` row totals (see line 7855 / 10286 / 8728 comments). If
admin-side day-row hour entry goes away (Section E), the `d.hours`
override field can go too — the skeleton itself stays only as long as
admin still wants to pre-create future days.

---

## Section E — Admin-side data-entry forms that become obsolete

### E1. `HaulerLogLoadForm` (line 13497)
Embedded at bottom of every `HaulerTruckView` page. Lets the hauler
(or admin viewing-as-hauler) type a load by hand — material / CY /
ticketNo / time. Submits to `db.loads` and emits a `load.logged` activity
event. **DELETE** — drivers log loads via the widget now. (Note: the form
is still useful as a fallback for "driver forgot to log it" — flag this
to Robert before deletion. If kept, it should write to `truck_events`
through a new admin write path, not to `db.loads`.)

### E2. `AdminHaulRequestDetail` "Add Load" inline form
Lines 7615-7656 (`addLoad` + the row that owns `addLoadForm`) — admin
adds a load on a specific (truck, day) row by typing time + CY into the
chip. **DELETE** — same reasoning.

### E3. Per-truck day-row hour editor (`HaulerTruckView`)
Lines 13289-13325 + 13041-13066 ("+ Log hours →" / "+ Add hours row").
Lets admin/hauler enter clockIn/clockOut/breakMin/status by hand.
**DELETE** — sessions are the truth.

### E4. Per-haul day-row hour chip (`AdminHaulRequestDetail`)
Line 7679-7729 (`updateDay` patch path with `'hours' in patch`). Admin
enters a flat hour total into the day-row chip, which upserts a
`db.hours` row. **DELETE** — but check first whether the `d.hours`
override mechanic is still used downstream for adjustments. If yes,
keep the field, drop the editor (only the value, not the input).

### E5. `AdminNewDriver` wizard (line 5524)
**ORPHAN.** Route exists at line 12368 but no link to it (the "+ Add
driver" button was scrubbed). Either delete the component + route, or
re-link it from `AdminHaulerDetail` if dispatch still wants to add
mockup drivers by hand. Recommend delete; drivers come in via the
field widget.

### E6. Approve/reject load buttons
Searched — `load.approved` / `load.rejected` emitters at lines 13715,
13728. These are read inside `HaulerTruckView` (the per-load
`EditableSelect status` at line 13356, options at 13082-13085). Since
driver events have no status, these UI affordances also become moot.
**DELETE** the status `<select>` (and the two emitters); the per-load
row becomes a read-only event record with photo + CY + time + material.

### E7. "Mark hours approved"
Line 13743 + the hours-row `EditableSelect status` at 13304. Same
reasoning. **DELETE** the status column from the hours-row editor (and
its emitter), since hours rows themselves are going away in E3-E4.

### E8. Load photo replace/upload on the admin side
Lines 7745, 13072 (`onPickReplacePhoto`). Two photo-replacement modals
(one in haul-detail, one in HaulerTruckView). Drivers upload via the
widget; `event_photos` rows are the truth. **DELETE the writes**, keep
the lightbox as read-only (point at `event_photos.photo_url`).

---

## Section F — `AdminActiveTrucks` deep-dive

Component at **line 11360**, route at **line 12367** (`/admin/trucks/active`).

### What it reads today
- `db.haulers` (line 11364) — to filter out trucks with orphan haulerId
- `db.trucks` (11365) — all hauler-owned trucks
- `db.hours.filter(status='open')` (11366) — open shifts
- `db.drivers.find(id===t.driverId)` (11375) — name on each tile's eyebrow

### Rendered shape
1. **Crumbs + page header** (11398-11405) — "Active Trucks · What every driver sees, right now."
2. **4-card KPI strip** (11407-11412): Active right now / Paused / Idle (driver assigned) / Benched trucks
3. **Mini-phone grid** (11419-11450) — `auto-fill, minmax(296px,1fr)` grid. Each tile is a `MiniPhone` (320×600 phone frame, line 11306) wrapping `DriverHome` (single truck) or `DriverTruckDetail` (multi-truck driver). Tile header: driver name + truck plate + status badge ("On the clock" / "Paused" / "Idle"). Tile is clickable — routes to `/admin/p/:projId/o/:haulerId/t/:truckId` (HaulerTruckView in admin viewer mode).
4. **"Benched trucks" table** (11455-11478) — trucks with `!t.driverId`. Plate / type / rate / hauler / haul / "Assign driver" CTA.
5. **Log-load modal** (11481-11526) — opened from inside an embedded widget via `onOpenLogLoad`; renders `DriverLogLoad` in a centered overlay.

### Aggregations that need replacement

| Today's KPI | New source |
|---|---|
| "Active right now" (active=clocked-in, not paused) | `count(driver_sessions where ended_at IS NULL)` |
| "Paused" | DROP — no pause concept on driver tables |
| "Idle (driver assigned)" | Mockup-only — depends on whether `truck.driverId` stays. If yes: `count(trucks where driverId AND NOT EXISTS session with matched_truck_id === truck.id AND ended_at IS NULL)`. If no: drop the KPI. |
| "Benched trucks" | `count(trucks where !driverId)` — purely a mockup concept. Stays if `truck.driverId` stays. |

Per-tile derivation under new source:
- Driver name → `driver_sessions.driver_name` (string) — replaces `db.drivers[id].name`
- Truck plate → already on the mockup `truck` record; cross-ref via `driver_sessions.matched_truck_id`
- Status badge → `ended_at IS NULL` → "On shift" / `IS NOT NULL` → "Off shift" (no "Paused" tier)
- "Last clock-in time" (currently from `hr.clockedInAt` inside DriverHome) → `driver_sessions.started_at`
- "CY today" / "Loads today" (DriverHome interior) → derive from `truck_events` on this session

### Notable styling to preserve
- `MiniPhone` 320-wide phone-bezel wrapper (line 11306) with notch, "11:05 5G" status strip, 32px border-radius outer + 26px inner. **Keep verbatim** — the user has spent effort on this aesthetic.
- Status pill colors: `C.accent` (active) / `C.warn` (paused) / `C.inkDim` (idle). Paused color goes away.
- `Stat` cards with sub-text on the KPI strip — standard JSE pattern.
- Benched-trucks table layout (Th / Td / Pill).

### Write paths (Section E candidates)
- Tile-clicked log-load modal (`setLogFor` at 11444-11445, modal body 11514) — admin-on-behalf logging. Lives inside the embedded `DriverLogLoad`. Per E1/E2, this becomes obsolete; the modal either goes away entirely or is repurposed as a read-only "session details" drawer.
- Tile is also a navigation handle (line 11436-11440) — purely read-only, **KEEP**.

### Recommended C2 integration shape
1. Replace `db.hours` reads with a Supabase live subscription on `driver_sessions` (filter `ended_at IS NULL`) held in a separate context (per the scope's "isolated subscription, never via hydrateDb" requirement).
2. Replace `db.drivers` name lookup with `session.driver_name`.
3. Cross-reference `session.matched_truck_id` to the mockup `db.trucks` collection to render plate / type / hauler / rate. (Trucks ARE still admin-controlled in the mockup.)
4. Embedded `DriverHome` / `DriverTruckDetail` widgets — DROP. Replace with a compact session card that shows: driver name, plate, started_at, elapsed, last event, CY-today, photo count. Click expands a drawer with the full event timeline read from `truck_events` (the same drawer pattern the field-side widget already uses).

---

## Section G — Other surfaces affected by the integration

### Loads view
There's no dedicated `/admin/loads` route. Loads are rendered inline on:
1. `HaulerTruckView` day-row tables (line 13332+) — main per-truck view.
2. `AdminHaulRequestDetail` day-row tables (line 8728+) — per-haul view.
3. `HaulerHome` "Recent loads" card (line 12800+).
4. `AdminInvoiceDetail` line items via inv.lineItems.

C2: each becomes a read of `truck_events.event_type='pickup_load'` filtered the relevant way. The status `<select>` and the `× delete` button on each row go away (per Section E). Photo column maps to `event_photos.photo_url`. C3: delete the inline-edit forms.

### Hours view
Also no dedicated route. Hours rows render:
1. `HaulerTruckView` per-day chip + editable rows (line 13289+) — DELETE the editors per Section E.
2. `AdminHaulRequestDetail` day-row chip (line 8728+) — DELETE the editor.
3. Sidebar / KPI counts of "trucks on shift" (multiple sites — see Section B).

C2: KPI sites read `driver_sessions`. C3: delete the row editors.

### Haul Requests admin
`AdminHaulRequestDetail` (line 7438). Two big things change:
- Per-truck CY / hours rollups (line 7855, 8550, 8559) read driver events instead of `db.loads` / `db.hours`. The canonical helpers (`deliveredCYForRequest`, `totalBilledHoursForRequest`, `dollarsForRequest`) become the swap point — if those three helpers point at the driver tables, the whole page's rollup chain re-flows correctly.
- Day skeleton (`assignments[].days[]`) and add-load / add-day forms go away (Section E2/E4). The page becomes more read-only.

The dispatch list (`AdminHaulRequests` at 6463) only reads aggregates through the same three helpers, so it auto-fixes via the same redirect.

### Activity feed
`AdminActivity` (11537). Per Section C: most rows survive (admin/hauler/invoice/state-machine events). The `load.logged` / `shift.started` / `shift.ended` rows stop being emitted from the mockup write paths and instead get synthesized from the new driver subscription. Alternative: leave the feed as it is and add a separate "Live trucker activity" pane that reads `truck_events` directly.

---

## Section H — Summary table

| Concept | Current source | New source | Components affected | C2 or C3 |
|---|---|---|---|---|
| Loads logged today (count) | `db.loads.filter(date=today)` | `truck_events where event_type='pickup_load' && event_at::date=today` | AdminReports, AdminHaulers, HaulerHome, HaulerProject, HaulerTruckView, AdminHaulRequestDetail | C2 |
| CY delivered (today / per-haul / per-hauler) | `sum(db.loads.cy)` | `count(pickup_load events) × CY_PER_TRUCK_TYPE[truck.type]` | every site above + AdminReporting, invoice generators (`deliveredCYForRequest` helper @ line 2491) | C2 |
| Load status (approved/pending) | `db.loads.status` | **DROP** — no equivalent | filters at 9234, 9265, 9379, 10240, 12866, 12868, 13083, 13838, status `<select>` at 13356 | **C3** (delete UI) |
| Hours worked (per-day, per-truck, per-haul) | `calcHours(db.hours[i])` | session duration = (ended_at OR last truck_event.event_at OR now) − started_at | AdminReports KPIs + sparkline, AdminHaulers, AdminHaulerDetail, HaulerProject, HaulerTruckView, AdminHaulRequestDetail (incl. invoice gen) | C2 |
| "On shift now" / "Trucks active" | `db.hours.filter(status='open')` | `driver_sessions where ended_at IS NULL` | AdminReports (6033), AdminHaulers KPI (9307), AdminHaulerDetail substat (9992), AdminActiveTrucks (11366) | C2 |
| Per-truck shift state (active / paused / idle) | hr.pausedAt + hr.status | `driver_sessions.ended_at` (only two states: on/off; PAUSED drops) | AdminActiveTrucks tile badges (11377+) | C2 (data) + C3 (paused branch) |
| "Recent loads" feed | `db.loads.sort.slice(0,8)` | `truck_events.event_type='pickup_load'.order_by(event_at desc).limit(8)` | HaulerHome (12482), AdminActivity (synthesized event rows) | C2 |
| Load photo | `db.loads[i].photo` (base64) | `event_photos.photo_url` (signed URL from Supabase Storage) | HaulerTruckView lightbox (13080+), AdminHaulRequestDetail lightbox (7752) | C2 |
| Driver identity for clock-in event | `db.drivers[hr.driverId].name` | `driver_sessions.driver_name` | AdminActiveTrucks mini-phone eyebrow (11375), HaulerTruckView header (12968), settlement/invoice line items (10282, 7839, 13738) | C2 |
| Manual "+ Add load" form | `HaulerLogLoadForm` + setDb writes | (none — drivers log via field widget) | HaulerTruckView footer (13446) | **C3** (delete) |
| Manual "+ Add hours row" / day-row editor | per-row clockIn/Out/break editors + status `<select>` | (none) | HaulerTruckView (13042-13325), AdminHaulRequestDetail day chip (7679-7729) | **C3** (delete) |
| Admin-side per-haul "Add Day" / "Add Load" inline | `assignments[].days` skeleton + `addLoad` (7615+) | (none) | AdminHaulRequestDetail | **C3** (delete inline forms; keep skeleton if dispatch wants to pre-create days) |
| Mock driver collection | `db.drivers` + `DRIVERS_SEED` | `driver_sessions.driver_name` (free text) | every driver-name lookup (Section D) | **Robert decision** — keep collection iff admin still assigns drivers to trucks manually |
| Status: `load.approved` / `hours.approved` activity events | emitter at 13715, 13743 | (none — driver events are the truth) | AdminActivity rendering | **C3** (delete emitters; keep the activity-row renderer for legacy/Supabase rows) |
| `load.logged` / `shift.started` / `shift.ended` synthetic activity rows | mockup setDb composers (multiple) | synthesize from `truck_events` at render time | AdminActivity (11537), AdminSidebar unread count (12151), AdminHaulRequests sidebar (6597) | C2 (stop emitting; synthesize for display) |
| Geocode/route data | `db.geocode` / `db.routes` | UNCHANGED | live-ops map (4779-5252) | **out of Phase 4 scope** |
| Driver UI (`/driver`, `DriverShell`, …) | `db.loads` / `db.hours` reads + writes | field widget at separate URL writes directly to Supabase | DriverShell + 8 sub-components (14050-15214) | **C3** (delete `/driver` route + components — they're being replaced by the real field widget, not migrated) |

---

## Robert-level decisions needed before C2 can start

1. **`status` on loads** — drop entirely or keep an admin-side approval gate? Recommend drop. F1 in May 24 audit is essentially the same question, never resolved.
2. **`db.drivers` + `truck.driverId`** — keep so dispatch can pair drivers to trucks (and the field widget reads from that pairing), or drop and let the field widget capture driver name as free text on the session row? Affects ~15 sites and AdminActiveTrucks tile rendering.
3. **`HaulerLogLoadForm` + per-truck "Add load" inline** — delete entirely, or keep as a "driver forgot, dispatch fixes it" fallback that writes through to `truck_events`? Same question for the day-row hour editors.
4. **Pause concept** — drop the "Paused" KPI on AdminActiveTrucks tile + the pause/resume buttons inside DriverHome? (No corresponding column on `driver_sessions`.)
5. **`job_id → projectId` mapping** — `driver_sessions.job_id` points at a haul request, not a project. Per-project rollups (AdminReports project rows, AdminHaulers "active hauls" KPI) need either a join through `haul_requests.projectId` or a decision to drop project-level rollups. Recommend the join.

Until items 1, 2, and 5 are decided, C2 can't ship without making implicit calls on each. Item 3 affects C3 scope (~250-400 lines of deleteable UI). Item 4 is a tile-level visual decision, lowest risk.
