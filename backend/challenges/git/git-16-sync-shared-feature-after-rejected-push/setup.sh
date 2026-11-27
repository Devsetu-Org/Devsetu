#!/usr/bin/env bash
# You and Priya each own a branch for workspace invites. Priya finished
# feature/workspace-invites-priya (code + README) and left for vacation. You are
# on feature/workspace-invites-ada with your own code + README. Fetch her branch,
# merge (or rebase) into yours — README conflicts; code files do not — then push
# your branch. Leave main alone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ADA=feature/workspace-invites-ada
PRIYA=feature/workspace-invites-priya

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "ADA=$(printf '%q' "$ADA")"
  echo "PRIYA=$(printf '%q' "$PRIYA")"
  cat <<'EOF'
base_repo

cat >> config/app.conf <<'CONF'

[invites]
invite_link_ttl_hours = 24
redeem_code_length = 8
CONF
git add config/app.conf
pcommit "Add workspace invite defaults"
seed main-sha "$(git rev-parse HEAD)"

# Priya's finished branch: redeem audit helper + README note (on origin only).
git switch -c "$PRIYA"
cat > src/invite_audit.py <<'PY'
"""Audit helpers for workspace invite redeem attempts."""


def redeem_attempt_key(code: str, workspace: str) -> str:
    return f"{workspace}:{code.strip().upper()}"
PY
git add src/invite_audit.py
gcommit "Priya Sharma" "priya@forgeboard.internal" "Add invite redeem audit helper"

cat >> README.md <<'MD'

## Workspace invites

Redeem codes are eight characters. Invite links use /invites/redeem/<code>.
MD
git add README.md
gcommit "Priya Sharma" "priya@forgeboard.internal" "Document invite redeem paths in README"
seed priya-tip "$(git rev-parse HEAD)"
seed priya-audit-hash "$(git rev-parse HEAD:src/invite_audit.py)"
seed priya-readme "$(git rev-parse HEAD:README.md)"

attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$PRIYA:refs/heads/$PRIYA"
chown -R learner:learner "$REMOTE"

# Drop local Priya branch — tip stays on origin only until the learner fetches.
git switch main
git branch -D "$PRIYA"
git update-ref -d "refs/remotes/origin/$PRIYA" 2>/dev/null || true

# Your branch from the same main tip: banner path helper + divergent README.
git switch -c "$ADA"
cat > src/invites.py <<'PY'
"""Workspace invite helpers for Forgeboard."""


def invite_link_path(code: str) -> str:
    return f"/invites/r/{code}"
PY
git add src/invites.py
acommit "Add invite preview path helper"

cat >> README.md <<'MD'

## Workspace invites

Invite redeem lives under /invites/r/<code> during the preview banner work.
MD
git add README.md
acommit "Draft invite redeem docs for preview banner"
seed ada-tip "$(git rev-parse HEAD)"
seed ada-invites-hash "$(git rev-parse HEAD:src/invites.py)"
seed ada-readme "$(git rev-parse HEAD:README.md)"

# No local/tracking Priya refs — learner must fetch to see her branch.
git update-ref "refs/remotes/origin/main" "$(cat "$SEED/main-sha")"
git update-ref -d "refs/remotes/origin/$PRIYA" 2>/dev/null || true
git update-ref -d "refs/remotes/origin/$ADA" 2>/dev/null || true

[[ "$(git rev-parse --abbrev-ref HEAD)" == "$ADA" ]]
! git show-ref --verify --quiet "refs/heads/$PRIYA"
! git show-ref --verify --quiet "refs/remotes/origin/$PRIYA"
[[ "$(git -C "$REMOTE" rev-parse "refs/heads/$PRIYA")" == "$(cat "$SEED/priya-tip")" ]]

seed_finish
EOF
} | box_script

ok "sprint-service planted: fetch $PRIYA into $ADA (README conflict; code merges clean), push your branch"
