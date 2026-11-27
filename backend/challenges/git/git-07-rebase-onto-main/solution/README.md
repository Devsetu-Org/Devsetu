# Solution — Rebase Board Filters Onto Main

`feature/board-filters` lives on origin and forked before `main` moved. Start on `main`, fetch and check out the feature, replay its two commits on today's `main` (linear history), resolve README by keeping **both** docs, then force-with-lease push.

## 1. Fetch the feature

```bash
cd ~/sprint-service
git fetch origin
git switch feature/board-filters
git log --oneline --graph --all
```

Your two filter commits sit on an older tip; local `main` has moved ahead.

## 2. Rebase (do not merge)

```bash
git rebase main
```

The first commit (`filters.py`) applies cleanly. The second stops on `README.md` — both you and `main` rewrote the board docs.

## 3. Resolve README — keep both sides

Keep your board-filters usage notes **and** main's note about the `board_label` helper. Combine them; delete every conflict marker.

```bash
nano README.md
grep -nE '^(<<<<<<<|=======|>>>>>>>)' README.md   # should print nothing
git add README.md
git rebase --continue
```

Then confirm:

```bash
git log --oneline --graph --all
git log --oneline main..HEAD
```

Exactly two commits, same subjects, now based on main's tip. New SHAs are expected — that is rebase rewriting the feature tip.

## 4. Force-with-lease push the feature

Origin still points at the old tip. A plain push is rejected after rebase. Update **only** the feature branch:

```bash
git push --force-with-lease origin feature/board-filters
```

Do **not** push or rewrite `main`.

## Notes

- Merging `main` into the feature would sync the files but leave a merge commit; this lab wants the linear story.
- `git rebase --abort` undoes a rebase that went wrong.
- Leave `main` exactly where it is; only the feature branch should move.
- Never plain `--force` on a shared branch when `--force-with-lease` will do.
