# Solution — Revert the Silenced Board Notify

`main` is the shared integration branch (staging tracks it). Production still runs `release/2.1`. A load-test change that silenced board notify already landed on `main` under Priya's card SLA breach-check helper (`src/card_sla.py`). Core forbids direct pushes to `main` — open a fix branch, revert only the bad commit, push for review.

## 1. Branch from main

```bash
cd ~/sprint-service
git switch -c fix/reenable-board-notify
git log --oneline
git show <sha>           # "Silence board notify during load test"
```

The bad commit is below `Add card SLA breach check helper`, so `git revert HEAD` would undo Priya's feature instead.

## 2. Revert on the fix branch

```bash
git revert --no-edit <bad-sha>
```

Git creates `Revert "Silence board notify during load test"` with the inverse patch. Priya's `src/card_sla.py` commit above is unaffected because it touched a different file.

## 3. Push for review (not main)

```bash
git push -u origin fix/reenable-board-notify
cat src/board_notify.py        # NOTIFY_ENABLED = True again
cat src/card_sla.py            # SLA helper still intact
git status
git log --oneline --graph --all --decorate
```

Leave `main` where you found it. In a real team a PR would merge this branch onto `main` next; this lab ends at the push.

## revert vs reset

- `git revert` adds a new commit that undoes an old one. Safe when the bad tip was already shared — and keeps later feature commits intact.
- `git reset --hard` moves the branch pointer back and discards commits. Only for local, unshared work (see the next lab).
