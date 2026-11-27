# Solution — Capstone: Untangle the Invite Merge Mess

## 1. Diagnose

```bash
cd ~/sprint-service
git status
git log --oneline --graph --all
```

You will see: HEAD detached, `MERGE_HEAD` present, `config/app.conf` unmerged, two untracked leftover files, and a commit not reachable from any branch.

## 2. Resolve the conflict

```bash
cat config/app.conf
```

Keep a single `invite_link_ttl_hours = 168` under `[invites]`, keep `workers = 4` and `redeem_code_length = 8`, and delete all marker lines.

```bash
nano config/app.conf
grep -n '<<<<<<<\|=======\|>>>>>>>' config/app.conf || echo "no markers"
```

## 3. Clean up leftovers

```bash
rm config/app.conf.orig config/app.conf.rej
```

## 4. Finish the merge

```bash
git add -A
git commit --no-edit
git log --oneline --graph --all
```

The merge commit's first parent is the orphaned "Document workspace invites in README" commit, so it is now in this line of history.

## 5. Re-attach `main`

```bash
git switch -C main          # point main at this commit and check it out
git branch --show-current   # main
```

`main`'s old tip (the hotfix) is an ancestor of the merge, so nothing is lost.

## 6. Verify

```bash
git status
git log --oneline --graph
git show main:config/app.conf
ls config                   # no .orig / .rej
```

## Lessons

- A detached HEAD is fine for looking around; commit there and you must save the work (`git switch -c <branch>`).
- `git merge --abort` is the escape hatch for an unfinished merge; `git reflog` finds commits that no branch references.
- Never commit `*.orig` / `*.rej` leftovers.
