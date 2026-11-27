# Solution — Stash Invite WIP for the TTL Hotfix

Dirty invite-banner WIP blocks switching off `feature/workspace-invites`. Stash it, land `fix/invite-ttl-72` from `main`, push for review, then restore the WIP.

## 1. Stash the WIP

```bash
cd ~/sprint-service
git status
git stash push -m "invite banner wip"
git status
```

## 2. Fix branch from main

```bash
git switch main
git switch -c fix/invite-ttl-72
nano config/app.conf   # invite_link_ttl_hours = 72
git add config/app.conf
git commit -m "Set invite link TTL to 72 hours"
git push -u origin fix/invite-ttl-72
```

## 3. Restore the feature WIP

```bash
git switch feature/workspace-invites
git stash pop
git stash list          # empty
git status              # M src/main.py
```

Leave `main` where you found it.
