# Jobsite Exchange

Single-file React mockup of a construction-site coordination tool. Three roles cover the workflow: **Admin** is the HQ view for project setup and reporting, **Operator** is the onsite team lead managing trucks and the drivers assigned to them, and **Driver** is the field user on a phone logging loads and shifts. State lives in an in-memory `db` seeded at startup and hydrated from `localStorage` under the key `jse_db_v1`, so changes persist across reloads on the same browser.

**Live demo:** https://www.jobsiteexchange.com

## Quick start

```bash
git clone https://github.com/blaudick-cell/jobsite-mockup.git
cd jobsite-mockup
```

Then either open `index.html` directly in a browser, or serve it locally (any static server works):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

No build step. No dependencies to install.

## Architecture

- Single `index.html`. All UI, state, and seed data live in one file.
- React 18 + Babel loaded via CDN (no bundler, no transpile step).
- Hash-based routing (`#/admin`, `#/operator`, `#/driver`) — `App` reads `window.location.hash`.
- In-memory `db` (projects, operators, trucks, drivers, hours, loads, invoices, rates) seeded on first load.
- localStorage hydration under key `jse_db_v1` — every `setDb` writes through, every reload reads back.
- Deployed via Netlify auto-deploy from `main`.

## The three roles

### Admin

HQ view. Creates projects, assigns operators, and assigns trucks. Lives on `/admin`. Includes the project creation wizard (`/admin/new`) and the cross-organization reporting view (`/admin/reports`).

### Operator

Onsite team lead. Manages their assigned projects, the trucks under those projects, and the drivers on each truck. Drills from project to truck to driver.

### Driver

Field user on a phone. Clocks in and out per truck, logs loads, and sees the day's assignments. Rendered inside a phone frame (`Phone` component) so the UI shows what a driver actually sees in the field. Routes: `/driver`, `/driver/truck/:id`, `/driver/log/:id`.

## Reset demo data

The Reset demo data button in the Admin Topbar clears the `jse_db_v1` localStorage key and reloads the page. Or manually: open devtools → Application → Local Storage → delete `jse_db_v1`.

## Sub-agents

`.claude/agents/` contains four Claude Code sub-agents this project iterates with: `explorer`, `builder`, `reviewer`, `deployer`. Each feature ships through that 4-step pipeline.

## License

MIT — see LICENSE.
