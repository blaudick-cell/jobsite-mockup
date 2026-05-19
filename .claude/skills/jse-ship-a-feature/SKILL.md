---
name: jse-ship-a-feature
description: Workflow for shipping a change to the Jobsite Exchange mockup. Covers the 4-agent pipeline (explorer → builder → reviewer → deployer), the single-file constraint, persistence semantics, Netlify auto-deploy, and the verification step.
---

# JSE Ship a Feature

This project ships every feature through a fixed pipeline. Follow it.

## The 4-agent pipeline

Definitions in `.claude/agents/`. Run them serially:

1. **explorer** — read-only. Maps the relevant code so the builder doesn't guess. Give it specific questions with file paths; ask for line citations. Don't let it propose designs — that's the builder's job.
2. **builder** — single-file edits to `index.html`. Brief it with explorer findings inline (don't make it re-explore). State priorities, conventions to match, and what's out of scope.
3. **reviewer** — checks correctness, consistency, mobile, persistence, and that existing flows aren't broken. Reads the actual diff, not the builder summary. Returns blocking / should-fix / nits.
4. **deployer** — commits and pushes to `main`. Verifies the Netlify deploy is live by fetching the URL and grepping for marker strings.

**Why:** parallel work and unclear handoffs caused conflicts early on (see [[jse-design-system]] for the persistence-PR collision story). Serial agents with explicit context don't drift.

**How to apply:** when a reviewer flags 1-2 trivial fixes, apply them inline (Read + Edit) rather than spinning up another builder agent. Spawn another builder only when fixes are substantial.

## Hard constraints

- **Single-file edit.** Everything lives in `index.html`. No new source files. No new directories. The skills + agents under `.claude/` are dev-only.
- **No new dependencies.** React 18 + Babel via CDN. No bundler. No npm. No build step.
- **No new className hooks.** Use existing tokens + inline styles. Extend the existing `<style>` block at `index.html:12-240` for CSS-only concerns.
- **Don't touch persistence wiring.** The lazy `useState` init reading `localStorage.getItem('jse_db_v1')` and the `useEffect` that writes on every db change are stable. New mutations via `setDb` persist automatically.
- **Don't break desktop when adding mobile.** Always test at both viewport sizes (the responsive CSS rules at `index.html:12-240` cover most of it).

## Persistence semantics

- Key: `jse_db_v1`. Lazy hydrate on mount with a structural sanity check. Writes via `useEffect` on every `db` change.
- **No migration.** If the seed schema changes, users with stale localStorage see broken UI silently. When you add a new required field on an existing collection (like `date` on loads), either add a migration step OR document that users need to hit "Reset demo data". See [[jse-data-model]] for the current shape.
- "Reset demo data" lives in the AdminShell Topbar `right` slot. Don't add another reset elsewhere.

## Deploy

- Push to `main` on `https://github.com/blaudick-cell/jobsite-mockup.git`. Netlify auto-deploys.
- Custom domain: `https://www.jobsiteexchange.com`. Netlify subdomain: `https://jobsite-mockup.netlify.app`. Both serve the same bundle.
- Verify the deploy is live by `curl -s https://www.jobsiteexchange.com/ | grep -c "<unique-marker-from-your-change>"` — at least one occurrence confirms the new bundle is being served. Netlify usually rebuilds within 5-15s of push.
- Etag rotates on every deploy. `curl -sI` will show the change.

## Conflict resolution

If the push is rejected as non-fast-forward, someone shipped to `main` in parallel. Rebase onto `origin/main`, resolve conflicts deferring to whatever's already on `main` for shared features (you don't get to "win"), then push. Don't force-push to `main`.

## What out-of-scope looks like

- "While you're in there, also refactor X."
- "Add a build step."
- "Move to TypeScript / a bundler / a separate state library."
- "Add an API."

Push back on any of these. The mockup's value is in being a single static file that runs anywhere with no setup.

## Gotchas worth knowing

- **`NOW_MIN`** (`index.html:487`) is the frozen "now" used by `calcHours`. Live shifts compute against `NOW_MIN`, not real time, so timing math stays deterministic.
- **`window.matchMedia('(hover: hover)')`** isn't used yet — touch-device hover-sticking on Landing cards is a known followup.
- **`.claude/launch.json`** is a preview-server config that should stay untracked (it's in `.gitignore`).
- **`.claude/worktrees/`** is where Claude Code creates ephemeral worktrees — also gitignored.
- Schema doesn't have a version field. If you bump it, add one.
