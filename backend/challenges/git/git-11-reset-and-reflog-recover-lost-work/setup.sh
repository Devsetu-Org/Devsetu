#!/usr/bin/env bash
# Learner was on a private feature tip, committed, then `git reset --hard HEAD~1`
# before pushing. Recover onto the feature, then push for review — leave main alone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=feature/column-auto-advance
stale="$((5 + RANDOM % 20))"   # hours before a Doing card auto-advances

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "stale=$stale"
  echo "BR=$(printf '%q' "$BR")"
  cat <<'EOF'
base_repo 3000

cat > src/columns.py <<'PY'
"""Sprint board column names for Forgeboard boards."""

COLUMNS = ("todo", "doing", "blocked", "done")
PY
git add src/columns.py
pcommit "Add board column names"
seed main-sha "$(git rev-parse HEAD)"
seed seed-commits "$(git rev-list --count HEAD)"

# Feature tip — afternoon's work (and the accident) live here; never pushed the auto-advance.
git switch -c "$BR"

cat > src/column_automate.py <<PY
"""Auto-advance stale Doing cards so boards do not stall."""

STALE_HOURS = $stale
SOURCE_COLUMN = "doing"
TARGET_COLUMN = "blocked"


def should_auto_advance(hours_in_column: int) -> bool:
    return hours_in_column >= STALE_HOURS
PY
git add src/column_automate.py
acommit "Add column auto-advance for stale Doing cards"
seed lost-sha "$(git rev-parse HEAD)"
seed automate-hash "$(git rev-parse HEAD:src/column_automate.py)"

# Accident before push — rewind local feature only.
tick
git -c user.name="Ada Learner" -c user.email="ada@forgeboard.internal" reset -q --hard HEAD~1

# Remote sees main + feature at the post-reset tip (no auto-advance on origin yet).
attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$BR:refs/heads/$BR"

seed_finish
EOF
} | box_script

write_seed stale-hours "$stale"
write_seed feature-branch "$BR"

ok "sprint-service planted on $BR; auto-advance lost locally — recover, then push for review (stale=${stale}h)"
