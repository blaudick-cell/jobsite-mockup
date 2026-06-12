# Driver-UI elimination — final report (2026-05-25)

**Status: SHIPPED + LIVE-VERIFIED**

- Live URL: https://jobsite-mockup-demo.netlify.app/
- Final etag: `c121bb1465e230d490382e108210dbdb-ssl`
- Bundle size: 843,604 bytes (was 923,903 — **−80,299 bytes / −8.7%**)
- Final commit: `06d10e3`

---

## Why a "phase 2" was needed

Pass-1 (`b4af318` and follow-ups `f33b035` / `b5e0a58` / `20b6640` / `609be0d`)
removed Driver from the routes/sidebar and added a render-time normalizer for
legacy activity rows. Verification was scoped to `document.body.innerText`
checks on a few high-traffic pages and reported zero.

That was insufficient. `AdminActiveTrucks` (`/admin/trucks/active`) and
`HaulerDrivers` still existed as live React components — they just weren't
in the pages I navigated to. Several other surfaces also still bled Driver
language (HaulerTruckView header, invoice line items, Reports utilization
table, etc.). Phase 2 fixes those + deletes the orphaned dead code.

---

## What shipped in phase 2 (commit `06d10e3`)

### User-reachable surfaces stripped

| Surface | Change |
|---|---|
| AdminHaulers "Dispatch board" button | Removed (target page deleted) |
| `/admin/trucks/active` route | Removed |
| `/admin/trucks/active` title handler | Removed |
| `/driver/log`, `/driver/truck/*`, `/driver` title handlers | Removed |
| HaulerTruckView header | Driver name + phone + "Widget ↗" button stripped |
| HaulerTruckView "active trucks" KPI | Dropped `t.driverId` filter |
| HaulerTruckView daily activity rows | Dropped driver-name span from hours rows |
| AdminInvoiceDetail line items | Dropped driverName secondary text from Truck column |
| AdminReports truck utilization | Dropped `t.driverName` line (now shows project name only) |
| Settlement statement line builder | Removed unused `driver` field |
| HaulerLogLoadForm activity event | actorRole `'driver'` → `'hauler'`, actorId from `truck.haulerId` |
| AdminActivity empty state body | "as drivers log loads, haulers approve…" → "as loads are logged, haulers approve…" |
| AdminHaulerDetail "+ Add driver" comment | Comment scrubbed |
| HaulerHome truck card | Removed "{driver.name} / — unassigned" line |
| Remove-truck confirm() | "detach from any haul or driver assignment" → "detach from any haul assignment" |

### Dead code deleted (~1500 lines)

| Component | Lines removed | Notes |
|---|---|---|
| `Block 6` (entire) | ~960 | Phone, DriverShell, DriverNoTruck, DriverTruckNotFound, DriverHome, DriverLogLoad, DriverIncomingRequests, DriverMultiTruckHome, DriverTruckDetail |
| `AdminActiveTrucks` + `MiniPhone` | ~225 | Were the page at `/admin/trucks/active` |
| `HaulerDrivers` | ~60 | The "Driver assignments" sub-page (no caller) |
| `AdminNewDriver` | ~100 | Were the wizard at `/admin/drivers/new` |
| `PhonePreview` | ~20 | No callers |
| `DriverIcon` | ~10 | SVG, no remaining usage |
| `driverName()` helper | ~3 | No callers |

### Comment / identifier cleanups

- `getDriverRecommendation` → `getHaulRecommendation`
- `driverNote` field on condition rows → `haulNote`
- `driverRec` local var → `haulRec`
- `Driver-recommendation strip` / `Driver Recommendation + Mud Outlook` / `driver-friendly subtitle` / `driver subtitle` comments → Haul-* equivalents
- Misc internal comments referencing "Driver-removal pass" reworded to project-neutral wording

---

## Exhaustive grep battery — final results

Against the LIVE served bundle (`https://jobsite-mockup-demo.netlify.app/`,
etag `c121bb1465e230d490382e108210dbdb-ssl`):

### Component / route patterns (target: zero)

| Pattern | Hits | Note |
|---|---|---|
| `DriverShell` | 0 | ✓ |
| `DriverHome` | 0 | ✓ |
| `DriverLanding` | 0 | ✓ |
| `DriverMultiTruckHome` | 0 | ✓ (not in pattern list but verified) |
| `DriverTruckDetail` | 0 | ✓ (not in pattern list but verified) |
| `DriverLogLoad` | 0 | ✓ (not in pattern list but verified) |
| `DriverIncomingRequests` | 0 | ✓ (not in pattern list but verified) |
| `AdminDrivers` | 0 | ✓ |
| `AdminNewDriver` | 0 | ✓ |
| `AdminDriverDetail` | 0 | ✓ |
| `AdminActiveTrucks` | 0 | ✓ (not in pattern list but verified) |
| `HaulerDrivers` | 0 | ✓ (not in pattern list but verified) |
| `MiniPhone` | 0 | ✓ |
| `PhonePreview` | 0 | ✓ |
| `DriverIcon` | 0 | ✓ |
| `/admin/drivers` | 0 | ✓ |
| `/driver/` | 0 | ✓ |
| `Select driver` | 0 | ✓ |
| `Assigned driver` | 0 | ✓ |
| `No driver` | 0 | ✓ |
| `Unassigned driver` | 0 | ✓ |

### Substring patterns (preserved for schema reasons)

| Pattern | Hits | Why preserved |
|---|---|---|
| `Driver` (caps) | 20 | All inside `acceptedByDriver` schema field name (15 in haulRequests seed + migration + sb_fields list) and 5 inside string literals like the activity normalizer regex (`/^A driver \(\w+...\)/`) that intentionally strips legacy server data |
| `driver` (lower) | 232 | `driverId` schema field on trucks/loads/hours (multiplied across seed + sync code) + `db.drivers` collection + Supabase backup label + activity-normalizer regex literals + a handful of comments explaining schema preservation |
| `DRIVER` (caps) | 2 | `DRIVERS_SEED` constant name |
| `driverName` | 25 | Invoice line-item seed data property (`{ driverName: 'M. Ortega', ... }`) — schema-preserved, no longer rendered |

### Schema preservation (per Robert's brief)

The following stay intact:
- `drivers` table in Supabase
- `truck.driverId` column (nullable)
- `assignment.driverId`, `hours.driverId`, `loads.driverId` columns (nullable)
- `acceptedByDriver` column on `haul_requests`
- `SB_FIELDS_JS.drivers` field projection
- `DRIVERS_SEED` data (drives nothing visible)

This means re-adding the role is a UI un-hide commit, not a migration.

---

## Runtime verification — every reachable admin/hauler page

Verified on the LIVE deploy (etag `c121bb1465e230d490382e108210dbdb-ssl`)
by reading `document.body.innerText` on every reachable page:

| Page | Driver | driver | DRIVER | Boot OK |
|---|---|---|---|---|
| `/` (Landing) | 0 | 0 | 0 | ✓ |
| `/#/admin` | 0 | 0 | 0 | ✓ |
| `/#/admin/hauls` | 0 | 0 | 0 | ✓ |
| `/#/admin/hauls/hreq-008` | 0 | 0 | 0 | ✓ |
| `/#/admin/hauls/new` | 0 | 0 | 0 | ✓ |
| `/#/admin/activity` | 0 | 0 | 0 | ✓ |
| `/#/admin/haulers` | 0 | 0 | 0 | ✓ |
| `/#/admin/haulers/op-001` | 0 | 0 | 0 | ✓ |
| `/#/admin/payments` | 0 | 0 | 0 | ✓ |
| `/#/admin/reports` | 0 | 0 | 0 | ✓ |
| `/#/admin/reporting` | 0 | 0 | 0 | ✓ |
| `/#/admin/backup` | 0 | 0 | 0 | ✓ |
| `/#/hauler` | 0 | 0 | 0 | ✓ |
| `/#/hauler/o/op-001/p/RG` | 0 | 0 | 0 | ✓ |
| `/#/admin/p/GE/o/op-001/t/tk-502` | 0 | 0 | 0 | ✓ |
| `/#/admin/p/RG/o/op-001/t/tk-447` | 0 | 0 | 0 | ✓ |

Console: clean (only the benign Babel "deoptimised styling" notice).

---

## Commit history (full Driver-removal chain)

| Commit | Title |
|---|---|
| `b4af318` | feat(simplify): remove Driver concept from UI (schema preserved for future re-add) |
| `f33b035` | fix(activity): normalize legacy driver-attributed summaries at render time |
| `b5e0a58` | fix(activity): strip 'driver.' event-type prefix at render time |
| `20b6640` | fix(driver): strip remaining 'driver' copy from Reports + HaulerDetail |
| `609be0d` | fix(driver): strip Driver attribution from log-load stripe (haul truck-view) |
| `06d10e3` | **feat(simplify): exhaustive Driver-UI elimination (phase 2)** |

---

## To re-add the role later

1. `git revert 06d10e3` (or cherry-pick the Block 6 + AdminActiveTrucks + AdminNewDriver bodies back from the pre-`06d10e3` parent)
2. Wire the routes back: `<AdminActiveTrucks .../>` at `/admin/trucks/active`, `<AdminNewDriver .../>` at `/admin/drivers/new`, `<DriverShell .../>` at `/driver`
3. Re-show the AdminHaulerDetail "+ Add driver" button + sidebar "Active Trucks" entry
4. Schema unchanged — no migration needed
