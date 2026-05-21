---
name: jse-ship-a-feature
description: Workflow for shipping a change to the Jobsite Exchange mockup. 4-agent pipeline, deployer protocol, schema migration cascade, 7-block script layout, single-file constraint, deploy target.
---

# JSE Ship a Feature

Every change goes through this pipeline. Follow it.

## 4-agent pipeline (`.claude/agents/`)

Run them serially:

1. **explorer** — read-only. Maps the relevant code so the builder doesn't guess. Give it specific questions with file paths; ask for line citations. Don't let it propose designs.
2. **builder** — single-file edits to `index.html` (+ skill md when schema/UX conventions change). Brief inline with explorer findings; state priorities and what's out of scope.
3. **reviewer** — reads the actual diff, not the builder summary. Returns blocking / should-fix / nits.
4. **deployer** — commits + pushes + verifies live. Follows the strict deployer protocol below.

When the reviewer flags 1-2 trivial fixes, apply them inline (Read + Edit) rather than spinning a new builder.

## Deployer protocol (load-bearing)

After `git push`:
- MUST run a fresh `curl -sI https://jobsite-mockup-demo.netlify.app/` in this turn and quote the literal `Etag` / `Age` / `Content-Length` / `X-Nf-Request-Id` verbatim. No values from memory.
- MUST run a fresh `curl -s ... | grep -E -c "<markers>"` to confirm the new bundle ships expected strings.
- **Stale-etag self-check.** If the reported etag matches ANY prior deploy etag in this conversation, STOP, re-curl, check `Age` (>120s means edge serving stale), wait 30-60s and re-fetch. Never report a cached value as proof of deploy.
- Sanity check `Content-Length` against `git diff --stat` — a multi-line diff that produces a 0-byte delta is suspicious.

## Hard constraints

- **Deploy target is `https://jobsite-mockup-demo.netlify.app` ONLY.** `https://www.jobsiteexchange.com/` is a SEPARATE PRODUCT with its own locked/restored deploy and ~1.7KB real-site bundle. **NEVER deploy mockup commits there.** Always include the apex domain in deploy verification as a sanity check (Content-Length should stay at 1,711; etag should stay stable across mockup deploys).
- **Single-file edits to `index.html`** + the corresponding `.claude/skills/*/SKILL.md` when schema/UX conventions change.
- **No new deps. No build step. No chart libs** — hand-roll SVG ([[jse-charts]]).
- **Don't break existing flows.** Mobile responsive intact ([[jse-design-system]]). Cross-tab sync intact ([[jse-realtime]]). Reset still works.
- Git credentials cached in `.git-credentials` — pushes go through silently.
- Never force-push, never `--no-verify`, never push to a non-`main` target branch (push your feature branch with `branch:main` refspec).

## 7-block script layout

`index.html` is split into 7 `<script type="text/babel" data-presets="react">` blocks (no `data-type="module"` — classic-script globals share scope). New code goes in the right block:

1. **Tokens + Shared Components** — `C/T/F/R/S`, helpers (`calcHours`, `isToday`, `useHash`), all shared components (`Btn`/`Card`/`Topbar`/`StatusPill`/`EmptyState`/`WizardShell`/`Sparkline`/`BarChart`), all icons.
2. **Seeds + Persistence** — `*_SEED` constants, `DB_STORAGE_KEY`, `DB_SCHEMA_VERSION`, `DB_REQUIRED_KEYS`, `buildSeed`, `hydrateDb`, `appendActivity` + name helpers, `ACTIVITY_SEED`.
3. **Landing** — `Landing` only.
4. **Admin + Wizards** — every `Admin*` component, all four wizards, `AdminSidebar`, `AdminShell`.
5. **Hauler** — every `Hauler*` component + `HaulerShell`.
6. **Driver** — `Phone`, `DriverShell`, `DriverHome`/`DriverMultiTruckHome`/`DriverTruckDetail`, `DriverIncomingRequests`, `DriverLogLoad`.
7. **App + Mount** — `RemoteUpdateContext`, `App`, `ReactDOM.createRoot(...).render(<App />)`.

## Schema migration

**`DB_SCHEMA_VERSION` is currently 16.** Migration cascade in `hydrateDb` — every step forward-only, idempotent, wrapped in try/catch, falls back to seed on failure. See [[jse-data-model]] § Schema version log for the full history.

To bump:
1. Increment `DB_SCHEMA_VERSION`.
2. Add the new key/field to `DB_REQUIRED_KEYS` if it's load-bearing, but NOT to `baselineKeys` inside `hydrateDb` (so older payloads still pass structural sanity and migrate forward).
3. Add a forward-migration branch that destructures + remaps stale data.
4. Update `buildSeed()` to emit the new shape.

## Verification recipe

- Netlify deploy is `ready` (fresh etag; `Age: 0-30`).
- Live HTML contains marker strings introduced by the change.
- Shells intact: `AdminShell|HaulerShell|DriverShell` ≥3 hits.
- jobsiteexchange.com Content-Length still 1,711 (untouched).

## Out of scope

Push back on: "while you're in there, refactor X", "add a build step", "move to TypeScript/bundler", "add an API". The mockup's value is being one static file that runs anywhere.

## Cross-refs

[[jse-design-system]] · [[jse-data-model]] · [[jse-routing]] · [[jse-realtime]] · [[jse-wizards]] · [[jse-charts]] · [[jse-activity-feed]]
