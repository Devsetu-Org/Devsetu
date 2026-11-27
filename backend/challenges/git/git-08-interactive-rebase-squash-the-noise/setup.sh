#!/usr/bin/env bash
# feature/csv-export has 5 noisy WIP commits on origin only. Learner starts on
# main, fetches/checks out the feature, squashes into 2 meaningful commits, then
# force-with-lease pushes so Priya can review.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=feature/csv-export

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "BR=$(printf '%q' "$BR")"
  cat <<'EOF'
base_repo
seed main-sha "$(git rev-parse HEAD)"

git checkout -q -b "$BR"
mkdir -p tests

cat > src/csv_export.py <<'PY'
"""CSV export for sprint boards (skeleton)."""


def export_rows(cards):
    pass
PY
git add -A
acommit "wip"

cat > src/csv_export.py <<'PY'
"""CSV export for Forgeboard sprint boards."""

HEADERS = ("id", "title", "column", "points")


def export_rows(cards: list) -> list:
    rows = [HEADERS]
    for card in cards:
        rows.append(
            (
                str(card.get("id", "")),
                str(card.get("title", "")),
                str(card.get("column", "")),
                str(card.get("points", 0)),
            )
        )
    return rows
PY
git add -A
acommit "wip 2 - actually write it"

cat > tests/test_csv_export.py <<'PY'
from src.csv_export import export_rows, HEADERS


def test_headers_first():
    rows = export_rows([])
    assert rows[0] == HEADERS


def test_one_card():
    rows = export_rows([{"id": "c1", "title": "Ship", "column": "done", "points": 3}])
    assert rows[1] == ("c1", "Ship", "done", "3")
PY
git add -A
acommit "WIP tests"

sed -i 's/str(card.get("points", 0))/str(int(card.get("points", 0) or 0))/' src/csv_export.py
git add -A
acommit "fixup typo in csv_export"

cat >> README.md <<'MD'

## CSV export

`src/csv_export.py` turns sprint cards into CSV rows for board downloads.
MD
git add -A
acommit "wip docs"

seed orig-tip "$(git rev-parse HEAD)"
seed orig-tree "$(git rev-parse 'HEAD^{tree}')"

# Team remote: main + the noisy pre-squash feature tip. Learner starts on main
# with no local feature — must fetch and check out origin/$BR before squashing.
attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$BR:refs/heads/$BR"
chown -R learner:learner "$REMOTE"

main_tip="$(cat "$SEED/main-sha")"
feature_tip="$(cat "$SEED/orig-tip")"

git checkout -q main
git branch -D "$BR"
git update-ref "refs/remotes/origin/main" "$main_tip"
git update-ref -d "refs/remotes/origin/$BR" 2>/dev/null || true
git config --unset "branch.$BR.remote" 2>/dev/null || true
git config --unset "branch.$BR.merge" 2>/dev/null || true

[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]]
[[ "$(git rev-parse main)" == "$main_tip" ]]
! git show-ref --verify --quiet "refs/heads/$BR"
! git show-ref --verify --quiet "refs/remotes/origin/$BR"
[[ "$(git -C "$REMOTE" rev-parse refs/heads/main)" == "$main_tip" ]]
[[ "$(git -C "$REMOTE" rev-parse "refs/heads/$BR")" == "$feature_tip" ]]
git remote get-url origin >/dev/null

seed_finish
EOF
} | box_script

box_ok "test -d /home/learner/sprint-service/.git" \
  || { fail "setup did not plant ~/sprint-service"; exit 1; }
box_ok "test -d /srv/git/sprint-service.git" \
  || { fail "setup did not plant the team remote"; exit 1; }

ok "sprint-service planted: fetch $BR from origin, squash WIP into 2 commits, force-with-lease push"
