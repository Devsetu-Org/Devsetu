#!/usr/bin/env bash
# Bad notify-off commit sits under Priya's card SLA helper commit on shared main.
# Learner opens a fix branch, reverts on that branch, pushes for review — leaves main alone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  cat <<'EOF'
base_repo 3000

cat > src/board_notify.py <<'PY'
"""Sprint board move notifications for Forgeboard watchers."""

NOTIFY_ENABLED = True
CHANNEL = "slack"


def should_notify(event: str) -> bool:
    return NOTIFY_ENABLED and event in ("card_moved", "card_blocked")
PY
git add src/board_notify.py
pcommit "Add board notify helper for card moves"
seed good-notify-hash "$(git rev-parse HEAD:src/board_notify.py)"

# the bad commit
cat > src/board_notify.py <<'PY'
"""Sprint board move notifications for Forgeboard watchers."""

NOTIFY_ENABLED = False  # silence during load test
CHANNEL = "slack"


def should_notify(event: str) -> bool:
    return NOTIFY_ENABLED and event in ("card_moved", "card_blocked")
PY
git add src/board_notify.py
gcommit "Dev Intern" "intern@forgeboard.internal" "Silence board notify during load test"
seed bad-sha "$(git rev-parse HEAD)"

# good helper feature that landed afterwards — must survive
cat > src/card_sla.py <<'PY'
"""SLA breach checks for active Forgeboard sprint cards."""

DEFAULT_SLA_HOURS = 48


def is_sla_breached(age_hours: int, limit_hours: int = DEFAULT_SLA_HOURS) -> bool:
    return age_hours > limit_hours


def sla_badge(age_hours: int, limit_hours: int = DEFAULT_SLA_HOURS) -> str:
    return "breached" if is_sla_breached(age_hours, limit_hours) else "ok"
PY
git add src/card_sla.py
pcommit "Add card SLA breach check helper"
seed main-sha "$(git rev-parse HEAD)"
seed sla-hash "$(git rev-parse HEAD:src/card_sla.py)"

attach_remote
seed_finish
EOF
} | box_script

ok "sprint-service planted: bad board-notify under card SLA helper on main; open a fix branch, revert, push for review"
