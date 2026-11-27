#!/usr/bin/env bash
# Capstone: detached HEAD with an orphaned commit, a half-finished conflicting merge, and leftover files.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

main_ttl="$((48 + RANDOM % 48))"     # main's invite TTL (visible in conflict)
feat_ttl="$((12 + RANDOM % 24))"     # feature's invite TTL (visible in conflict)
# Ops sign-off value named in the Description tab (must differ from both sides).
final_ttl=168

ensure_git
fresh_home
set_learner_git_identity

{
  git_seed_prelude
  echo "main_ttl=$main_ttl; feat_ttl=$feat_ttl"
  cat <<'EOF'
base_repo 3000

cat >> config/app.conf <<'CONF'

[invites]
invite_link_ttl_hours = 24
CONF
git add config/app.conf
pcommit "Add workspace invite link settings"
seed fork-sha "$(git rev-parse HEAD)"

# feature/workspace-invites forks here
git checkout -q -b feature/workspace-invites
sed -i "s/^invite_link_ttl_hours = .*/invite_link_ttl_hours = $feat_ttl/" config/app.conf
cat >> config/app.conf <<'CONF'
redeem_code_length = 8
CONF
cat > src/invites.py <<'PY'
"""Workspace invite links and redeem codes for Forgeboard."""


def invite_expires_in(ttl_hours: int) -> int:
    return max(ttl_hours, 1) * 3600


def redeem_code_ok(code: str, length: int = 8) -> bool:
    return len(code) == length and code.isalnum()
PY
git add -A
pcommit "Invites: redeem codes and tunable TTL"
seed feature-sha "$(git rev-parse HEAD)"
seed invites-hash "$(git rev-parse HEAD:src/invites.py)"

# main moves on with its own TTL + workers
git checkout -q main
sed -i "s/^invite_link_ttl_hours = .*/invite_link_ttl_hours = $main_ttl/" config/app.conf
sed -i 's/^port = 8080/port = 8080\nworkers = 4/' config/app.conf
git add config/app.conf
pcommit "Hotfix: raise invite TTL, run 4 workers"
seed main-sha "$(git rev-parse HEAD)"

# --- the mess ---
# 1) someone checked out main's commit directly (detached HEAD) and committed on top of it…
git checkout -q --detach
cat >> README.md <<'MD'

## Workspace invites

Admins mint invite links; teammates redeem a short code to join the workspace.
MD
git add README.md
acommit "Document workspace invites in README"
seed orphan-sha "$(git rev-parse HEAD)"
seed readme-hash "$(git rev-parse HEAD:README.md)"

# 2) …then started merging feature/workspace-invites, which conflicts in config/app.conf
cp config/app.conf config/app.conf.orig
printf '%s\n' "rejected hunk from the last merge attempt" > config/app.conf.rej
g merge feature/workspace-invites >/dev/null 2>&1 || true
seed_finish
EOF
} | box_script

write_seed final-invite-ttl "$final_ttl"

ok "sprint-service planted in a mess (detached HEAD, invite merge conflict, orphan commit; final=${final_ttl}h)"
