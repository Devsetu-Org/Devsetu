#!/usr/bin/env bash
# Spark-11: multi-queue YARN; plant an Accepted app in default; production has room.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

yarn_seed_all
yarn_write_capacity_queues 10 70 20
yarn_start_cluster
yarn_seed_shell_helpers

echo "==> plant Accepted store-rollup in the default queue"
# Fire-and-forget: this submit will sit Accepted (default cannot fit the shape).
in_shell '
  set -euo pipefail
  nohup spark-submit \
    --master yarn \
    --deploy-mode client \
    --queue default \
    --name store-rollup-stuck \
    --num-executors 2 \
    --executor-cores 1 \
    --executor-memory 512m \
    local:/opt/lab/jobs/store_join.py \
    >/tmp/stuck-submit.log 2>&1 &
  echo $! > /tmp/stuck-submit.pid
  echo "stuck submit pid $(cat /tmp/stuck-submit.pid)"
'

# Wait until the RM shows an ACCEPTED (or NEW_SAVING) app named store-rollup-stuck.
stuck_id=""
for i in $(seq 1 45); do
  stuck_id="$(
    yarn_apps_json | tr '{' '\n' | awk '
      BEGIN { id=""; name=""; state="" }
      /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
      /"name"/ { gsub(/[",]/, "", $0); split($0, a, ":"); name=a[2] }
      /"state"/ {
        gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
        if (name == "store-rollup-stuck" && (state == "ACCEPTED" || state == "NEW" || state == "NEW_SAVING" || state == "SUBMITTED")) {
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
  echo "stuck Accepted app did not appear" >&2
  in_shell 'tail -n 40 /tmp/stuck-submit.log 2>/dev/null || true' >&2 || true
  yarn_apps_json >&2 || true
  exit 1
fi

echo "stuck application id: $stuck_id"
in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$stuck_id' > /opt/lab/state/stuck_app_id"
in_shell "printf '%s\\n' '$stuck_id' > \"\$HOME/lab/stuck_app_id\""

ok "YARN up; store-rollup-stuck is Accepted in default ($stuck_id)"
