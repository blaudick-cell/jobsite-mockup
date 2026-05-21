---
name: jse-activity-feed
description: Append-only event log of user-visible mutations. appendActivity composer, type vocabulary, grouped reverse-chrono view, unread badge, mark-as-read.
---

# JSE Activity Feed

A running log of every user-visible mutation: load logged, shift started, request matched, project created, etc. Lives in `db.activity` (added v6). Surfaced as an admin sidebar entry with unread badge + grouped feed view at `/admin/activity`.

## `appendActivity` composer (Block 2)

```js
function appendActivity(state, evt) {
  return {
    ...state,
    activity: [
      ...(state.activity || []),
      {
        id: 'act-' + Math.random().toString(36).substring(2, 7),
        type: evt.type,
        actorRole: evt.actorRole,
        actorId: evt.actorId || null,
        summary: evt.summary,
        refId: evt.refId || null,
        timestamp: Date.now(),
      },
    ],
  };
}
```

**Pattern — compose inside any tracked `setDb`:**

```js
setDb(prev => appendActivity(
  { ...prev, loads: [...prev.loads, newLoad] },
  { type: 'load.logged', actorRole: 'driver', actorId: drId, summary: `${driver.name} logged ${newLoad.cy} CY of ${materialLabel(newLoad.material)}`, refId: newLoad.id }
));
```

**Why one composer instead of inline events:** keeps each setDb atomic (mutation + event in one transaction → no race where peer tabs see one without the other). Also keeps the event-creation noise out of the call site.

## Type vocabulary (12 current types)

Dotted strings. Add new types freely — there's no type registry to update; the feed renders `summary` directly.

| type | actorRole | typical summary |
|---|---|---|
| `load.logged` | `driver` | "M. Ortega logged 18 CY of Clean Fill" |
| `load.approved` | `hauler` | "Priya Sharma approved 22 CY of Topsoil" |
| `load.rejected` | `hauler` | "Priya rejected 14 CY of Class 5 Base" |
| `hours.approved` | `hauler` | "Marcus Lane approved 8.5h on #447" |
| `shift.started` | `driver` | "J. Bui clocked in on #155" |
| `shift.ended` | `driver` | "M. Ortega clocked out — 7.2h" |
| `invoice.sent` | `hauler` / `admin` | "Priya Sharma sent invoice INV-2026-04 to GC" / "Admin sent invoice INV-3050 to Lake Trail Homes (Marcus Lane)" |
| `invoice.paid` | `admin` | "Admin marked invoice INV-3041 paid (ref: ACH-44291) for Marcus Lane" |
| `project.created` | `admin` | "Admin created project Capitol Hill Mixed-Use" |
| `hauler.created` | `admin` | "Admin added Acme Hauling as a hauler" |
| `driver.created` | `admin` | "Admin added M. Ortega as a driver" |
| `truck.created` | `admin` | "Admin added truck #889 (Side Dump)" |
| `haulRequest.matched` | `admin` | "Matched 25 CY Clean Fill to Marcus / #447" |
| `haulRequest.accepted` | `driver` | "M. Ortega accepted 18 CY of Clean Fill" |
| `haulRequest.passed` | `driver` | "S. Park passed on 22 CY of Topsoil" |

## Helpers for summary text (Block 2)

`driverName(state, id)`, `haulerName(state, id)`, `projectName(state, id)`, `truckPlate(state, id)`, `materialLabel(code)`. Use these inside summaries so the feed reads as full sentences with no IDs.

## The view: `AdminActivity` at `/admin/activity` (Block 4)

- Crumbs `Admin / Activity`. Page title `JSE — Activity` ([[jse-routing]]).
- Events sorted reverse-chronologically, grouped by day: `Today`, `Yesterday`, or `isoToShortDate(iso)` for older.
- Each row: timestamp (HH:MM), small actor avatar (initials from name), summary, click-through to `refId` source entity.
- Click routing by `refId` prefix: `ld-` → project page, `tk-` → hauler page, `op-` → `/admin/haulers/<id>`, `dr-` → `/admin/haulers` (no flat drivers view), uppercase project codes → `/admin/p/<id>`, `hreq-` → `/admin/requests/<id>`. Unknown refs no-op.

## Unread badge + mark-as-read

`db.activityLastReadAt` (number, added v6) stores the timestamp of the most-recent event the admin has viewed. Sidebar computes:

```js
const unreadCount = (db.activity || []).filter(a => a.timestamp > (db.activityLastReadAt || 0)).length;
```

Badge renders on the Activity sidebar item when `unreadCount > 0`.

On mount of `AdminActivity`, a `useEffect` (guarded by `useRef` so it fires once per mount) advances `activityLastReadAt` to the max timestamp:

```js
const markedRef = useRef(false);
useEffect(() => {
  if (markedRef.current) return;
  markedRef.current = true;
  const latest = Math.max(...activity.map(a => a.timestamp), db.activityLastReadAt || 0);
  setDb(prev => ({ ...prev, activityLastReadAt: latest }));
}, []);
```

## Cross-tab (free via [[jse-realtime]])

The storage event re-renders activity automatically — no extra wiring. Peer tab logs a load → tab B's listener calls `hydrateDb(e.newValue)` → `setDb(next)` → AdminSidebar re-reads `unreadCount` and the activity feed re-orders.

## Where to instrument when shipping a new feature

Anywhere a user makes a meaningful, observable change. Examples (all currently instrumented):

- `DriverLogLoad.submit`, `HaulerLogLoadForm.submit` (load.logged)
- `DriverHome.clockIn`/`clockOut`, `DriverTruckDetail.clockIn`/`clockOut` (shift.started/ended)
- `HaulerApprovals.approveLoad`/`rejectLoad`/`approveHr` (load.approved/rejected, hours.approved)
- `HaulerInvoices.sendInvoice` (invoice.sent)
- `AdminNewProject`/`AdminNewHauler`/`AdminNewDriver`/`AdminNewTruck` submit ({entity}.created)
- `AdminHaulRequestDetail.assign` (haulRequest.matched)
- `DriverIncomingRequests.acceptRequest`/`passRequest` (haulRequest.accepted/passed)
- Inline `AddHaulerForm`/`AddTruckForm` create paths instrumented too — match the wizards' coverage to keep the feed coherent.

**Skip noisy mutations**: inline `EditableText` field edits, clock pause/resume, internal navigation. Rule of thumb: if a 10-person team would say "that should show up in the feed", instrument it.

## Cross-refs

[[jse-data-model]] § Activity events · [[jse-realtime]] · [[jse-routing]] · [[jse-ship-a-feature]] · [[jse-design-system]]
