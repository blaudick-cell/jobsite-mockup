# Phase 4 — C1 audit (working doc, not committed)

**File audited:** `index.html` @ 15,644 lines. **Generated** 2026-05-30.

**Read this first.** The May 25 driver-UI-elimination report (`outputs/driver-ui-elimination-report.md`) said `AdminActiveTrucks`, `DriverShell`, `DriverHome`, `DriverLogLoad`, `DriverTruckDetail`, `DriverMultiTruckHome`, `DriverNoTruck`, `DriverIncomingRequests`, `MiniPhone`, `AdminNewDriver` were deleted. They are **all back in the file** — Robert restored them. The "MiniPhone embed of DriverHome inside AdminActiveTrucks" pattern is the named integration target. C2 must decide whether to keep that embed or replace it with a slim session card + drawer (recommendation lives in §3.A and §4.6).

Effort key: **T** trivial (1-line swap), **M** moderate (helper rewrite or multiple sites), **H** hard (architectural — touches the cascade boundary, needs a new isolated subscription, or affects ≥5 components).

---

## 1. Data source map

Every read of `db.loads` / `db.hours` / `db.activity` / related mock data, grouped by component, with effort.

### 1.A — `db.loads` reads (48 sites)

#### `AdminReports` (line 6014, route `/admin/reports`)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 6043 | `db.loads.filter(date in range)` for "loadsCount" KPI + sparkline | `truck_events where event_type='pickup_load'` in range | M |
| 6069 | Same, prior window | Same, prior window | T (mirror of 6043) |
| 6092 | Per-day load count, last 7 days | `truck_events.event_type='pickup_load'` grouped by `event_at::date` | M |
| 6105 | Per-project loads-in-range (project rows) | `truck_events` joined via `driver_sessions.job_id → haul_requests.id → haul_requests.projectId` — see §4 Q5 | **H** |
| 6171 | Per-hauler loads-in-range | `truck_events` joined via `driver_sessions.matched_truck_id → trucks.haulerId` | M |
| 6192 | Per-truck loads-in-range (utilization) | `truck_events` joined via `driver_sessions.matched_truck_id` | M |

#### `AdminHaulers` (line 9217, route `/admin/haulers`)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 9234 | `loads.filter(status='approved' && date=TODAY_ISO)` for `todayLoads` base set | `truck_events.event_type='pickup_load' && event_at::date = today`; **drop the `status='approved'` filter** | T |
| 9246 | `todayLoads.filter(truckIds.has(l.truckId))` per-hauler completed-today | Join through `driver_sessions.matched_truck_id → trucks.haulerId` | M |
| 9247 | Same, sum CY | `CY_PER_TRUCK[truck.type]` × pickup_load count | T |
| 9264 | Per-project `loads.filter(projectId)` for "delayed project" health flag | Needs `job_id → project` map — see §4 Q5 | **H** |
| 9378 | Inner loop same as 9264 — `FleetMiniViz` dot color | Same | M (parent-dependent) |

#### `AdminHaulerDetail` (line 9704, route `/admin/haulers/:id`)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 9721 | `loads.filter(truckIds.has(l.truckId))` scoping (used downstream by `haulerRollupV31`) | Sessions+events filtered by `driver_sessions.matched_truck_id IN hauler.trucks` | M |

The rest of this page goes through the `haulerRollupV31` helper (line 2541) — if the helper is swapped, the page auto-fixes.

#### `AdminHaulRequestDetail` (line 7438, route `/admin/requests/:id`)

The heaviest user of `db.loads` in the file.

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 7752 | `loads.find(id===photoFor)` for the photo lightbox | `event_photos.photo_url` | M (path/network swap) |
| 7776 | `loads.filter(haulRequestId===req.id && truckId)` for `loadsOnTruck` confirm-prompt count | `truck_events` scoped by `session.job_id === req.id && session.matched_truck_id === truckId` | M |
| 7801 | Same + `date` for day-level count | Same scope, group by `event_at::date` | M |
| 7840 | Per-truck loads → CY sum for invoice line-item `deliveredCY` (informational) | `CY_PER_TRUCK[type] × count(pickup_load events)`, scoped same way | M |
| 7886 | Count of loads on this request for invoice `loadCount` | `count(truck_events where event_type='pickup_load' && session.job_id===req.id)` | T |
| 8550 | Same per-truck CY (rendered in `HaulOperationalCard` footer) | Same as 7840 | T (mirror) |
| 8733 | Per-(req, truck, date) load rows (day-row table) | Same scope | M |
| 8806 | Photo path on the day-row | `event_photos.photo_url` | T (path swap) |

#### `AdminInvoiceDetail` / `AdminReporting` invoice generators (10262, 10283, 10327, 14579, 15172)
All write paths reading `loads` to build invoice line items. **Secondary** — driven by `deliveredCYForRequest` (line 2491). Auto-fix when that helper is swapped. **T** per site once the helper lands.

#### `HaulerHome` (line 12453, route `/hauler/o/:id`)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 12482 | `loads.filter(myTruckIds.has(truckId))` sorted, `slice(0,8)` for "Recent loads" table | `truck_events.event_type='pickup_load'` joined via `session.matched_truck_id`, ordered `event_at DESC` | M |
| 12605 | `loadsForReqTruck` helper for per-truck load-count chip | Same scope | T |
| 12706 | Per-req sum CY shown on active-assignment card | `CY_PER_TRUCK[type] × pickup_load count` | T |

#### `HaulerProject` (line 12856, route `/hauler/o/:id/p/:projId`)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 12864 | `loads.filter(truckIds.has)` scoping | Sessions+events filtered by hauler's trucks | M |
| 12866 | `filter(status='approved').reduce(cy)` for "Total CY" stat card | Sum of `CY_PER_TRUCK` over pickup_load events; **drop status filter** | T |
| 12868 | `filter(status='pending').length` for "Pending loads" KPI | **DELETE** — driver events have no pending status | T (delete UI) |

#### `HaulerTruckView` (line 12949, admin + hauler views)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 12970 | `loads.filter(truckId===truckId)` base set | `truck_events` via `driver_sessions.matched_truck_id` | M |
| 13014 | `find(id===id)` for confirm-delete | n/a (write path — §2.A) | — |
| 13080 | Photo lightbox | `event_photos.photo_url` | M |

#### Driver UI (`DriverHome` 14360, `DriverMultiTruckHome` 14904+14925, `DriverTruckDetail` 15000, `DriverLogLoad` 14716+14719)

All read `db.loads` filtered by `driverId` + truck + `isToday(date)`. **Out of scope** for C2 read-swap — these get deleted whole-cloth in C3 (the field widget at `driver.jobsiteexchange.com` replaces them).

#### `AdminBackup` / Reporting placeholders (line 10240)
`(db.loads || []).filter(status='approved').reduce(cy)` for "tonnage hauled" stat card. Swap to sum of `CY_PER_TRUCK` over all `truck_events.event_type='pickup_load'`, drop the `'approved'` gate. **T**.

#### `AdminProjects` placeholder (line 13837-13838)
`loadCount` / `totalCY` inside a dead-code path the May 25 commit nominally eliminated. **Verify dead before C3 delete.** T.

#### Status filter sweep — `l.status === 'approved'`
Appears at: 9234, 9265, 9379, 10240, 12866, 12868, 13091, 13837, 13838, 14360, 14904. **All become "always true"** (drop the filter — driver-logged events are real by definition). T per site, but ~12 sites total — bulk find/replace.

### 1.B — `db.hours` reads (42 sites)

#### `AdminReports` (6014)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 6033 | `db.hours.filter(status='open')` for "On shift now" KPI | `driver_sessions where ended_at IS NULL` | M |
| 6044 | Range-scoped hours for "hoursTotal" KPI | Per-session duration = `(ended_at OR last truck_event.event_at OR now) - started_at`, summed | M |
| 6094 | Per-day hours sparkline | Same, grouped by `started_at::date` | M |
| 6172 | Per-hauler hours-in-range | Sessions joined via `matched_truck_id → trucks.haulerId` | M |
| 6195 | Per-truck `status='open'` for "inservice" column | `sessions where matched_truck_id===truck.id AND ended_at IS NULL` | T |

#### `AdminHaulers` (9217)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 9238 | `hours.filter(truckIds.has && status='open')` for per-hauler active count | `sessions where matched_truck_id IN hauler.trucks AND ended_at IS NULL` | M |
| 9244 | `openShifts.map(h.projectId)` for "active hauls" KPI (distinct projects) | Sessions have `job_id` (haul request), not `projectId` — needs §4 Q5 join | **H** |
| 9307 | Global `hours.some(truckId, status='open')` for "Trucks active" KPI | Sessions filtered by truck IN realTrucks AND `ended_at IS NULL` | M |

#### `AdminHaulerDetail` (9704)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 9720 | `hours.filter(truckIds.has)` scoping (used by `haulerRollupV31` downstream) | Sessions filtered same way | M |
| 9992 | Inline `hours.some(truckId, status='open')` for "Trucks active now" sub-stat | Same as 9307 | T (mirror) |

#### `AdminHaulRequestDetail` (7438)

| Line | What it reads | New source | Effort |
|---|---|---|---|
| 7697 | `hours.find(haulRequestId, truckId, date)` for upsert lookup before patching | n/a — admin write path (§2.D) | — |
| 7711 | `hours.map(id===existingHr.id)` for hours-row patch | Same — write path | — |
| 7728 | `hours: [...prev.hours, newHr]` new-row insert | Same — write path | — |
| 7793 | `filter(haulRequestId !== req.id ...)` cascade on truck-remove | Same — write path | — |
| 7817 | Same cascade on day-remove | Same — write path | — |
| 7855 | `hours.filter(haulRequestId, truckId)` for per-truck invoice line-item hours | Session-duration sum over `sessions where matched_truck_id===a.truckId AND session.job_id===req.id` | M |
| 8559 | Same as 7855 in per-truck rollup card footer | Same | T (mirror) |
| 8734 | Per-(req, truck, date) hours-row chip | Same | M |
| 9030 | Same — settlement-statement builder | Same | M |

#### `HaulerHome` / `HaulerProject` / `HaulerTruckView`
12863 (`HaulerProject` — `calcHours` sum for cards), 12867 (active-trucks count), 12971 (`HaulerTruckView` truck-scoped hours rows), 13029 (insert new hours row — write). C2 reads: M each. Write at 13029: §2.C.

#### `AdminActiveTrucks` (11366)
`(db.hours || []).filter(status='open')` → `driver_sessions where ended_at IS NULL`. **M.** Drives the entire grid + KPI strip. See §3.A for the deep dive.

#### Driver UI (14359, 14905, 14922, 14997)
All `hours.find(truckId, driverId, status='open')` driving clock-in/out/pause buttons. **Out of scope for C2** — C3 deletes the components whole.

### 1.C — `db.activity` reads (5 sites)

| Line | Component | What it reads | New source / disposition | Effort |
|---|---|---|---|---|
| 6597 | `AdminHaulRequests` dispatch-board right-side feed (top 8) | Sort + slice, **plus blend in** synthesized rows from `truck_events` | M |
| 11534-11538 | `AdminActivity` main feed at `/admin/activity` | Same blend + group-by-day | M |
| 12149-12151 | `AdminSidebar` unread badge | Stays as-is for admin events; synthesized truck_events count toward badge too | T |
| 14323 | `DriverHome` `isEdited` check | Goes away with `DriverHome` in C3 | — |

#### Activity row types — keep vs. become redundant

| Type | Emitter | Disposition |
|---|---|---|
| `load.logged` | 13540, 14410, 14744, 15044 | **Stop emitting** — synthesize from `truck_events` at render. (M) |
| `shift.started` / `shift.ended` | 14480, 14528, 15093, 15122 | **Stop emitting** — synthesize from `driver_sessions`. (M) |
| `load.removed` / `.edited` / `.approved` / `.rejected` | 13019, 14228, 13715, 13728 | **Keep** — admin mutation tracking |
| `hours.approved` / `hours.added` | 13743, 13055 | **Keep** — admin mutation tracking |
| `haul_request.created` / `.updated` / `.deleted` | 6975, 7522, 7551 | **Keep** |
| `haulRequest.matched` / `.acceptedByHauler` / `.declinedByHauler` / `.truckAdded` | 2646, 12532, 12560, 7605 | **Keep** |
| `hauler.created` / `.deleted` | 5389, 9798 | **Keep** |
| `truck.created` | 5664 | **Keep** |
| `driver.created` | 5556 (inside orphan `AdminNewDriver`) | **Delete emitter** with §2.E |
| `invoice.*` | 7896, 10336, 10353, 10374, 10642, 10666, 10682, 10720, 10915, 10938, 12524 | **Keep** |
| `project.created` / `.updated` | 2660, 7538 | **Keep** |

### 1.D — Other mock data with driver-side equivalents

#### `db.drivers`
Still actively read at 6193, 7839, 10282, 11375, 12737, 12771, 12968, 13292, 13738, 13825, 14065. Mockup IDs (`dr-001`) don't exist in `driver_sessions` (which has free-text `driver_name`). **Decision:** §4 Q2. Recommended default: read `driver_sessions.driver_name` directly, mark `db.drivers` for C3 deletion. **M (collection-wide).**

#### `truck.driverId`
Used in 9 places. Same decision as `db.drivers`. **M.**

#### `db.geocode` / `db.routes`
Orthogonal to driver data. Feed the live-ops map (4779-5252+). **OUT OF SCOPE for Phase 4.**

#### `db.haulRequests.assignments[].days[]` (day skeleton)
Builds empty `{date, startTime, hours, loads:[]}` per (truck, day). The `d.hours` override field overrides `db.hours` totals. If admin-side day-row hour entry goes away (§2), the override field can go too. The skeleton itself stays only if admin still wants to pre-create future days. **M.**

---

## 2. Obsolete features to delete

Per the scope: drivers are the source of truth for loads + hours. The mockup loses the ability to manually add either from admin side. Everything below goes in C3.

### 2.A — `HaulerLogLoadForm` (line 13497)
Embedded at bottom of every `HaulerTruckView`. Hauler types load by hand → writes to `db.loads` + emits `load.logged`. **DELETE.** ~50 lines + emitter at 13540. See §4 Q3 — Robert may want to keep as a "driver forgot" fallback writing through to `truck_events`.

### 2.B — `AdminHaulRequestDetail` inline "Add Load" form (lines 7615-7656)
`addLoad` function + the chip-level form that owns `addLoadForm` state. **DELETE.** ~40 lines.

### 2.C — Per-truck day-row hour editor in `HaulerTruckView` (lines 13289-13325 + 13041-13066)
"+ Log hours →" button and "+ Add hours row" button plus per-row clockIn/clockOut/breakMin/status `<select>` editors. **DELETE.** ~110 lines.

### 2.D — Per-haul day-row hour chip in `AdminHaulRequestDetail` (lines 7679-7729)
`updateDay` patch path with `'hours' in patch`. Admin types flat hour total into the chip → upserts a `db.hours` row. **DELETE the editor.** Keep the `d.hours` override field on the data model if dispatch wants to manually adjust display-only — but the input goes. ~50 lines.

### 2.E — `AdminNewDriver` wizard (line 5524)
Orphan. Route at 12368 exists but no UI link to it. **DELETE the component + route.** Drivers come in via the field widget. ~75 lines.

### 2.F — Approve / reject load buttons
`load.approved` / `load.rejected` emitters at 13715, 13728 + the `EditableSelect status` at 13356 + status options at 13082-13085. Driver events have no status. **DELETE the status `<select>`.** ~30 lines.

### 2.G — "Mark hours approved" affordance
Line 13743 emitter + `EditableSelect status` at 13304. Goes away with §2.C since the hours-row editor goes away whole. ~20 lines.

### 2.H — Load-photo replace/upload on admin side (lines 7745, 13072)
`onPickReplacePhoto` in haul-detail and `HaulerTruckView`. Drivers upload via the field widget; `event_photos` is the truth. **DELETE the writes,** keep the lightbox as read-only viewer pointed at `event_photos.photo_url`. ~40 lines (modals stay, write paths go).

### 2.I — Driver UI route + components (`/driver` shell)
`DriverShell` (14050), `DriverHome` (14360), `DriverLogLoad` (14716), `DriverTruckDetail` (15000), `DriverMultiTruckHome` (14904), `DriverNoTruck`, `DriverIncomingRequests`, `MiniPhone` (11306), router entries at 15624+. **DELETE WHOLE** — the field widget at `driver.jobsiteexchange.com` replaces them. ~1200 lines, biggest single chunk of C3.

### 2.J — Driver-side write paths into `db.loads` / `db.hours`
Whatever's left after 2.I — verify by grep on `setDb(prev => ({ ...prev, loads:` and `setDb(prev => ({ ...prev, hours:`. Anything that survives 2.A-2.D + 2.I gets reviewed before C3 ships.

### Total C3 deletion estimate
~1600 lines. ~11% bundle reduction.

---

## 3. Integration targets

Specific components that get rewired in C2. UI stays, data source changes.

### 3.A — `AdminActiveTrucks` (line 11360, route `/admin/trucks/active`)

**Named integration target.**

#### Reads today
- `db.haulers` (11364) — filter orphan haulerIds
- `db.trucks` (11365) — hauler-owned trucks
- `db.hours.filter(status='open')` (11366) — open shifts
- `db.drivers.find(id===t.driverId)` (11375) — eyebrow name per tile

#### Rendered shape
1. Crumbs + page header (11398-11405): "Active Trucks · What every driver sees, right now."
2. 4-card KPI strip (11407-11412): **Active right now / Paused / Idle (driver assigned) / Benched trucks**
3. Mini-phone grid (11419-11450): `auto-fill, minmax(296px,1fr)` of `MiniPhone` tiles wrapping `DriverHome` / `DriverTruckDetail`. Click routes to `HaulerTruckView` admin viewer mode.
4. Benched-trucks table (11455-11478): trucks with `!t.driverId`. Plate / type / rate / hauler / haul / "Assign driver" CTA.
5. Log-load modal (11481-11526): centered overlay rendering `DriverLogLoad`.

#### Aggregations under new source

| KPI | New source |
|---|---|
| "Active right now" | `count(driver_sessions where ended_at IS NULL)` |
| "Paused" | **DROP** — no pause concept on driver tables (§4 Q4) |
| "Idle (driver assigned)" | Depends on §4 Q2. If `truck.driverId` stays: `count(trucks where driverId AND NOT EXISTS session.matched_truck_id===truck.id AND ended_at IS NULL)`. If dropped: drop the KPI. |
| "Benched trucks" | `count(trucks where !driverId)` — mockup-only concept. Stays iff `truck.driverId` stays. |

#### Per-tile derivation

- Driver name → `driver_sessions.driver_name` (replaces `db.drivers[id].name`)
- Truck plate → mockup `truck` record, cross-ref via `driver_sessions.matched_truck_id`
- Status badge → `ended_at IS NULL` → "On shift" / `IS NOT NULL` → "Off shift" (Paused gone)
- "Last clock-in" → `driver_sessions.started_at`
- "CY today" / "Loads today" inside tile → `truck_events` for this session

#### Recommended C2 shape
1. New isolated hook `useDriverSessionsLive()` (pattern from §3.A.iii below)
2. Replace `db.drivers` name with `session.driver_name`
3. Cross-ref `session.matched_truck_id` to `db.trucks` (admin-controlled — stays)
4. **Replace embedded `DriverHome` widget** with a slim session card: driver name, plate, started_at, elapsed, last event, CY-today, photo count. Click expands a drawer with the full event timeline. (Recommended over keeping the embed — see §4 Q3 reasoning.)

#### Effort
**H.** Touches the isolated-subscription boundary + drops the embed.

### 3.B — `useDriverSessionsLive()` hook (new code, not currently present)

No existing `useSupabaseSubscription`/`useRealtimeRows` hook in the mockup. The pattern to model on:

- `subscribeRealtime` (line 3919-3935) attaches `channel.on('postgres_changes', …)` for every table in `SB_TABLE_LIST` to one shared nonce, mounted once inside `<App>`.
- Components observe via `useContext(RemoteUpdateContext)` to re-derive memoized views.

**New hook design:**
- Opens its own channel `_sb.client.channel('jse-live-ops')`
- Subscribes to `postgres_changes` on the 4 driver tables ONLY
- Owns its own `useState({ sessions:[], events:[], photos:[], issues:[] })`
- Initial hydration on mount via 4 `SELECT *` REST calls
- Debounce 1s, then re-aggregate
- `removeChannel` on unmount
- Returns `{ sessions, events, photos, issues, loading, error }`
- **NEVER touches `db` / `setDb` / `SB_TABLE_LIST`** — the 4 tables stay out of the cascade entirely.

#### Effort
**H** (foundational — every other C2 piece depends on it).

### 3.C — Loads view

No dedicated `/admin/loads` route. Loads render inline at:
1. `HaulerTruckView` day-row tables (line 13332+) — main per-truck view
2. `AdminHaulRequestDetail` day-row tables (line 8728+) — per-haul view
3. `HaulerHome` "Recent loads" card (line 12800+)
4. `AdminInvoiceDetail` line items (via `inv.lineItems`)

C2: each becomes a `truck_events.event_type='pickup_load'` read filtered the relevant way. Status `<select>` + `× delete` go to C3. Photo column → `event_photos.photo_url`. **M per site.**

### 3.D — Hours view

No dedicated route. Hours render at:
1. `HaulerTruckView` per-day chip + editable rows (13289+)
2. `AdminHaulRequestDetail` day-row chip (8728+)
3. Sidebar / KPI counts of "trucks on shift" (multiple §1.B sites)

C2: KPI sites read sessions. C3: delete the row editors (§2.C, §2.D). **M per site.**

### 3.E — `AdminHaulRequestDetail` (line 7438)

Two big changes:
- Per-truck CY/hours rollups (7855, 8550, 8559) read driver events instead of `db.loads`/`db.hours`. If the canonical helpers `deliveredCYForRequest` (2491) + `totalBilledHoursForRequest` (2468) + `dollarsForRequest` (2508) are swapped, the whole page's rollup chain re-flows.
- Day skeleton + add-load/add-day forms go away (§2.B, §2.D). Page becomes more read-only.

The dispatch list (`AdminHaulRequests` at 6463) reads aggregates through the same 3 helpers — auto-fixes via the same redirect.

#### Effort
**H** (the canonical-helper swap is high-leverage but touches ~25 read sites downstream).

### 3.F — Activity feed (`AdminActivity` at 11537)

Per §1.C: most rows survive. `load.logged` / `shift.started` / `shift.ended` rows stop being emitted from mockup write paths and get synthesized from `truck_events` at render time. **Alternative:** add a separate "Live trucker activity" pane that reads `truck_events` directly. Recommendation: synthesize at render (single feed, dispatcher's mental model stays one stream).

#### Effort
**M.**

---

## 4. Open questions — Robert decisions needed

Each item below has my recommended default baked in. **If Robert approves the doc as-is, C2 proceeds on the defaults.** Counter-proposals welcome on any of them.

### Q1. Drop `status` field on loads entirely?

**Default: YES, drop status filter everywhere.**

12 sites filter loads on `status === 'approved'` (1.A). Driver events have no status. Cleanest model: every driver-logged event is real by definition. C2 strips `.filter(l => l.status === 'approved')` from every read site; C3 deletes the status `<select>` (§2.F).

Alternative: keep status as a derived admin-side flag on a side-table. Larger change, deferred decision. Recommend against.

### Q2. `db.drivers` + `truck.driverId` — keep or drop?

**Default: KEEP `truck.driverId` for admin assignment; DROP `db.drivers` collection.**

Sessions carry free-text `driver_name`. The "assign Marcus Lane to truck #447" affordance is useful for dispatch — it's how admin pre-stages who's on what. But `db.drivers` as a collection of mockup driver records is dead weight; the real driver identity is whatever the driver types at intake.

**Compromise:** `truck.driverId` becomes a free-text name string (or stays as id but only used for display fallback). The collection itself is marked for C3 deletion.

Alternative A: drop both — `truck.driverId` and `db.drivers` collection. Simpler. Admin loses the pre-assign affordance.
Alternative B: keep both — current behavior. Carries dead `db.drivers` rows.

If Robert wants the simplest path, alternative A is cleanest. **I'll go with the default unless told otherwise.**

### Q3. Manual entry forms (`HaulerLogLoadForm` + day-row hour editors) — delete or keep as write-through?

**Default: DELETE entirely.**

Per scope: "drivers are the source of truth." If a driver forgets, admin texts them to log it themselves via the field widget. Simpler write model — only `dispatcher_notes` ever gets written from the React side.

Alternative: keep as admin write-through to `truck_events`. Lifts the read-only constraint on `truck_events` from React. Adds audit-trail concerns (who wrote this row?). Covers the realistic "I forgot to clock out" case but at a cost in complexity. C2/C3 lines change significantly under this option (~150 fewer deleted lines, ~80 new lines in a new admin write helper).

**If Robert flags "we still need a fallback,"** the cleanest middle path is to keep the day-row hour editor on `AdminHaulRequestDetail` only (admin-only surface), delete everything else, and have that editor PATCH `driver_sessions.ended_at` for the specific session — no new admin-side writes to `truck_events`.

### Q4. Paused KPI tier on `AdminActiveTrucks` — drop or synthesize?

**Default: DROP the Paused tile.**

Driver widget has no pause feature. `driver_sessions` has only `started_at` / `ended_at`. Active = `ended_at IS NULL`; Ended = `ended_at IS NOT NULL`. Two states, not three. Removes the "Paused" tile from the KPI strip in §3.A.

Alternative: synthesize Paused = "session active but no truck_event in last 30 minutes." Threshold is arbitrary. Recommend against — Robert's earlier "8-hour Active/Inactive" decision on dispatch-live already established a two-state model.

### Q5. `job_id → projectId` rollup join — add or drop project-level rollups?

**Default: ADD the join.**

`driver_sessions.job_id` maps to a haul_request id (per Phase 1 unification). `AdminReports` project rows + `AdminHaulers` "active hauls" KPI keep working by joining through `haul_requests.projectId`. ~3-4 new helper functions, no schema change. Estimate: M-leaning-H, isolated to a new `derivedProjectRollup(session, db.haulRequests)` helper.

Alternative: drop project-level rollups from driver-data displays. `AdminReports` loses "CY delivered per project today" from live data. Smaller code change but loses a dispatcher view that the current UI provides.

Recommend the join.

---

## Risk callouts

- **`AdminActiveTrucks` embed is bigger than "swap queries."** The MiniPhone-embed pattern that survived the May 25 revert is genuinely the integration target. C2 either keeps it (and gates every write button inside `DriverHome`/`DriverTruckDetail`) or replaces it. Replacement is cleaner; gate-the-writes is closer to a swap-data-only change. **My pick: replacement.** Bundle savings, less risk of a future write-through bug, fits the scope's "delete obsolete" mandate.
- **Photo path swap is its own work.** `db.loads[i].photo` is inline base64; `event_photos.photo_url` is a Supabase Storage signed URL. The lightbox JSX at 7752 + 13080 changes from `<img src={dataUri}>` to `<img src={url}>` — trivial — but if the storage bucket changes policy or signed URLs expire, the lightbox breaks differently. Worth a 1-time smoke test in C2.
- **`hydrateDb` cascade is the bright line.** The 4 driver tables must NEVER appear in `SB_TABLE_LIST` (3338), `SB_FIELDS_JS` (3361), `buildSeed`, `HYDRATE_LIVE_DATA_TABLES` (2695), or `auditSbSchema`. Confirmed zero current matches — must stay that way. The new `useDriverSessionsLive()` hook (§3.B) holds state component-local, never on `db`.
- **Bundle parse hazard.** The 2026-05-24 RCA noted `const { ...rest }` destructures in multiple Babel script blocks brick boot. Avoid object-rest-spread in new code. Confirmed by `index.html:15422-15426` comment.

---

## Summary table

| Concept | Current source | New source | Components affected | C2 / C3 |
|---|---|---|---|---|
| Loads logged today (count) | `db.loads.filter(date=today)` | `truck_events where event_type='pickup_load' && event_at::date=today` | AdminReports, AdminHaulers, HaulerHome, HaulerProject, HaulerTruckView, AdminHaulRequestDetail | C2 |
| CY delivered (today / per-haul / per-hauler) | `sum(db.loads.cy)` | `count(pickup_load events) × CY_PER_TRUCK_TYPE[truck.type]` | every site above + invoice generators (`deliveredCYForRequest` @ 2491) | C2 |
| Load status (approved/pending) | `db.loads.status` | **DROP** — no equivalent | filters at 9234, 9265, 9379, 10240, 12866, 12868, 13083, 13838 + status `<select>` at 13356 | **C3** |
| Hours worked (per-day / per-truck / per-haul) | `calcHours(db.hours[i])` | session duration = `(ended_at OR last truck_event.event_at OR now) - started_at` | AdminReports, AdminHaulers, AdminHaulerDetail, HaulerProject, HaulerTruckView, AdminHaulRequestDetail | C2 |
| "On shift now" / "Trucks active" | `db.hours.filter(status='open')` | `driver_sessions where ended_at IS NULL` | AdminReports (6033), AdminHaulers KPI (9307), AdminHaulerDetail substat (9992), AdminActiveTrucks (11366) | C2 |
| Per-truck shift state (active / paused / idle) | `hr.pausedAt + hr.status` | `driver_sessions.ended_at` (two states — paused dropped) | AdminActiveTrucks tile badges (11377+) | C2 (data) + C3 (paused branch) |
| "Recent loads" feed | `db.loads.sort.slice(0,8)` | `truck_events.event_type='pickup_load'.order_by(event_at desc).limit(8)` | HaulerHome (12482), AdminActivity (synthesized rows) | C2 |
| Load photo | `db.loads[i].photo` (base64) | `event_photos.photo_url` (signed URL) | HaulerTruckView lightbox (13080+), AdminHaulRequestDetail lightbox (7752) | C2 |
| Driver identity for clock-in | `db.drivers[hr.driverId].name` | `driver_sessions.driver_name` | AdminActiveTrucks tile eyebrow (11375), HaulerTruckView header (12968), settlement/invoice (10282, 7839, 13738) | C2 |
| Manual "+ Add load" form | `HaulerLogLoadForm` + setDb | (none) | HaulerTruckView footer (13446) | **C3** |
| Manual "+ Add hours row" / day editor | per-row clockIn/Out/break + status `<select>` | (none) | HaulerTruckView (13042-13325), AdminHaulRequestDetail day chip (7679-7729) | **C3** |
| Inline per-haul "+ Add Day" / "+ Add Load" | `assignments[].days` skeleton + `addLoad` (7615+) | (none) | AdminHaulRequestDetail | **C3** (delete inline forms; keep skeleton iff dispatch wants pre-create) |
| Mock driver collection | `db.drivers` + `DRIVERS_SEED` | `driver_sessions.driver_name` | every driver-name lookup (§1.D) | Robert call Q2 |
| `load.approved` / `hours.approved` activity emitters | 13715, 13743 | (none) | AdminActivity rendering | **C3** |
| `load.logged` / `shift.started` / `shift.ended` synthetic activity | mockup setDb composers | synthesize from `truck_events` at render | AdminActivity (11537), AdminSidebar unread (12151), AdminHaulRequests sidebar (6597) | C2 |
| Geocode / route data | `db.geocode` / `db.routes` | UNCHANGED | live-ops map (4779-5252) | **out of Phase 4 scope** |
| Driver UI (`/driver`, `DriverShell`, …) | `db.loads` / `db.hours` reads + writes | field widget at separate URL writes directly to Supabase | DriverShell + 8 sub-components (14050-15214) | **C3** (delete whole, ~1200 lines) |

---

## Estimated C2 + C3 effort

- **C2 (data swap, UI stays):** ~25-35 read-site rewrites + 1 new `useDriverSessionsLive()` hook + canonical helper rewrites (`deliveredCYForRequest`, `totalBilledHoursForRequest`, `dollarsForRequest`, `haulerRollupV31`). 4-6 commits, each scoped to one screen family.
- **C3 (deletions):** ~1600 lines across `HaulerLogLoadForm`, day-row editors, status selects, `AdminNewDriver` orphan, `DriverShell`+8 components, photo-replace modals. 2-3 commits.

Total Phase 4 working budget: ~6-9 commits, ~2-3 working days.
