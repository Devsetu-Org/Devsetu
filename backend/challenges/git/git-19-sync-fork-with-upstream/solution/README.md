# Solution — Sync Your Fork with Upstream

Your **origin** is your fork (behind). The Forgeboard org repo is **upstream** (ahead). Sync main from upstream onto your fork, and prune a branch that was deleted on origin.

## 1. Add upstream and fetch

```bash
cd ~/sprint-service
git remote -v
git remote add upstream learner@git.forgeboard.internal:/srv/git/forgeboard-sprint-service.git
git fetch upstream
git log --oneline --graph --all --decorate
```

## 2. Fast-forward your main

```bash
git switch main
git merge --ff-only upstream/main
# or: git rebase upstream/main
```

## 3. Push the fork

```bash
git push origin main
```

Do not push to `upstream` — that is the org remote and rejects pushes to main.

## 4. Prune deleted remote branches

`origin/feature/card-colors` still shows locally even though the fork deleted it:

```bash
git fetch --prune origin
git branch -r | grep card-colors || echo "pruned"
```
