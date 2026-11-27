#!/usr/bin/env bash
# format_notify_payload was deleted in a mixed cleanup commit (other wanted
# edits in the same commit). Blame cannot see deleted lines. Learner finds the
# change in history, restores ONLY the helper onto a fix branch, pushes for
# review — leave main alone. A full revert of the cleanup would undo the
# wanted edits and must fail the grader.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=fix/restore-notify-format

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "BR=$(printf '%q' "$BR")"
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

cat > src/notify_format.py <<'PY'
"""Payload formatting for board-notify webhooks."""


def format_notify_payload(event: str, card_id: str) -> dict:
    """Build the Slack-shaped body Ops expects for card events."""
    return {
        "event": event,
        "card_id": card_id,
        "channel": "slack",
        "source": "sprint-service",
    }
PY
git add src/notify_format.py
pcommit "Add format_notify_payload for board-notify webhooks"
seed good-format-hash "$(git rev-parse HEAD:src/notify_format.py)"
seed helper-sha "$(git rev-parse HEAD)"

cat >> README.md <<'MD'

## Board notify

`should_notify()` decides whether card-move events ping watchers.
`format_notify_payload()` builds the Slack body.
MD
git add README.md
pcommit "Document board notify briefly"

# Mixed cleanup: delete the helper AND keep-wanted edits in the same commit.
# Reverting this whole commit would restore the helper but also undo the
# should_notify trim and the README cleanup — grader requires those to stay.
cat > src/board_notify.py <<'PY'
"""Sprint board move notifications for Forgeboard watchers."""

NOTIFY_ENABLED = True
CHANNEL = "slack"


def should_notify(event: str) -> bool:
    # Cleanup: only card moves — blocked cards use a separate path now.
    return NOTIFY_ENABLED and event == "card_moved"
PY
cat >> README.md <<'MD'

Payload formatting for Slack lives with the webhook sender after cleanup.
MD
git rm -q src/notify_format.py
git add src/board_notify.py README.md
gcommit "Dev Intern" "intern@forgeboard.internal" \
  "Board-notify cleanup: drop unused format helper and trim should_notify"
seed delete-sha "$(git rev-parse HEAD)"

cat > src/card_sla.py <<'PY'
"""SLA breach checks for active Forgeboard sprint cards."""

DEFAULT_SLA_HOURS = 48


def is_sla_breached(age_hours: int, limit_hours: int = DEFAULT_SLA_HOURS) -> bool:
    return age_hours > limit_hours
PY
git add src/card_sla.py
pcommit "Add card SLA breach check helper"

seed main-sha "$(git rev-parse HEAD)"
# Wanted cleanup must remain on the fix tip even after restoring the helper.
seed keep-board-notify-hash "$(git rev-parse HEAD:src/board_notify.py)"
seed keep-readme-hash "$(git rev-parse HEAD:README.md)"

attach_remote
git push "$REMOTE" "main:refs/heads/main"

# Learner starts on main; opens a fix branch to restore
git switch main

seed_finish
EOF
} | box_script

ok "mixed cleanup deleted notify helper; restore only that file onto $BR and push"
