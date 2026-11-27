#!/usr/bin/env bash
# Sync workflow: Priya's feature/board-summary and an advanced main live only on
# the forge. Local main is intentionally stale; no local feature branch. Learner
# must fetch, check out the remote feature, merge advanced main into it, resolve,
# and push the feature — leave remote main alone.
# Auto-merges non-overlapping edits; conflicts only on channel in config/app.conf.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

# Production hotfix value (keep). Feature branch uses slack (drop).
main_channel=email
feat_channel=slack
BR=feature/board-summary

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "main_channel=$main_channel; feat_channel=$feat_channel"
  echo "BR=$(printf '%q' "$BR")"
  cat <<'EOF'
base_repo

# Shared ancestor: draft delivery channel (both sides will change this line)
cat >> config/app.conf <<'CONF'

[board_summary]
channel = none
CONF
git add config/app.conf
pcommit "Draft board summary channel setting"
seed outdated-main-sha "$(git rev-parse HEAD)"

# feature/board-summary: Priya's helper + enable summaries, route to Slack
git checkout -q -b "$BR"
cat > src/board_summary.py <<'PY'
"""Morning board summary for Forgeboard boards."""


def summary_subject(workspace: str) -> str:
    return f"Board summary — {workspace}"
PY
git add src/board_summary.py
pcommit "Add morning board summary helper"
awk '
  /^\[board_summary\]$/ && !done {
    print
    print "enabled = true"
    done = 1
    next
  }
  { print }
' config/app.conf > config/app.conf.tmp && mv config/app.conf.tmp config/app.conf
sed -i "s/^channel = .*/channel = $feat_channel/" config/app.conf
git add config/app.conf
pcommit "Enable morning board summaries and deliver over Slack"
seed feature-sha "$(git rev-parse HEAD)"
seed summary-hash "$(git rev-parse HEAD:src/board_summary.py)"

# main moved: board_label (clean vs feature) + production channel hotfix + workers
git checkout -q main
cat >> src/sprints.py <<'PY'


def board_label(name: str) -> str:
    return name.strip().title()
PY
git add src/sprints.py
pcommit "Add board_label helper for sprint boards"
sed -i "s/^channel = .*/channel = $main_channel/" config/app.conf
sed -i 's/^port = 8080/port = 8080\nworkers = 4/' config/app.conf
git add config/app.conf
pcommit "Hotfix: deliver board summaries by email after Slack trouble, run 4 workers"
seed main-sha "$(git rev-parse HEAD)"
seed sprints-hash "$(git rev-parse HEAD:src/sprints.py)"

# Team remote gets advanced main + Priya's feature; then rewind the learner clone.
attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$BR:refs/heads/$BR"
chown -R learner:learner "$REMOTE"

outdated="$(cat "$SEED/outdated-main-sha")"
advanced="$(cat "$SEED/main-sha")"
feature_tip="$(cat "$SEED/feature-sha")"

git checkout -q main
git reset --hard "$outdated"
git branch -D "$BR"
# Stale/missing remote-tracking refs — learner must fetch to see tips.
git update-ref "refs/remotes/origin/main" "$outdated"
git update-ref -d "refs/remotes/origin/$BR" 2>/dev/null || true
git config --unset "branch.$BR.remote" 2>/dev/null || true
git config --unset "branch.$BR.merge" 2>/dev/null || true

# Learner starts on outdated local main; no local feature until fetch.
[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]]
[[ "$(git rev-parse main)" == "$outdated" ]]
! git show-ref --verify --quiet "refs/heads/$BR"
! git show-ref --verify --quiet "refs/remotes/origin/$BR"
[[ "$(git rev-parse refs/remotes/origin/main)" == "$outdated" ]]
[[ -d "$REPO/.git" ]] || { echo "setup bug: $REPO missing" >&2; exit 1; }
git remote get-url origin >/dev/null
# Bare remote has the advanced tips.
[[ "$(git -C "$REMOTE" rev-parse refs/heads/main)" == "$advanced" ]]
[[ "$(git -C "$REMOTE" rev-parse "refs/heads/$BR")" == "$feature_tip" ]]

seed_finish
EOF
} | box_script

write_seed main-summary-channel "$main_channel"

box_ok "test -d /home/learner/sprint-service/.git" \
  || { fail "setup did not plant ~/sprint-service"; exit 1; }
box_ok "test -d /srv/git/sprint-service.git" \
  || { fail "setup did not plant the team remote"; exit 1; }

ok "sprint-service planted: fetch Priya's $BR, merge advanced main into it, push the feature (main channel=${main_channel}, feature channel=${feat_channel})"
