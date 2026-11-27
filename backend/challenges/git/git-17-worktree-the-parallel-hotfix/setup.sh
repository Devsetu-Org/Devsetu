#!/usr/bin/env bash
# Dirty WIP on feature/webhook-delivery. Ops needs webhook_timeout_seconds=30 on
# a fix branch. Learner uses a second worktree, commits + pushes the fix, removes
# the worktree, returns with WIP intact. Leave main alone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

F=feature/webhook-delivery
FIX=fix/webhook-timeout-30
timeout_seconds=30
WT=/home/learner/sprint-webhook-fix

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "F=$(printf '%q' "$F")"
  echo "FIX=$(printf '%q' "$FIX")"
  echo "WT=$(printf '%q' "$WT")"
  cat <<'EOF'
base_repo

cat >> config/app.conf <<'CONF'

[webhooks]
webhook_timeout_seconds = 0
webhook_max_retries = 3
CONF
git add config/app.conf
pcommit "Add outbound webhook timeout config"
seed main-sha "$(git rev-parse HEAD)"
seed main-conf "$(git rev-parse HEAD:config/app.conf)"

git switch -c "$F"
cat > src/webhooks.py <<'PY'
"""Outbound webhook delivery (stub for git labs)."""


def next_backoff_seconds(attempt: int) -> int:
    return min(2**attempt, 60)


def deliver(url: str, payload: str) -> None:
    _ = (url, payload, next_backoff_seconds(0))
PY
git add src/webhooks.py
acommit "Add webhook backoff helper"
seed feature-sha "$(git rev-parse HEAD)"

# Dirty WIP — must survive in the primary worktree
cat > src/webhooks.py <<'PY'
"""Outbound webhook delivery (stub for git labs)."""

# WIP: Product wants jittered backoff; constants still placeholders
BASE_DELAY = 1  # TODO: confirm with Ops
MAX_DELAY = 60  # TODO: confirm with Ops


def next_backoff_seconds(attempt: int) -> int:
    delay = BASE_DELAY * (2**attempt)
    return min(delay, MAX_DELAY)


def deliver(url: str, payload: str) -> None:
    _ = (url, payload, next_backoff_seconds(0))
PY
seed wip-hash "$(git hash-object src/webhooks.py)"

attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$F:refs/heads/$F"

seed_finish
EOF
} | box_script

write_seed webhook-timeout-seconds "$timeout_seconds"
write_seed worktree-path "$WT"
write_seed fix-branch "$FIX"
write_seed feature-branch "$F"

ok "sprint-service planted with dirty WIP on $F; use a worktree for $FIX (timeout=${timeout_seconds}s)"
