---
name: project-site-contractor-vs-hauler
description: "Two distinct concepts on a job (haul_request) — Site Contractor / Owner (single) and Assigned Hauler / Dispatcher (multiple, derived). Avoid conflating them when reading or editing job-related UI."
metadata: 
  node_type: memory
  type: project
  originSessionId: d1c74e75-6cc8-41d9-929c-b6fdd1879490
---

A `haul_request` has TWO distinct contractor-like fields. Easy to conflate; the codebase historically did.

**Site Contractor / Owner** — `haul_requests.contractor_name`
- Free-text. The GC who owns the dirt or pays the bill.
- Editable inline on Job detail top tile.
- ONE per job. Renders in the Job detail header next to the Status pill.
- Was previously mislabeled "Contractor / Dispatcher" before commit `8f33d8e` (2026-06-02) renamed it.

**Assigned Hauler / Dispatcher** — `haul_requests.assigned_hauler_id` + DERIVED from sessions
- FK to `haulers.id`. The trucking contractor whose drivers work the job.
- **MULTIPLE per job as of commits `05e4203` + `1bd06d8` (2026-06-03)** — derived from `driver_sessions.hauler_id` where `haul_id = job.id` (distinct).
- `assigned_hauler_id` is the "Primary Contractor / Dispatcher" — picked at job creation, used as a tiebreaker in form cascades, kept for jobs with no tickets yet.
- Additional contractors auto-join when any of their drivers' tickets land on the job. They drop off when the last ticket for them is detached.
- Renders as a chip row on Job detail header (Primary chip is filled accent, others outline).

**Why:** Pre-derivation, the Reports / Contractor rollup filtered jobs by `assigned_hauler_id` only, so Z&Z showed `$0 invoiced · 0 hauls` despite David Vasquez billing 3 days of real work on a haul where Z&Z was the assigned hauler — the rollup's underlying read was `haul_requests.assignments[]` + `db.loads` (both purged in the e-ticket pivot). Sessions are the source of truth post-pivot ([[reference-jse-mockup-supabase]]).

**How to apply:**
- When showing "who's working this job" — derive from sessions, don't read `assigned_hauler_id` alone. The canonical helper is `dispatchersForHaul` on AdminHaulRequestDetail; AdminReporting builds the same derivation locally via `live.buckets` from `useDriverSessionsLive()`.
- When showing "who's responsible for the site" — read `contractor_name`. Single string.
- When generating Final Invoice: ONE invoice per haul, multi-hauler lineItems. Each hauler's "portion" is the sum of lineItems where the driver belongs to that hauler.
- When generating Settlement Statement: per-dispatcher, dropdown sourced from the derived list.

Related: [[reference-jse-mockup-supabase]] (snake↔camel adapter — `assigned_hauler_id` ↔ `assignedHaulerId`).
