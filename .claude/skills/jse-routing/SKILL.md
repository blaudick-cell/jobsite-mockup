---
name: jse-routing
description: Hash routing model for the JSE mockup. useHash hook, route table per shell, canonical /hauler vs legacy /operator alias, scroll patterns, document title updates.
---

# JSE Routing

Hash-based client-side routing via `useHash()` (Block 1). Pattern: `#/path/to/thing/:id`. All deep links survive page refresh because the hash is preserved in localStorage-free state.

## `useHash()` hook

```js
const [hash, navigate] = useHash();
```

Returns the current `hash` string (always starts with `/`) and a `navigate(path)` setter. Listens for `hashchange` events so external nav (back/forward buttons, manual URL edits) re-renders.

**Aliasing:** `useHash` rewrites `/operator[...]` → `/hauler[...]` on read so both URL forms route to the same shell. `/hauler` is canonical; `/operator/*` is the legacy alias kept for backward compat (early demos shared the operator URL). Internal `navigate()` calls always emit `/hauler/...`.

## Route table

`App` dispatches on `hash.split('/')[1]` to a shell:

### Root
- `/` → `<Landing />`

### AdminShell (`/admin/*`)
- `/admin` → `AdminProjects`
- `/admin/p/:projId` → `AdminProject`
- `/admin/p/:projId/o/:haulerId` → `AdminHaulerProject` (per-project drill-down)
- `/admin/p/:projId/o/:haulerId/t/:truckId` → `AdminTruck`
- `/admin/new` → `AdminNewProject` (wizard)
- `/admin/reports` → `AdminReports`
- `/admin/activity` → `AdminActivity`
- `/admin/requests` → `AdminHaulRequests`
- `/admin/requests/:reqId` → `AdminHaulRequestDetail`
- `/admin/haulers` → `AdminHaulers`
- `/admin/haulers/:haulerId` → `AdminHaulerDetail` (cross-project hauler footprint)
- `/admin/haulers/new` → `AdminNewHauler` (wizard)
- `/admin/drivers/new` → `AdminNewDriver` (single-step wizard)
- `/admin/trucks/new` → `AdminNewTruck` (wizard)

Length-3 routes use `parts[2] !== 'new'` guards so `/admin/haulers/new` resolves to the wizard, not the detail page.

### HaulerShell (`/hauler/*` canonical, `/operator/*` alias)
- `/hauler` → `HaulerLanding` (pick a hauler)
- `/hauler/o/:haulerId` → `HaulerHome`
- `/hauler/o/:haulerId/p/:projId` → `HaulerProject`
- `/hauler/o/:haulerId/p/:projId/t/:truckId` → `HaulerTruckView`

### DriverShell (`/driver/*`)
- `/driver` → `DriverHome` (1 truck) / `DriverMultiTruckHome` (>1) / `DriverNoTruck` (0)
- `/driver/truck/:truckId` → `DriverTruckDetail`
- `/driver/log/:truckId` → `DriverLogLoad`

## Scroll patterns

- **Wizard scroll-to-top on step change.** `WizardShell` runs `useEffect(() => window.scrollTo(0, 0), [currentStep])` so each step lands at the top. See [[jse-wizards]].
- **Brand-mark click → `#hero`.** Landing's header wraps `<Brand />` in a `<button onClick={() => scrollTo('hero')}>` for the "back to top" pattern.
- **In-page anchors.** Landing has `<section id="hero">`, `id="who-its-for"`, `id="how-it-works"`, `id="value"`, `id="demo"`. CTAs use `document.getElementById(id)?.scrollIntoView({behavior: 'smooth'})`.
- **CSS:** `html { scroll-behavior: smooth }` wrapped in `@media (prefers-reduced-motion: no-preference)`. `section[id] { scroll-margin-top: 24px }` to keep anchors below any sticky chrome.

## Document title updates

`App` has a `useEffect` keyed on `[hash, db]` that sets `document.title` per route. Entity-aware for detail routes:

- `/` → `'Jobsite Exchange'`
- `/admin` → `'JSE — Admin'`
- `/admin/p/:id` → `'JSE — Admin — {project.name}'`
- `/admin/p/:id/o/:hauler` → `'JSE — Admin — {project.name} / {hauler.name}'`
- `/admin/reports` → `'JSE — Reports'`
- `/admin/activity` → `'JSE — Activity'`
- `/admin/requests` → `'JSE — Haul Requests'`
- `/admin/haulers/:id` → `'JSE — Hauler — {hauler.name}'`
- `/hauler/o/:id` → `'JSE — Hauler — {hauler.name}'`
- `/driver/truck/:id` → `'JSE — Driver — Truck #{truck.plate}'`
- `/driver/log/:id` → `'JSE — Driver — Log load'`

Falls back to the parent generic title when entity isn't found.

## Cross-refs

[[jse-design-system]] · [[jse-data-model]] · [[jse-wizards]] · [[jse-realtime]] · [[jse-ship-a-feature]]
