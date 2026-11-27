# Solution — Squash CSV Export WIP Into Two Commits

Priya will not approve a five-commit WIP stack on `feature/csv-export`. That noisy tip is on `origin` only — start on `main`, fetch and check it out, rewrite into two clear commits (implementation, then tests + docs) without changing the final tree, then force-with-lease push. Do not push `main`.

## 1. Fetch the noisy tip

```bash
cd ~/sprint-service
git fetch origin
git switch feature/csv-export
git log --oneline main..HEAD
```

## 2. Interactive rebase

```bash
git rebase -i main
```

Keep the first real implementation commit as `pick`, mark the follow-ups as `squash`/`fixup` so you end with **two** commits — e.g. implementation, then tests+docs. Reword subjects so they are clear.

If your editor is awkward in the lab, soft-reset and recommit also works as long as the final tree matches and you land exactly two commits:

```bash
git reset --soft main
git restore --staged .
git add src/csv_export.py
git commit -m "Add CSV export for sprint board downloads"
git add tests/test_csv_export.py README.md
git commit -m "Add CSV export tests and README notes"
```

## 3. Verify

```bash
git log --oneline main..HEAD
git status
```

Exactly two commits, clear subjects, clean working tree. The files on disk should match what you started with — only history changed.

## 4. Publish the rewritten tip

Plain `git push` is rejected — origin still has the five WIP commits. Update **your** feature branch:

```bash
git push --force-with-lease origin feature/csv-export
git status
```

Do **not** `git push origin main`.

## Notes

- Squash rewrites SHAs. After the tip was already pushed, publish with `--force-with-lease`, not plain `--force`, and never rewrite `main`.
- This lab has no PR UI — the push is the finish line so Priya can open the review.
