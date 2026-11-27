#!/usr/bin/env bash
# API key committed mid-stack on an unpushed feature branch. Learner rewrites
# history so the secret is gone from every commit, then pushes the clean branch.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=feature/invite-redeem-docs
# Fixed fake key so graders can search history for it
SECRET='fb_live_7a91c2e4b6d8f0a3'

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "BR=$(printf '%q' "$BR")"
  echo "SECRET=$(printf '%q' "$SECRET")"
  cat <<'EOF'
base_repo

cat >> config/app.conf <<'CONF'

[invites]
invite_link_ttl_hours = 72
redeem_code_length = 8
CONF
git add config/app.conf
pcommit "Add workspace invite defaults"
seed main-sha "$(git rev-parse HEAD)"

attach_remote
git push "$REMOTE" "main:refs/heads/main"

git switch -c "$BR"

cat > src/invites.py <<'PY'
"""Workspace invite helpers for Forgeboard."""

def invite_link_path(code: str) -> str:
    return f"/invites/redeem/{code}"
PY
git add src/invites.py
acommit "Add invite redeem path helper"

# Bad commit — secret mid-stack (not the tip, so amend alone is not enough)
cat > config/local_debug.conf <<ENV
# local debug — should never have been committed
FORGEBOARD_API_KEY=$SECRET
ENV
git add config/local_debug.conf
acommit "Add local debug config for invite redeem tests"
seed bad-sha "$(git rev-parse HEAD)"

cat >> README.md <<'MD'

## Workspace invites

Redeem codes are eight characters. Invite links use /invites/redeem/<code>.
MD
git add README.md
acommit "Document invite redeem paths in README"

cat > src/invite_audit.py <<'PY'
"""Audit helpers for workspace invite redemptions."""

def audit_event(code: str, action: str) -> str:
    return f"invite:{action}:{code}"
PY
git add src/invite_audit.py
acommit "Add invite audit event helper"

seed tip-before "$(git rev-parse HEAD)"
# Feature never pushed — only main is on origin
git update-ref "refs/remotes/origin/main" "$(cat "$SEED/main-sha")"
git config "branch.$BR.remote" origin
git config "branch.$BR.merge" "refs/heads/$BR"

seed_finish
EOF
} | box_script

write_seed secret-string "$SECRET"
write_seed feature-branch "$BR"

ok "unpushed $BR has mid-stack API key — rewrite history clean, then push"
