# Solution — Bring Priya's Invite Branch Into Yours

Priya finished `feature/workspace-invites-priya` and left. Integrate that tip into `feature/workspace-invites-ada`, keep both code helpers and both README notes, push **your** branch. Leave `main` alone.

## 1. Fetch her branch

```bash
cd ~/sprint-service
git fetch origin
git branch -a
git log --oneline --graph --all --decorate
```

## 2. Bring her work into yours

```bash
git switch feature/workspace-invites-ada
git merge origin/feature/workspace-invites-priya
```

`src/invites.py` and `src/invite_audit.py` should merge cleanly. `README.md` may conflict.

## 3. Resolve README — keep both docs

Combine Priya's eight-character redeem note **and** your preview-banner docs. Remove every conflict marker.

```bash
nano README.md
git add README.md
git commit   # finish the merge (or git rebase --continue if you rebased)
```

## 4. Push your branch

```bash
git push -u origin feature/workspace-invites-ada
```

Do not push `main`, and do not rewrite her remote branch.
