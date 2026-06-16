---
name: check-worktree-base-first
description: "Before doing anything in a worktree, verify the branch base is not stale vs origin/main. Long-running worktrees can branch off ancient commits."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e2fff2e5-cebd-4c5a-bf53-113c0d1e3e9c
---

Always run `git fetch origin && git log --oneline origin/main..HEAD` and `git log --oneline HEAD..origin/main` before starting work in a JSE worktree. Worktrees can sit on a branch that was created weeks ago from a commit that no longer reflects current main.

**Why:** burned a full 4-agent pipeline pass on a worktree branched from `8d3ec49` while `origin/main` had moved 37 commits ahead (to `f3bddec`). The explorer dutifully reported that the brief's referenced infrastructure didn't exist — because it didn't exist *in the stale worktree*. The user's brief was accurate; the worktree was the lie. Caught only when the deployer tried to merge and hit a real content conflict.

**How to apply:** the very first thing any JSE session should do is `git fetch && git status -sb` plus a log compare against origin/main. If the worktree is more than a handful of commits behind, ask the user before building OR `git reset --hard origin/main` (their local commits are recoverable via reflog if they explicitly want to discard).

Related to [[jse-project-context]].
