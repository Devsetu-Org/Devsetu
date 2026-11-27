#!/usr/bin/env bash
# Team git host git.forgeboard.internal (loopback via /etc/hosts + local sshd)
# serves the bare repo over SSH. Learner clones, flips two early-access flags,
# commits, and pushes to main. Nothing is planted under ~/sprint-service.
# Ticket copy lives in the UI Description tab (fixed early-access orgs below).
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

# Fixed early-access tenants (must match pack description + base_repo pool).
org_a=helix-robotics
org_b=lumen-retail

ensure_git
fresh_home
clear_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  cat <<'EOF'
base_repo
seed base-sha "$(git rev-parse HEAD)"
seed seed-commits "$(git rev-list --count HEAD)"
publish_remote
# L1 only: learner must push to main. Later labs deny direct main pushes.
ALLOW_PUSH_MAIN=1 seed_finish
EOF
} | box_script

write_seed rollout-org-a "$org_a"
write_seed rollout-org-b "$org_b"

ok "forge host $GIT_HOST ready; sprint-service remote published (full rollout: ${org_a}, ${org_b})"
