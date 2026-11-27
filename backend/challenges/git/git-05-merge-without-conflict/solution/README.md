# Solution — Sync Board Summary with Main

Your local `main` is stale. Overnight Priya pushed `feature/board-summary`, and `main` also moved on the forge with a production hotfix (email channel + more workers after Slack failed). She is blocked on review until her branch includes that hotfix — morning summaries ride the next deploy. Fetch to see both tips, check out her branch, sync by merging **main into the feature**, resolve on the feature, then **push the feature**. Do not merge into `main` or push `main`. In a real team a PR would come next; this lab ends at the push.

## 1. Fetch and find Priya's branch

```bash
cd ~/sprint-service
git branch -a
git fetch
git branch -a
git log --oneline --graph --all --decorate
```

Before fetch you only see outdated local `main`. After fetch, `origin/main` has moved and `origin/feature/board-summary` appears.

## 2. Check out the feature and merge advanced main

```bash
git checkout feature/board-summary
# or: git switch feature/board-summary
git merge origin/main
# if you already pulled main locally: git merge main
```

Git brings in `board_label` and the production settings without asking where the edits do not overlap. It stops where both sides changed the delivery channel.

## 3. Resolve the conflict

Keep **production's** delivery channel (`channel = email` from main), keep `workers = 4`, and keep the feature's summary enablement (`enabled = true` under `[board_summary]`). Delete every conflict marker.

```bash
nano config/app.conf
grep -nE '^(<<<<<<<|=======|>>>>>>>)' config/app.conf   # should print nothing
git add config/app.conf
git commit --no-edit
git status
```

Confirm the join with `git log --oneline --graph` — one merge commit with two parents — and `git show --stat HEAD`. Do not push or rewrite remote `main`.

## 4. Push the feature for review

A local merge does not update the remote. Push the feature so teammates can open a PR (this lab has no PR UI — the push is the finish line):

```bash
git push -u origin feature/board-summary
# or plain `git push` if tracking is already set
git status
```

Do **not** `git push origin main`.

## Notes

- Syncing while you still own the feature (`git merge origin/main` on the feature) is the everyday move; landing onto shared `main` is a later step (usually via PR).
- Non-overlapping hunks in the same file still auto-merge; conflict markers appear only on the overlapping lines.
- `git merge --abort` backs out of a merge that stops partway.
- The grader checks the resolved tree on the **feature** tip, that `origin` has that tip, and that **remote main is untouched**. Local main may stay outdated or catch up after a pull.
