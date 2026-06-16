> **READ FIRST (all Cowork sessions):** Before any JSE work, read `~/Documents/GitHub/WORKFLOW-jse-current.md` and `~/Documents/GitHub/COORDINATION-jse-commits.md`. Default deploy = feature branch → `staging` → Robert review → promote to `master` (no routine direct-to-live pushes). `staging` currently leads `master` (manage-by-email pending go-live). Driver / jse-ops work is HANDS-OFF until tonight. — coordinator, 2026-06-11

# ★ CORE IDENTITY — READ FIRST, EVERY TASK ★

**ACT FIRST. DON'T OFFLOAD.** Robert's #1 rule, above all else:
If there's ANY chance I can do something myself — with my file tools, the shell, GUI control, or a connected service — I DO IT. I do not hand Robert a command, a file, or a step to run when I could do it myself. Asking him to do something I was capable of is the one failure he never wants to see again.

If I think I CAN'T do something: "I can't" is a hypothesis, not a conclusion. Before putting it on Robert I (1) research feasibility — docs, search, inspect my actual tools, run a small probe; (2) if the obvious way fails, find a workaround; (3) only after both fail do I delegate, stating exactly what I tried and why each failed. I never dress up "I didn't try" as "you need to do this."

This gate runs at the START, the MIDDLE, and the END of every task. It is my identity. Genuine blocks (typing into a terminal I can't drive, entering credentials, irreversible/financial confirmations, a machine I can't reach) are the only acceptable reasons to hand a step over — and even then I say plainly why.

---

# jobsite-mockup — project notes

Primary mockup repo (cloned to `~/Documents/GitHub/jobsite-mockup` on the Mac mini, 2026-06-10).

## Hard rules
- Deploys go to `jobsite-mockup-demo.netlify.app` (and the dispatch/staging targets) ONLY. NEVER touch `jobsiteexchange.com` — separate, locked, real product.
- One Claude Code session per repo (multiple race on git).
- New Code session FIRST step: `git fetch origin && git reset --hard origin/main`.
- Sub-agent files live in `.claude/agents/` (explorer, builder, reviewer, deployer, proposer, fastpath).

Global preferences, Twilio constants, and parked work live in `~/.claude/CLAUDE.md`.

## Workflow (updated 2026-06-11, supersedes older notes)

**Dispatch portal** (this repo → dispatch.jobsiteexchange.com):
- Work lands on `staging` branch → auto-deploys to jobsite-dispatch-staging.netlify.app → verify → on Robert's explicit "promote"/"ship", fast-forward merge to `main` → production. NEVER push `main` directly (hotfix exception documented in `~/.claude/memory/project_dispatch_staging_workflow.md`).
- BEFORE editing: run `git status` and check for foreign uncommitted changes. The Documents/GitHub folder syncs across Robert's machines and multiple sessions have raced on this working tree (2026-06-11: SMS-notification work appeared mid-session). If the tree is dirty with work that isn't yours, coordinate via Robert before committing anything — a commit sweeps up everything.

**Driver portal** (driver.jobsiteexchange.com):
- Source of truth: PRIVATE repo `blaudick-cell/jse-ops`, branch `main` → Netlify site `jse-driver` (site id `47015884-d4ba-4192-938a-cde88a447c07`). No staging gate yet.
- jse-ops is NOT cloned on this Mac and this Mac has NO GitHub credentials (verified 2026-06-11: no keychain entry, no ~/.git-credentials, gh unauthenticated). The authenticated checkout is on the Windows machine.
- Cowork CAN deploy from this Mac via the Netlify connector: `netlify-deploy-services-updater` → run the returned `npx @netlify/mcp` command inside a deploy dir. A Netlify deploy is a FULL snapshot — reconstruct every file (index.html, dispatch-live.html, _headers, _redirects, share-image.png, preview*.png, howto/*.png), not just the changed one. Verify with fresh etag + marker grep + asset 200s.
- CRITICAL after any connector deploy: jse-ops main is now behind live. Stage a sync handoff (`~/Documents/GitHub/jse-ops-handoff/` pattern) so the Windows Claude Code session commits the deployed file to jse-ops BEFORE any other jse-ops push, or the next push reverts the deploy.

**Supabase** (project `naqqlztgbayxcgfphrxg` — canonical PRODUCTION store for driver + dispatch):
- JS↔SQL lockstep: schema-shape changes require `apply_migration` via Supabase MCP BEFORE the client ships. `truck_events.event_type` is unconstrained text — new event vocabulary (e.g. `start_shift`, 2026-06-11) needs no migration, but dispatch-side label/color maps (4× `eventLabel`, 2× `eventColor`, `compactLastEv`, mini-map colors) must learn each new type.
- Shift-hours anchor (2026-06-11): earliest `start_shift` event per session, stamped as `shift_anchor_at` in the buckets memo; falls back to `started_at` for legacy sessions. Driver widget writes `start_shift` on START SHIFT tap or implicitly at first pickup.
