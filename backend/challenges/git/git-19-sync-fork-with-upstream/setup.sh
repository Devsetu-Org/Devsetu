#!/usr/bin/env bash
# Learner's fork (origin) lags the Forgeboard org remote (upstream). Add upstream,
# fetch, fast-forward main, push origin main. Prune a branch deleted on origin.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

UPSTREAM=/srv/git/forgeboard-sprint-service.git
STALE_BR=feature/card-colors

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "UPSTREAM=$(printf '%q' "$UPSTREAM")"
  echo "STALE_BR=$(printf '%q' "$STALE_BR")"
  cat <<'EOF'
base_repo
seed fork-base "$(git rev-parse HEAD)"

git switch -c "$STALE_BR"
cat > src/card_colors.py <<'PY'
"""Throwaway card-color experiment (never meant to ship)."""

DEFAULT_CARD_COLOR = "#cccccc"
PY
git add src/card_colors.py
pcommit "Try board card colors"
stale_tip="$(git rev-parse HEAD)"
git switch main

cat > src/invite_audit.py <<'PY'
"""Audit helpers for workspace invite redemptions."""

def audit_event(code: str, action: str) -> str:
    return f"invite:{action}:{code}"
PY
git add src/invite_audit.py
pcommit "Add invite audit event helper"
seed upstream-main "$(git rev-parse HEAD)"
seed audit-hash "$(git rev-parse HEAD:src/invite_audit.py)"

install -d -m 755 /srv/git
rm -rf "$REMOTE" "$UPSTREAM"

# Org upstream at advanced main
git clone --bare -q "$REPO" "$UPSTREAM"
git -C "$UPSTREAM" symbolic-ref HEAD refs/heads/main
git -C "$UPSTREAM" update-ref -d "refs/heads/$STALE_BR" 2>/dev/null || true

# Rewind local main for the fork snapshot; keep stale feature tip
git reset --hard "$(cat "$SEED/fork-base")"
git branch -f "$STALE_BR" "$stale_tip"

git clone --bare -q "$REPO" "$REMOTE"
git -C "$REMOTE" symbolic-ref HEAD refs/heads/main

git remote remove origin 2>/dev/null || true
git remote add origin "learner@git.forgeboard.internal:$REMOTE"
git update-ref "refs/remotes/origin/main" "$(cat "$SEED/fork-base")"
git update-ref "refs/remotes/origin/$STALE_BR" "$stale_tip"
git config branch.main.remote origin
git config branch.main.merge refs/heads/main

# Deleted on the fork remote; local origin/* tracking ref remains until prune
git -C "$REMOTE" update-ref -d "refs/heads/$STALE_BR"

seed remote-url "learner@git.forgeboard.internal:$REMOTE"
seed upstream-url "learner@git.forgeboard.internal:$UPSTREAM"

install -d -m 755 "$UPSTREAM/hooks"
cat > "$UPSTREAM/hooks/update" <<'HOOK'
#!/bin/bash
refname="$1"
if [ "$refname" = "refs/heads/main" ]; then
  echo "rejected: do not push to the Forgeboard org upstream main — push your fork (origin)." >&2
  exit 1
fi
exit 0
HOOK
chmod 755 "$UPSTREAM/hooks/update"

ALLOW_PUSH_MAIN=1 seed_finish
chown -R learner:learner "$UPSTREAM"
EOF
} | box_script

write_seed stale-branch "$STALE_BR"

ok "fork origin lags upstream; sync main from upstream, push origin, prune deleted origin branch"
