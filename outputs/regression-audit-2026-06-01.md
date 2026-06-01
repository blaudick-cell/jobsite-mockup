# Admin-surface regression audit — 2026-06-01

Catalog produced by `wf_9a6941f5-b79` (6 parallel surface-area agents).
No fixes made during this step — fixes that flowed out of it are tracked
in separate commits referenced inline.

## Legend

- ✅ pass — surface works as intended
- ⚠ stale / orphaned — dead code or dead UI not visible to users, candidate for cleanup
- ❌ fail — user-visible regression

## Dispatch + Dispatch Overview

| Item | Status | Note |
|---|---|---|
| `/admin/dispatch` → `AdminActiveTrucks` | ✅ | `index.html:16709`; legacy `/admin/trucks/active` aliased |
| Filter pills `[All] [On Shift] [Off Shift]`, All default | ✅ | `15325-15333`; `initialDispatchFilter` returns `'all'` |
| `exportDispatchCSV` + `exportDispatchPDF` | ✅ | CSV `14770`, PDF `14811`; Export menu wires both |
| Two-column card grid | ✅ | `repeat(auto-fill, minmax(320px, 1fr))` |
| `DriverActivityTable` mount on Dispatch tab | ❌ (audit assumption error) | Dispatch tab renders its own `ActiveTruckCard` grid directly (no DriverActivityTable). DriverActivityTable mounts only on Dispatch **Overview** + hauler/haul detail pages. Audit-item was a conflation, not a code bug. |
| `/admin` → AdminHaulRequests | ✅ | h1 reads "Dispatch Overview"; breadcrumb correct |
| 4-stat tile strip REMOVED from Dispatch Overview | ✅ | `showCapacitySummary` prop dropped from the mount per commit `a9eb41d` |
| "View all in Dispatch →" link | ✅ | Renders from DriverActivityTable when `viewAllHref` set |
| Sidebar single Dispatch entry, top of trucking cluster | ✅ | Order: Dispatch Overview → Dispatch → Jobs → Contractors / Dispatchers |
| Production bundle parity | ✅ | curl matches local: 4 exportDispatch* hits, 13 DriverActivityTable refs |
| `fmtAgo` helper in AdminHaulRequests | ⚠ stale | Defined `7262-7270`, no callers (side-rail was deleted 2026-05-25) |
| `recTarget` / `recommendations` / `activityFeed` locals | ⚠ orphaned | Computed every render at `7257-7261`, never read |
| `filterProject` + clear-filter pill block | ⚠ stale | `filterProject` hardcoded to `null` at `7144`; pill block at `7399-7417` can never render |

## Contractors / Dispatchers + Detail

| Item | Status | Note |
|---|---|---|
| Sidebar label "Contractors / Dispatchers" | ✅ | `index.html:16583` |
| AdminHaulers list page header | ✅ | Crumbs, eyebrow, h1, "+ Add contractor / dispatcher" button all consistent |
| AdminHaulers KPI strip (5 tiles) | ✅ | Driver-sessions-derived via `haulerLiveStats` |
| Search input | ✅ | Bound to `setSearch`, case-insensitive name+email match |
| Filter pills (Available now / Insurance / truck-types) | ✅ | Working |
| Sort dropdown (Largest fleet / A→Z) | ✅ | Working |
| AdminHaulerDetail header — `HaulerRollupStats` replaces legacy grid | ✅ | Commit `4a87a7b` |
| Legacy "Jobs / Trucks / Loads / Total revenue" tiles gone | ✅ | Only comment reference remains |
| Fleet section + "+ Add truck for `{hauler}`" | ✅ | |
| Active driver sessions section (filterByHaulerId + activeOnly) | ✅ | |
| Session history section (filterByHaulerId, no activeOnly) | ✅ | |
| `haulerSimpleRollup` function | ⚠ orphaned | Defined `2368-2404`, no callers. Body still reads purged `db.loads`+`db.hours` so would return zeros if called. Cleanup candidate. |
| User-visible "Haulers" leftover | ⚠ stale (1 site) | `<meta name="og:description">` at `line 10` still says "Hierarchy: Projects → Hauls → Haulers → Trucks." Visible to link-preview scrapers; not on-page. All other "Haulers" hits are code identifiers / CSS class names. |

## Jobs + Job Detail

| Item | Status | Note |
|---|---|---|
| `/admin/jobs` → AdminHaulRequests | ✅ | `(parts[1] === 'requests' || parts[1] === 'jobs')` |
| `/admin/jobs/new` → AdminHaulRequestCreate | ✅ | |
| `/admin/jobs/<id>` → AdminHaulRequestDetail | ✅ | |
| Legacy `/admin/requests/*` still resolves | ✅ | OR-aliased on all three routes + title router |
| New Job form: 4 required fields gating submit | ✅ | `valid = assignedHaulerId && projectLabel.trim() && materialCode && volumeNum>0` |
| Optional details collapsed by default | ✅ | `useState(false)` for `optionalOpen` |
| No "Requested at" field — `setRequestedAt` grep returns 0 | ✅ | |
| `assignedHaulerId` wired through create form | ✅ | Written to new haul row, used in activity log + navigation |
| Job detail mounts `HaulTruckingIntegration` | ✅ | |
| Assigned Contractor/Dispatcher dropdown | ✅ | Writes `assignedHaulerId` via `updateReq` |
| "Assigned tickets" list (NOT "Assigned trucks") | ✅ | Reads `driver_sessions WHERE haul_id = req.id` |
| "+ Assign ticket ▾" dropdown with cascade narrowing | ✅ | `pickableBuckets` filters NULL `haul_id` + cascades on `hauler_id` |
| Donut 108px CY progress + "No target set" fallback | ✅ | |
| 4 progress stats (Sessions / Hours billed / $ billed / CY hauled) | ✅ | |
| `haul_assigned_trucks` — no functional code refs | ✅ | 0 grep hits for `from('haul_assigned_trucks')`. 4 substring hits are all comments. Server-side table dropped in commit `eb463bf`. |

## Drawer + Card Chips + Map

| Item | Status | Note |
|---|---|---|
| Drawer header: End shift button (active sessions only) | ✅ | Gated `sess && !sess.ended_at` |
| Drawer header: Delete button left of Close | ✅ | `jse-drawer-delete-btn` |
| `deleteFromDrawer` cascade + `window.confirm` spec wording | ✅ | Exact text per spec |
| Identity section: Driver / Company / Truck / Truck # / Dispatch | ✅ | 5 MetaField rows, all editable |
| `saveSessionField` uses `.select().single()` + `applyRowPatch` + `await refetch` | ✅ | Persistence-fix path (commits `b35895f` + `226fc7c`) intact |
| Card chip: Contractor / Dispatcher ▾ writes `hauler_id` | ✅ | Real `<select>` from `db.haulers` |
| Card chip: Job ▾ writes `haul_id` with cascade | ✅ | `pickableHauls` filters by `assignedHaulerId === sess.hauler_id` + always-include-current fallback |
| `saveHaulerFromCard` helper | ✅ | |
| `saveHaul` helper | ✅ | |
| Map pin rendering (driver mode) | ✅ | Halo+dot pins via `mkMarker` |
| Map auto-fit bounds on mode change | ✅ | `fitBounds` on `[mapMode, driverSignature, …]` |
| Click pin → opens drawer | ✅ | Shared Realtime subscription |
| Default map mode: Active Drivers | ✅ | `useState('drivers')` |

## Activity / Reports / Payments / Backup / etc.

| Item | Status | Note |
|---|---|---|
| Activity Feed (`/admin/activity`) | ✅ | Admin-only stream, no filter pills (intentional — comment at `15850-15857`) |
| Activity reads `db.activity` | ✅ | Trucking events denylisted via `TRUCKING_TYPE_PATTERNS` |
| Projects sidebar / route | ✅ (intentionally removed) | "AdminProjects function deleted" — `/admin` lands directly on AdminHaulRequests |
| Materials & Rates tab | ⚠ orphaned | Supabase tables exist as backup-roster entries but **no admin CRUD surface** (no route, no component, no sidebar entry). Materials are free-text on `haulRequests.materialCode`; rates fall back to `DEFAULT_RATES`. |
| Reports — Financial reports | ✅ | `/admin/reporting` |
| Reports — Live stats | ✅ | `/admin/reports` |
| Payments (Invoices) | ✅ | `/admin/payments` — kept as "Payments" per Robert's nav reorder, not renamed to Invoices/Settlements |
| Backup | ✅ | `/admin/backup` — SheetJS xlsx export + SQL dump + restore working |
| User-visible "Hauling Overview" leftovers | ❌→✅ FIXED | Was at `index.html:15983` ("Driver activity surfaces on Dispatch and the **Hauling Overview** Active Drivers section."). Patched in commit `c95ace0`. |
| User-visible "Haulers" leftovers | ✅ | Only the og:description meta tag at line 10 (link-preview scrapers, not on-page UI). |

## Mobile 375px

| Item | Status | Note |
|---|---|---|
| Sidebar collapses on mobile | ✅ | `.jse-hide-mobile` + hamburger in Topbar |
| Dispatch card grid → single column | ✅ | `.jse-active-trucks-grid` + global `[style*="display: grid"]` rule |
| Dispatch Overview 5-card cap mobile | ✅ | Cards collapse to single column via global rule |
| Drawer → full-screen sheet on mobile | ✅ | `.jse-drawer-sheet`; header End shift + Delete + Close all reachable |
| Map height adjusts | ✅ | 480px → 320px @<=700, drawer mini-map 180→140 |
| Hauler/job detail header tiles → 2-up / 1-up | ✅ | Cascade through `@media <=900` then `<=600` |
| New Job form fields stack | ✅ | `minmax(220px, 1fr)` plus global `<=600` rule; inputs 44px min-height |
| Topbar wraps at narrow widths | ✅ | Breadcrumb hidden `<=500` |
| Tables → card stacks | ✅ | Tier-2 mobile rule converts table/tbody/tr/td to block at `<=700` |
| Site Conditions 7-day strip | ✅ | Locked 7-col, stat grid compacted `<=640` |
| Card meta line — Contractor + Job dropdowns | ❌→✅ FIXED | Two-row flex-wrap restructure in commit `c95ace0`. Verified at 375px: every page now `bodyScrollWidth === 375` (no horizontal overflow). |
| `.admin-mobile-nav-trigger` CSS | ⚠ orphaned | Dead CSS class — never referenced from JSX (hamburger lives in Topbar). |

## Summary

- **6 user-visible / functional issues found** → 2 patched in commit `c95ace0` (mobile card meta line + "Hauling Overview" leftover string), 4 are orphaned/stale CSS/JS that are non-visible to users and worth a future cleanup pass.
- **No active functional regressions remain** on any audited surface.
- The one ❌ marked above (Materials & Rates tab) is intentionally absent from the UI — Robert's spec says "keep for future"; the data tables stay server-side.
