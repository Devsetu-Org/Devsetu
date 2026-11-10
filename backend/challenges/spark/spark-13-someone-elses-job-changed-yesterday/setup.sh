#!/usr/bin/env bash
# Spark-13: fill production with a backfill; leave store-rollup Accepted in production.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

yarn_seed_all
# Tight default, fat production (then filled), spare adhoc lane for the fix.
yarn_write_capacity_queues 10 70 20
yarn_start_cluster
yarn_seed_shell_helpers
yarn_install_sleep_job

echo "==> plant team-b backfill in production (holds capacity)"
in_shell '
  set -euo pipefail
  nohup spark-submit \
    --master yarn \
    --deploy-mode client \
    --queue production \
    --name team-b-backfill \
    --num-executors 2 \
    --executor-cores 1 \
    --executor-memory 512m \
    "$HOME/lab/sleep_backfill.py" \
    >/tmp/backfill.log 2>&1 &
  echo $! > /tmp/backfill.pid
'

blocker_id=""
for i in $(seq 1 60); do
  blocker_id="$(
    yarn_apps_json | tr '{' '\n' | awk '
      BEGIN { id=""; name=""; state="" }
      /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
      /"name"/ { gsub(/[",]/, "", $0); split($0, a, ":"); name=a[2] }
      /"state"/ {
        gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
        if (name == "team-b-backfill" && (state == "RUNNING" || state == "ACCEPTED")) {
          print id; exit
        }
      }
    '
  )"
  if [[ -n "$blocker_id" ]]; then
    # Prefer waiting until RUNNING so it actually holds containers.
    st="$(
      yarn_apps_json | tr '{' '\n' | awk -v want="$blocker_id" '
        BEGIN { id=""; state="" }
        /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
        /"state"/ {
          gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
          if (id == want) { print state; exit }
        }
      '
    )"
    if [[ "$st" == "RUNNING" ]]; then
      break
    fi
  fi
  sleep 2
done

if [[ -z "$blocker_id" ]]; then
  echo "backfill never appeared" >&2
  in_shell 'tail -n 40 /tmp/backfill.log 2>/dev/null || true' >&2 || true
  exit 1
fi
echo "blocker application id: $blocker_id"

echo "==> plant Accepted store-rollup-yesterday in production (behind the backfill)"
in_shell '
  set -euo pipefail
  nohup spark-submit \
    --master yarn \
    --deploy-mode client \
    --queue production \
    --name store-rollup-yesterday \
    --num-executors 2 \
    --executor-cores 1 \
    --executor-memory 512m \
    local:/opt/lab/jobs/store_join.py \
    >/tmp/yesterday-stuck.log 2>&1 &
  echo $! > /tmp/yesterday-stuck.pid
'

stuck_id=""
for i in $(seq 1 45); do
  stuck_id="$(
    yarn_apps_json | tr '{' '\n' | awk '
      BEGIN { id=""; name=""; state="" }
      /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
      /"name"/ { gsub(/[",]/, "", $0); split($0, a, ":"); name=a[2] }
      /"state"/ {
        gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
        if (name == "store-rollup-yesterday" && (state == "ACCEPTED" || state == "NEW" || state == "SUBMITTED")) {
          print id; exit
        }
      }
    '
  )"
  if [[ -n "$stuck_id" ]]; then
    break
  fi
  sleep 2
done

if [[ -z "$stuck_id" ]]; then
  echo "yesterday stuck app did not appear (production may still have room — check sizing)" >&2
  yarn_apps_json >&2 || true
  in_shell 'tail -n 40 /tmp/yesterday-stuck.log 2>/dev/null || true' >&2 || true
  # Still record blocker so the lab is debuggable.
  in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$blocker_id' > /opt/lab/state/blocker_app_id"
  exit 1
fi

echo "stuck application id: $stuck_id"
in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$blocker_id' > /opt/lab/state/blocker_app_id && printf '%s\\n' '$stuck_id' > /opt/lab/state/stuck_app_id"
in_shell "printf '%s\\n' '$blocker_id' > \"\$HOME/lab/blocker_app_id\"; printf '%s\\n' '$stuck_id' > \"\$HOME/lab/stuck_app_id\""

ok "production saturated by $blocker_id; store-rollup-yesterday Accepted as $stuck_id"
