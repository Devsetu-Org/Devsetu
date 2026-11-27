# Solution — Recover Lost Column Auto-Advance

You hard-reset away the column auto-advance commit on **feature/column-auto-advance** before it was on origin. Restore it from the reflog, then push the feature for review. Leave `main` alone.

## 1. Confirm it is gone

```bash
cd ~/sprint-service
git branch --show-current   # feature/column-auto-advance
git log --oneline           # no "Add column auto-advance for stale Doing cards"
ls src                      # no column_automate.py
```

## 2. Ask the reflog

```bash
git reflog
```

```text
79fdd2d HEAD@{0}: reset: moving to HEAD~1
1102836 HEAD@{1}: commit: Add column auto-advance for stale Doing cards
...
```

`HEAD@{1}` is the lost commit.

## 3. Restore it on the feature

```bash
git reset --hard <lost-sha>
# or: git cherry-pick <lost-sha>
```

Stay on `feature/column-auto-advance`.

## 4. Push for review

```bash
git push -u origin feature/column-auto-advance
git log --oneline
cat src/column_automate.py
git status
```

Do not push `main`.

## Takeaways

- `reset --hard` moves a private tip. Recover locally first; origin only learns after you push.
- The reflog is a local safety net — not shared with the remote.
