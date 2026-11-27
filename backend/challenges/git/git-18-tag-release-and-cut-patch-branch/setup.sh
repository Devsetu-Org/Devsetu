#!/usr/bin/env bash
# main moved past v2.1.0. Learner annotates + pushes v2.2.0 on current main tip,
# and cuts hotfix/2.1.1 from v2.1.0, lands a real patch commit, pushes it.
# Leave main tip alone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  cat <<'EOF'
base_repo

# 2.1.0 ships with a broken health-check interval (0 = never runs)
cat >> config/app.conf <<'CONF'

[health]
check_interval_seconds = 0
CONF
echo "2.1.0" > VERSION
git add VERSION config/app.conf
pcommit "Release 2.1.0"
seed v210-sha "$(git rev-parse HEAD)"
seed health-broken "$(git rev-parse HEAD:config/app.conf)"
# Annotated tags need tagger identity; commits use -c, but bare `git tag -a` does not.
g tag -a v2.1.0 -m "sprint-service 2.1.0"

# main moved on — 2.2 features already landed, not tagged yet
mkdir -p src
cat > src/card_search.py <<'PY'
"""Card search helpers shipped in sprint-service 2.2."""


def search_cards(query: str) -> list[str]:
    q = (query or "").strip().lower()
    return [q] if q else []
PY
git add src/card_search.py
pcommit "Add card search helper for 2.2"
cat > src/board_export.py <<'PY'
"""Board export helpers shipped in sprint-service 2.2."""


def export_format() -> str:
    return "csv"
PY
git add src/board_export.py
pcommit "Add board export helper for 2.2"
echo "2.2.0" > VERSION
git add VERSION
pcommit "Bump VERSION to 2.2.0"
seed main-sha "$(git rev-parse HEAD)"
seed v220-target "$(git rev-parse HEAD)"

attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "refs/tags/v2.1.0:refs/tags/v2.1.0"

seed_finish
EOF
} | box_script

write_seed patch-health-interval 60
write_seed patch-version 2.1.1

ok "sprint-service planted: v2.1.0 tagged (health=0); main at 2.2.0 untagged — tag v2.2.0 + patch on hotfix/2.1.1"
