# Value-source audit — 2026-05-24

Scope: sweep `index.html` for the bug class fixed in `dc733da` (project tile demand reading from stale `volumeCYNeeded` while the pill read `sum(haulRequests.volumeCY)`). Find every other case where the same conceptual value is rendered from 2+ sources that can diverge.

Method: grep canonical helpers (`deliveredCYForRequest`, `totalBilledHoursForRequest`, `dollarsForRequest`, `haulerRollupV31`, `assignedTruckCountForRequest`), grep raw aggregation patterns (`reduce`, `filter('approved')`, `filter('open')`), trace each render site back to its source, group by concept.

Result: **6 divergence-risk findings (1 high, 3 medium, 2 low) + 1 already-fixed reference case**. No quick-win ship — none match the `dc733da` "stale-seed vs live-aggregate" pattern cleanly enough to fix without UX decisions from Robert.

---

## Canonical helpers (source of truth)

| Helper | Source data | Used for |
|---|---|---|
| `deliveredCYForRequest(req, db)` (line 2427) | `sum(db.loads[].cy where haulRequestId === req.id)` — no status filter | per-request CY delivered |
| `totalBilledHoursForRequest(req, db)` (line 2415) | `sum(calcHours over db.hours[] where haulRequestId === req.id)` | per-request hours |
| `dollarsForRequest(req, db)` (line 2439) | hours × `truck.ratePerHour ?? db.rates[type]` | per-request revenue |
| `assignedTruckCountForRequest(req)` (line 2487) | `Set(req.assignments[].truckId).size` — dedupes | per-request truck count |
| `haulerRollupV31(haulerId, db)` (line 2457) | sums delivery+hours over reqs the hauler is assigned to | per-hauler totals |

These are the right source. Findings below are about render sites that bypass them or apply inconsistent filters.

---

## Findings table

| # | Severity | Concept | Source A | Source B | Where displayed | Divergence trigger |
|---|---|---|---|---|---|---|
| F1 | **HIGH** | "completed work" on project tile | `loadsCompleted` = `db.loads.filter(status==='approved').length` (line 5014) | `cyCompleted` = `sum(deliveredCYForRequest(r))` — **no status filter** (line 5049) | `AdminProjects` tile + `AdminReports` table (line 6021) | Pending loads count in CY total but NOT in load count. User reads "5 approved loads (200 CY)" but those 200 CY include unapproved hauls. |
| F2 | **MEDIUM** | "trucks active" | per-project: `trucks.filter(t => t.driverId && db.hours.some(h.truckId===t.id && h.status==='open'))` (line 5011, 13228) | global KPI: `Set(db.hours.filter(h.status==='open').map(h.truckId)).size` (line 10144) — no `driverId` filter | `AdminProjects` tile + `AdminHaulers` "Trucks active" KPI | A truck with open shift but no `driverId` (data inconsistency) is counted in the global KPI but not in any per-project tile. Sum of project counts can be < global count. |
| F3 | **MEDIUM** | "trucks assigned to this haul" | dispatch row uses `assignedTruckCountForRequest(req)` — dedupes (line 7650) | haul-detail header uses `assignments.length` (line 9337, also 9044) — counts duplicates | dispatch list vs haul detail page for the same req | If `req.assignments` has duplicate entries for the same `truckId` (legacy data, race on assignment), header shows higher count than dispatch row. |
| F4 | **MEDIUM** | "pending loads" semantic | `pendingLoads` count in tile = `db.loads.filter(status==='pending').length` (line 5015) | `cyPending` in same tile = `sum(volumeCY - delivered)` over non-completed reqs (line 5050) | Same project tile shows both "5 pending loads" footer and "+5,018 CY pending" badge | These are different concepts (loads awaiting admin approval vs CY-of-demand still to deliver) sharing the word "pending" — but the user reads them as the same thing. Either rename or align. |
| F5 | LOW | "delivered CY for hauler on a haul" | `HaulerLanding.haulsForHauler` (line 11095): filters `db.loads` by `myTruckIds` | `dollarsForRequest` doesn't filter by hauler — sums all hours on the req regardless of hauler | If a haul has trucks from multiple haulers, the "delivered CY" hauler sees on their card is correctly hauler-scoped, but the "revenue" they'd compute via `dollarsForRequest` would include other haulers' hours. Internally HaulerLanding uses its own per-hauler `lineItems` calc (line 11119) so the displayed amount is correct — but anyone reusing `dollarsForRequest` for a per-hauler context would over-count. |
| F6 | LOW | "live operations" map caption vs rendered pins | caption: `projectPoints.length + pickups + drops + haulers` derived from `db.geocode` + filtered haulRequests (line 5252+) | rendered pins: marker DOM nodes added by markers `useEffect` after style loads | caption claims "5 haulers" but if CartoCDN style fails to load, 0 markers render. User sees the count but not the dots. |
| F7 | reference (FIXED in `dc733da`) | "demand for project" | `project.volumeCYNeeded` (stale seed) | `sum(haulRequests.volumeCY)` | progress bar vs HAS/NEEDS pill | — |

---

## Per-finding detail

### F1 (HIGH) — `loadsCompleted` filter mismatch with `cyCompleted`

```js
// index.html line 5014-5049
const projLoads = (db.loads || []).filter(l => l && l.projectId === p.id);
const loadsCompleted = projLoads.filter(l => l.status === 'approved').length; // ← APPROVED only
const cyCompleted = reqs.reduce((s, r) => s + deliveredCYForRequest(r, db), 0); // ← no filter
```

`deliveredCYForRequest` (line 2427) sums `db.loads[].cy` regardless of status. So pending loads' CY counts toward "delivered" but their COUNT doesn't count toward "loads completed."

**Fix options for Robert to choose:**
- (a) `loadsCompleted` counts all loads (drop `'approved'` filter) — matches CY's permissive semantics
- (b) `deliveredCYForRequest` filters by `status === 'approved'` — matches loads' gated semantics (more conservative; changes every site that uses the helper — invoice generator, dispatch row, haul-detail header)
- (c) leave both, add "(approved)" / "(includes pending)" suffixes so the gating is visible

I'd recommend **(a)**: the `'approved'` gate on loads predates the canonical delivered-CY helper and was probably a leftover from when admin approval was the official "delivered" signal. Now `db.loads` only has rows the driver logged, which IS the delivery. Approval is a separate billing step.

### F2 (MEDIUM) — `trucksActive` per-project vs global

```js
// per-project (line 5011, 13228)
const trucksActive = trucks.filter(t =>
  t.driverId && db.hours.some(h => h.truckId === t.id && h.status === 'open')
).length;

// global KPI (line 10144) — NO driverId filter
const activeIds = new Set(db.hours.filter(h => h.status === 'open').map(h => h.truckId));
trucksActiveAll = activeIds.size;
```

If a shift was started before the driver was assigned (or after unassignment), the truck appears in the global KPI but not in the project tile. Sum-of-tiles ≠ global KPI.

**Fix:** align the global KPI to also require `t.driverId`. Single-file fix, low risk if "trucks active" is supposed to mean "has driver + clocked in" everywhere (almost certainly).

### F3 (MEDIUM) — `assignments.length` vs `assignedTruckCountForRequest`

```js
// dispatch row (line 7650) — dedupes
{assignedTruckCountForRequest(e.r)} truck{assignedTruckCountForRequest(e.r) === 1 ? '' : 's'}

// haul detail header (line 9337) — raw .length
`${assignments.length} truck${assignments.length === 1 ? '' : 's'} assigned`

// also raw .length at line 9044
{assignments.length === 0 ? 'no trucks' : assignments.length + ' truck' + (assignments.length === 1 ? '' : 's')}
```

A canonical helper exists (`assignedTruckCountForRequest`, line 2487). Two other surfaces don't use it. **Fix:** swap the two raw `.length` calls to use the helper. Trivial, low risk.

### F4 (MEDIUM) — "pending" ambiguity

`pendingLoads` = unapproved-load count. `cyPending` = remaining demand (volume - delivered). Same word, two meanings. Same tile shows both. **Fix:** rename one (e.g. `cyRemaining` for the demand-side, keep `pendingLoads` for the approval-queue), or visually distinguish with different labels in the UI.

### F5 (LOW) — hauler-scoped vs all-scoped revenue helpers

`HaulerLanding` builds its own `lineItems` (line 11113) to compute per-hauler revenue and doesn't call `dollarsForRequest`. That's correct because the helper sums ALL hours on a request regardless of hauler. Risk surfaces only if a future caller naively uses `dollarsForRequest` in a hauler-scoped context. **Fix:** either rename the helper to `dollarsForRequestAcrossAllHaulers` for clarity, or add a hauler-id param and have it filter.

### F6 (LOW) — LOM caption vs rendered pins

The caption "3 projects · 3 pickups · 2 drops · 5 haulers" comes from the same `useMemo`s that build the marker list — they don't diverge in COUNT. They diverge in RENDER only when the map style fails to load (CartoCDN unreachable / WebGL disabled). The caption is honest about what *should* render but doesn't reflect what *did*. **Fix:** gate the caption on `map.isStyleLoaded()`, or surface an "tiles offline" sub-label when style hasn't loaded after N seconds.

---

## Not finding-worthy but noted

- **Legacy shadows in `AdminHaulers` enrichment** (line 10591-95) compute `legacyTotalHours` / `legacyTotalRevenue` alongside the canonical `haulerRollupV31` values. They're kept in scope but NOT displayed anywhere I could find — dead code. Safe to delete in a follow-up sweep.
- **Invoice line items `deliveredCY` is informational only** (line 11130, 12058, 12868) — never multiplied into the amount. Comment is explicit. No divergence risk because the amount column reads `li.amount` (hours × rate), not the CY.
- **`materialType` derivation** uses `project.material[0]` consistently across the codebase. No divergence.

---

## Recommended prioritization

| Order | Action | Risk | Effort |
|---|---|---|---|
| 1 | F2 — align global "Trucks active" KPI to require `driverId` | low | 1 line |
| 2 | F3 — swap raw `.length` to `assignedTruckCountForRequest` (2 sites) | low | 2 lines |
| 3 | F1 — decide approval-gating semantics, then align loads + CY | medium | 1-3 lines depending on choice |
| 4 | F4 — rename one of the "pending" fields | low | grep + rename |
| 5 | F6 — gate LOM caption on map.isStyleLoaded | low | 5 lines |
| 6 | F5 — clarify `dollarsForRequest` scope | very low | comment-only |

None of these match the `dc733da` "stale seed beats live aggregate" pattern strongly enough to ship inline without a UX call from Robert — F1 in particular changes a count semantic that downstream users may have grown to rely on. Hold for direction.
