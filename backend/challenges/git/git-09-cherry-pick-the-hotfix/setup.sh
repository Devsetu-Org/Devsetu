#!/usr/bin/env bash
# Nightly board-summary crash: release/2.1 already has a bad temporary
# digest_batch_size; Priya's correct HOTFIX sits on main above unreleased
# capacity. Cherry-picking the HOTFIX onto release conflicts in src/sprints.py
# — learner keeps the safe clamp, finishes the pick, pushes release. Start on main.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

batch="$((50 + RANDOM % 50))"   # 50–99
R=release/2.1

ensure_git
fresh_home
ensure_answers
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "batch=$batch"
  echo "R=$(printf '%q' "$R")"
  cat <<'EOF'
base_repo
echo "2.1.0" > VERSION
git add VERSION
pcommit "Release 2.1.0"
git branch "$R"

# Release line already got a poor temporary hot-patch (same region the real fix touches).
git checkout -q "$R"
cat >> src/sprints.py <<'PY'


def digest_batch_size(card_count: int) -> int:
    """Temporary board-summary batch helper (release hot-patch — no empty-board guard)."""
    return card_count
PY
git add src/sprints.py
gcommit "Jordan Lee" "jordan@forgeboard.internal" \
  "Patch: temporary digest_batch_size for nightly summary"
seed release-sha "$(git rev-parse HEAD)"
seed release-readme-hash "$(git rev-parse HEAD:README.md)"

# main carries unreleased work… then the production-safe HOTFIX on top
git checkout -q main
cat > src/capacity.py <<'PY'
"""Board capacity planning (unreleased, not in 2.1)."""


def weekly_points(limit: int, committed: int) -> int:
    return max(0, limit - committed)
PY
git add src/capacity.py
pcommit "Add board capacity planning helper"
cat >> README.md <<'MD'

## Capacity

Sprint boards will show remaining weekly points (next release).
MD
git add README.md
pcommit "Document upcoming capacity panel in README"

# Correct clamp — overlaps release's temporary helper → cherry-pick conflict
cat >> src/sprints.py <<PY


def digest_batch_size(card_count: int) -> int:
    """Clamp board-summary batches so an empty board cannot crash the nightly job."""
    if card_count <= 0:
        return 1
    return min(card_count, $batch)
PY
git add src/sprints.py
pcommit "HOTFIX: clamp board-summary batch size on empty boards"
seed hotfix-sha "$(git rev-parse HEAD)"
seed main-sha "$(git rev-parse HEAD)"
seed sprints-hash "$(git rev-parse HEAD:src/sprints.py)"
seed batch "$batch"

# Team remote gets main tip (hotfix + capacity) and the patched release tip.
attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$R:refs/heads/$R"
chown -R learner:learner "$REMOTE"

main_tip="$(cat "$SEED/main-sha")"
rel_tip="$(cat "$SEED/release-sha")"

git checkout -q main
git update-ref "refs/remotes/origin/main" "$main_tip"
git update-ref "refs/remotes/origin/$R" "$rel_tip"
git config "branch.$R.remote" origin
git config "branch.$R.merge" "refs/heads/$R"

# Learner starts on main — sees the hotfix sitting above capacity work.
[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]]
[[ "$(git rev-parse main)" == "$main_tip" ]]
[[ "$(git rev-parse "$R")" == "$rel_tip" ]]
[[ "$(git -C "$REMOTE" rev-parse refs/heads/main)" == "$main_tip" ]]
[[ "$(git -C "$REMOTE" rev-parse "refs/heads/$R")" == "$rel_tip" ]]
git remote get-url origin >/dev/null

seed_finish
EOF
} | box_script

box_ok "test -d /home/learner/sprint-service/.git" \
  || { fail "setup did not plant ~/sprint-service"; exit 1; }
box_ok "test -d /srv/git/sprint-service.git" \
  || { fail "setup did not plant the team remote"; exit 1; }

ok "sprint-service planted: naive batch helper on $R; HOTFIX on main above capacity — cherry-pick conflicts in sprints.py (batch=${batch})"
