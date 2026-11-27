#!/usr/bin/env bash
# Core wants a local commit-msg hook: subjects must start with FB-<digits>.
# Learner installs the hook, lands a valid commit on a fix branch, pushes.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=fix/hook-ticket-prefix

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "BR=$(printf '%q' "$BR")"
  cat <<'EOF'
base_repo

# Sample that should FAIL the hook once installed (for the learner to verify)
cat > /home/learner/hook-smoke-bad.txt <<'TXT'
subject without ticket
TXT
cat > /home/learner/hook-smoke-good.txt <<'TXT'
FB-1842 Document invite hook policy in README
TXT
chown learner:learner /home/learner/hook-smoke-bad.txt /home/learner/hook-smoke-good.txt

seed main-sha "$(git rev-parse HEAD)"

attach_remote
git push "$REMOTE" "main:refs/heads/main"

# Start on a fix branch so the learner commits there (not on main)
git switch -c "$BR"

seed_finish
EOF
} | box_script

write_seed fix-branch "$BR"

ok "sprint-service on $BR; install commit-msg hook requiring FB-<id> prefix, commit, push"
