# Solution — Scrub the API Key Before First Push

`feature/invite-redeem-docs` was never pushed. Mid-stack, `config/local_debug.conf` committed `FORGEBOARD_API_KEY=…`. A new commit that only deletes the file is not enough — the key stays in history. Rewrite the private branch, then push.

## 1. See the leak

```bash
cd ~/sprint-service
git log --oneline main..HEAD
git log -p -S'fb_live_' main..HEAD
```

## 2. Rewrite (soft reset is enough while unpushed)

```bash
git reset --soft main
git restore --staged config/local_debug.conf
rm -f config/local_debug.conf
git status
# re-commit the good work without the debug config
git commit -m "Add invite redeem path helper"
git commit -m "Document invite redeem paths in README"   # if staged separately
# or stage intentionally and make clear commits again
```

A clean approach:

```bash
git reset --soft main
git reset HEAD
rm -f config/local_debug.conf
git add src/invites.py
git commit -m "Add invite redeem path helper"
git add README.md
git commit -m "Document invite redeem paths in README"
git add src/invite_audit.py
git commit -m "Add invite audit event helper"
```

Interactive rebase (`edit` / drop the bad commit) also works.

## 3. Verify and push

```bash
git log -S'fb_live_' --oneline main..HEAD   # empty
git push -u origin feature/invite-redeem-docs
```

Leave `main` alone. Never push a history that still contains the key.
