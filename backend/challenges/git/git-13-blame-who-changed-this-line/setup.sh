#!/usr/bin/env bash
# The notify batch multiplier line is wrong. Learner uses blame/log to find who LAST changed it.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

culprit_idx="$((RANDOM % 4))"

ensure_git
fresh_home
ensure_answers
set_learner_git_identity

{
  git_seed_prelude
  echo "culprit_idx=$culprit_idx"
  cat <<'EOF'
devs=(
  "Karthik Rao|karthik@forgeboard.internal"
  "Meera Nair|meera@forgeboard.internal"
  "Sana Qureshi|sana@forgeboard.internal"
  "Diego Alvarez|diego@forgeboard.internal"
)
culprit="${devs[$culprit_idx]}"
others=()
for i in 0 1 2 3; do
  if [ "$i" -ne "$culprit_idx" ]; then others+=("${devs[$i]}"); fi
done
# commit helper: author "Name|email"
dc() { gcommit "${1%%|*}" "${1##*|}" "$2"; }

base_repo 3000

cat > src/board_notify.py <<'PY'
"""Sprint board notify batching for Forgeboard watchers."""

BASE_BATCH = 40
DIGEST_THRESHOLD = 500
NOTIFY_BATCH_MULTIPLIER = 1.0  # peak board-load hours


def notify_batch_size(pending: int) -> float:
    if pending >= DIGEST_THRESHOLD:
        return float(pending)
    return BASE_BATCH * NOTIFY_BATCH_MULTIPLIER
PY
git add src/board_notify.py
pcommit "Add board notify batching module"

# someone else nudges the multiplier first (not the last change)
sed -i 's/^NOTIFY_BATCH_MULTIPLIER = 1.0 /NOTIFY_BATCH_MULTIPLIER = 1.2 /' src/board_notify.py
git add src/board_notify.py
dc "${others[0]}" "Apply a small notify batch bump at peak board load"

# unrelated tweak to a different line in the same file
sed -i 's/^DIGEST_THRESHOLD = 500/DIGEST_THRESHOLD = 400/' src/board_notify.py
git add src/board_notify.py
dc "${others[1]}" "Lower the digest threshold to 400"

# THE change: last person to touch the NOTIFY_BATCH_MULTIPLIER line
sed -i 's/^NOTIFY_BATCH_MULTIPLIER = 1.2 /NOTIFY_BATCH_MULTIPLIER = 9.0 /' src/board_notify.py
git add src/board_notify.py
dc "$culprit" "Tune notify batching for the company all-hands board storm"
seed author-email "${culprit##*|}"
seed author-name "${culprit%%|*}"

# later commits by others on neighbouring lines / other files
sed -i 's/^BASE_BATCH = 40/BASE_BATCH = 45/' src/board_notify.py
git add src/board_notify.py
dc "${others[2]}" "Raise base notify batch to 45"
cat >> README.md <<'MD'

## Board notify

Notify batching lives in `src/board_notify.py`.
MD
git add README.md
dc "${others[0]}" "Point README at the board notify module"

seed main-sha "$(git rev-parse HEAD)"
seed_finish
EOF
} | box_script

ok "sprint-service planted for a blame investigation"
