---
name: reference-jse-mockup-supabase
description: "Supabase project facts for the JSE mockup project — now the canonical operational store after Phase 2 unification (2026-05-29). Real-JSE project is a read-only archive."
metadata:
  node_type: memory
  type: reference
  originSessionId: cfe0b862-af2a-46a7-a64d-e42991601970
---

The JSE mockup Supabase project is now the **canonical operational data store** for the production driver widget (`driver.jobsiteexchange.com`) and dispatch dashboard (`dispatch.jobsiteexchange.com`). It is no longer "the demo / mockup" exclusively — as of 2026-05-29 it serves every live driver write, every dispatcher read, every realtime subscription.

## Project facts (canonical)

- Project ref: `naqqlztgbayxcgfphrxg`
- API URL: `https://naqqlztgbayxcgfphrxg.supabase.co`
- Publishable key (safe to embed — RLS protects data): `sb_publishable_oA0wnxRiDG2QzXIeNT3zLQ_3YikcDRl`
- 12 mockup-side tables with permissive RLS: `projects`, `haulers`, `drivers`, `trucks`, `materials`, `rates`, `loads`, `hours`, `invoices`, `haul_requests`, `activity`, `meta`
- 4 driver+dispatch ops tables migrated in from real-JSE during Phase 1/3: `driver_sessions`, `truck_events`, `event_photos`, `issue_reports`. Schemas are byte-identical to what real-JSE had.
- Storage bucket `driver-photos` mirrors real-JSE's subdir layout: `events/`, `issues/`, `plates/`, `trucks/`
- Complex nested JS shapes (`assignments[]`, `attachments[]`, `siteAccess`, `timing`, `pickupLocation`, `dropoffLocation`) → `jsonb` columns
- snake_case in SQL, camelCase in JS — thin adapter on both sides
- `meta` table stores `schema_version` for client-side migration cascade detection

## Real-JSE legacy project — read-only archive

- Project ref: `pmfxzedlezybfooqvojv` — **no new writes from any client**
- Phase 3 (2026-05-29) one-way cloned every row + storage object into mockup. 47 sessions + 203 events + 17 photo rows + 7 issues + 30 storage objects (67.4 MB) carried across with IDs preserved. Photo URLs in copied rows rewritten to the mockup hostname.
- Stays in place as historical record. Phase 7 will retire it eventually.
- If you need to debug the cut-over, the Phase 3 backfill script is at `C:\Users\blaud\AppData\Local\Temp\jse-phase3-backfill.py` and the summary at `C:\Users\blaud\AppData\Local\Temp\claude\phase3-backfill-summary.md`.

**Why:** Robert wants a single unified data source. Real-JSE accumulated production data while the React mockup was developed in parallel against its own Supabase; the unification plan (Phases 1 → 7) collapses them into one project so the React app, the driver widget, and the dispatch dashboard all read from and write to the same tables.

**How to apply:**
- When changing data shape in `index.html` (the React mockup) or in `jse-ops/index.html` / `jse-ops/dispatch-live.html`, the target is always `naqqlztgbayxcgfphrxg`.
- Do NOT issue writes against `pmfxzedlezybfooqvojv` — it is archive-only.
- If a JS field is missing on Supabase, write `outputs/supabase-migrations-needed.md` and surface — do NOT apply Supabase migrations yourself (Dispatch applies via Supabase MCP).

See also: [[jse_project_context]] for the broader repo layout.
