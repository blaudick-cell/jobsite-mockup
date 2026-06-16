---
name: jse-project-context
description: "Jobsite Exchange (JSE) mockup — single-file React app, 6800+ lines, schema-versioned localStorage state, 4-agent pipeline, deploys to jobsite-mockup-demo.netlify.app."
metadata: 
  node_type: memory
  type: reference
  originSessionId: e2fff2e5-cebd-4c5a-bf53-113c0d1e3e9c
---

`blaudick-cell/jobsite-mockup` is a single-file React mockup (`index.html`, 7000+ lines, ~400KB) with schema-versioned `localStorage` persistence. Architecture is documented in `.claude/skills/jse-*/SKILL.md` — read these BEFORE doing anything substantive. They are load-bearing and accurate.

**Skill files to read first:** `jse-ship-a-feature` (7-block layout, deployer protocol, schema migration recipe), `jse-data-model` (collections, ID conventions, schema version log), `jse-routing` (full route table), `jse-activity-feed` (`appendActivity` composer + event types), `jse-design-system` (tokens C/T/F/R/S, primitives).

**4-agent pipeline** (`.claude/agents/`): explorer → builder → reviewer → deployer. Run them serially via the Agent tool with `subagent_type: explorer|builder|reviewer|deployer`. Don't skip — the deployer's strict protocol catches stale-deploy bugs the rest can't.

**Deploy target:** `https://jobsite-mockup-demo.netlify.app` ONLY (deploys from `main` via Netlify auto-deploy). Verification recipe per `jse-ship-a-feature`: fresh `curl -sI`, no reused Etag, marker grep, shell grep, plus jobsiteexchange.com sanity check.

**SEPARATE PRODUCT — do not touch:** `https://www.jobsiteexchange.com/` is a real locked product. Pushing mockup commits there would be a catastrophic mistake. Always include it in the deploy verification as a sanity check that its Content-Length / etag is UNCHANGED across the deploy (compare pre vs post — don't pin a specific number; the locked product gets external updates occasionally — as of 2026-05-22 CL was 1921, prior memory had it at 1711).

**Project paths:**
- Main checkout: `C:\Users\blaud\OneDrive\Documents\GitHub\jobsite-mockup`
- Worktrees live under: `C:\Users\blaud\OneDrive\Documents\GitHub\jobsite-mockup\.claude\worktrees\<name>`

Related: [[check-worktree-base-first]].
