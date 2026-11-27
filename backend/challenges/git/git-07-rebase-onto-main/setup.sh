#!/usr/bin/env bash
# feature/board-filters forked from an older main; tip is on origin only.
# Learner starts on main, fetches/checks out the feature, rebases onto current
# main (README conflict), then force-with-lease pushes the rewritten feature.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=feature/board-filters

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "BR=$(printf '%q' "$BR")"
  cat <<'EOF'
base_repo

# Shared ancestor docs both sides will rewrite (creates the rebase conflict).
cat >> README.md <<'MD'

## Boards

Sprint boards list columns for each workspace.
MD
git add README.md
pcommit "Document sprint boards in README"
seed base-sha "$(git rev-parse HEAD)"

git checkout -q -b "$BR"
cat > src/filters.py <<'PY'
"""Board column filters for Forgeboard sprint views."""

ALLOWED = ("todo", "doing", "done", "blocked")


def normalize_column(name: str) -> str:
    key = name.strip().lower()
    return key if key in ALLOWED else "todo"
PY
git add src/filters.py
pcommit "Add normalize_column for board filters"

# Rewrite the Boards block — overlaps with main's later README rewrite.
cat > README.md <<'MD'
# sprint-service

Owns classic and agentic sprints for Forgeboard workspaces.

## Board filters

Sprint boards can filter columns with `src/filters.py` (`todo`, `doing`, `done`, `blocked`).
Call `normalize_column` before applying a filter so unknown names fall back to `todo`.
MD
git add README.md
pcommit "Document board filters in README"
seed orig-feature-sha "$(git rev-parse HEAD)"
seed filters-hash "$(git rev-parse HEAD:src/filters.py)"

# main moved while the branch sat there
git checkout -q main
sed -i 's/^level = info/level = warn/' config/app.conf
git add config/app.conf
pcommit "Raise default log level to warn"
cat >> src/sprints.py <<'PY'


def board_label(name: str) -> str:
    return name.strip().title()
PY
# Same ## Boards region the feature rewrote — rebase will stop here.
cat > README.md <<'MD'
# sprint-service

Owns classic and agentic sprints for Forgeboard workspaces.

## Boards

Sprint board titles are normalized with `board_label` in `src/sprints.py` (title case).
MD
git add src/sprints.py README.md
pcommit "Add board_label helper for sprint boards"
seed main-sha "$(git rev-parse HEAD)"
seed conf-hash "$(git rev-parse HEAD:config/app.conf)"
seed sprints-hash "$(git rev-parse HEAD:src/sprints.py)"

# Phrases the resolved README must keep (both sides' useful docs).
seed readme-filters-phrase "src/filters.py"
seed readme-label-phrase "board_label"

# Team remote gets advanced main + the pre-rebase feature tip. Learner starts on
# main with no local feature — must fetch and check out origin/$BR first.
attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$BR:refs/heads/$BR"
chown -R learner:learner "$REMOTE"

advanced="$(cat "$SEED/main-sha")"
feature_tip="$(cat "$SEED/orig-feature-sha")"

git checkout -q main
git branch -D "$BR"
git update-ref "refs/remotes/origin/main" "$advanced"
git update-ref -d "refs/remotes/origin/$BR" 2>/dev/null || true
git config --unset "branch.$BR.remote" 2>/dev/null || true
git config --unset "branch.$BR.merge" 2>/dev/null || true

[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]]
[[ "$(git rev-parse main)" == "$advanced" ]]
! git show-ref --verify --quiet "refs/heads/$BR"
! git show-ref --verify --quiet "refs/remotes/origin/$BR"
[[ "$(git -C "$REMOTE" rev-parse refs/heads/main)" == "$advanced" ]]
[[ "$(git -C "$REMOTE" rev-parse "refs/heads/$BR")" == "$feature_tip" ]]
git remote get-url origin >/dev/null

seed_finish
EOF
} | box_script

box_ok "test -d /home/learner/sprint-service/.git" \
  || { fail "setup did not plant ~/sprint-service"; exit 1; }
box_ok "test -d /srv/git/sprint-service.git" \
  || { fail "setup did not plant the team remote"; exit 1; }

ok "sprint-service planted: fetch $BR from origin, rebase onto main (README conflict), force-with-lease push"
