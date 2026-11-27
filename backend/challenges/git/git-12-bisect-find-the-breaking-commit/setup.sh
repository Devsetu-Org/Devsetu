#!/usr/bin/env bash
# 20 commits; exactly one flips BUG=0 to BUG=1 in status.env. Learner bisects and records the culprit.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

# which of the 18 filler commits (1..18) introduces the bug — somewhere in the middle
bad_n="$((6 + RANDOM % 9))"   # 6..14

ensure_git
fresh_home
ensure_answers
set_learner_git_identity

{
  git_seed_prelude
  echo "bad_n=$bad_n"
  cat <<'EOF'
base_repo 3000

cat > status.env <<'ENV'
# runtime flags consumed by board status checks in sprint-service
BUG=0
REGION=ap-south-1
ENV
cat > check.sh <<'SH'
#!/bin/sh
# Board status check: exit 0 when healthy, 1 when status.env has BUG=1.
cd "$(dirname "$0")" || exit 2
if grep -q '^BUG=1' status.env; then
  echo "FAIL: BUG=1 in status.env"
  exit 1
fi
echo "OK"
exit 0
SH
chmod +x check.sh
git add status.env check.sh
pcommit "Add board status flags and check script"
git tag v1.0
seed good-sha "$(git rev-parse HEAD)"

subjects=(
  "Add changelog entry for board notify retries"
  "Log board id on notify failure"
  "Bump default page size for board card list"
  "Document column auto-advance in the changelog"
  "Rename internal board notify helper"
  "Add changelog entry for watcher digests"
  "Cache board column lookups for 60 seconds"
  "Tidy notify defaults and update changelog"
  "Add changelog entry for agentic sprint badges"
  "Handle empty board in morning digest"
  "Add changelog entry for blocked-card alerts"
  "Shorten idle board session timeout"
  "Improve error message for webhook decline"
  "Add changelog entry for column WIP limits"
  "Reorder imports in main"
  "Add changelog entry for sprint capacity tip"
  "Trim whitespace in board titles"
  "Add changelog entry for card mention links"
)
authors=(
  "Priya Sharma|priya@forgeboard.internal"
  "Karthik Rao|karthik@forgeboard.internal"
  "Meera Nair|meera@forgeboard.internal"
  "Sana Qureshi|sana@forgeboard.internal"
)
for i in $(seq 1 18); do
  idx=$((i - 1))
  echo "- change $i: ${subjects[$idx]}" >> CHANGELOG.md
  echo "# touched in change $i" >> src/main.py
  if [ "$i" -eq "$bad_n" ]; then
    sed -i 's/^BUG=0/BUG=1/' status.env
    git add status.env
  fi
  git add CHANGELOG.md src/main.py
  a="${authors[$((i % 4))]}"
  gcommit "${a%%|*}" "${a##*|}" "${subjects[$idx]}"
  if [ "$i" -eq "$bad_n" ]; then seed bad-sha "$(git rev-parse HEAD)"; fi
done
seed main-sha "$(git rev-parse HEAD)"
seed seed-commits "$(git rev-list --count HEAD)"
seed_finish
EOF
} | box_script

ok "sprint-service planted with 20 commits and one hidden breaking commit"
