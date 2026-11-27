# Solution — Parallel Webhook Hotfix with a Worktree

Dirty webhook backoff WIP stays on `feature/webhook-delivery`. Ops needs `webhook_timeout_seconds = 30` on a fix branch for review. Use a **second worktree** so both checkouts exist at once — hotfix in one directory, WIP untouched in the other.

## 1. See the dirty tree

```bash
cd ~/sprint-service
git status
git branch --show-current   # feature/webhook-delivery
```

## 2. Add a worktree from main

```bash
git worktree add -b fix/webhook-timeout-30 ~/sprint-webhook-fix main
```

That creates a second checkout at `~/sprint-webhook-fix` on a new branch based on `main`. Your original tree stays dirty.

## 3. Ship the hotfix in the worktree

```bash
cd ~/sprint-webhook-fix
nano config/app.conf   # webhook_timeout_seconds = 30
git add config/app.conf
git commit -m "Set webhook timeout to 30 seconds"
git push -u origin fix/webhook-timeout-30
```

## 4. Remove the worktree and return

```bash
cd ~/sprint-service
git worktree remove ~/sprint-webhook-fix
git status
git branch --show-current   # feature/webhook-delivery
```

## Why worktree?

A second working copy keeps a long-lived dirty tree (or a running build) untouched while you land an urgent fix on another branch in the same repo at the same time.
