#!/usr/bin/env bash
# Spark-12: start a client-mode driver on the shell, kill it mid-job, leave the
# failed app for the learner to replace with cluster mode.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

yarn_bootstrap
yarn_install_sleep_job

echo "==> start client-mode edge driver (sleep job on shell)"
in_shell '
  set -euo pipefail
  nohup spark-submit \
    --master yarn \
    --deploy-mode client \
    --name edge-driver-fragile \
    --num-executors 2 \
    --executor-cores 1 \
    --executor-memory 512m \
    "$HOME/lab/sleep_backfill.py" \
    >/tmp/edge-driver.log 2>&1 &
  echo $! > /tmp/edge-driver.pid
  echo "edge driver spark-submit pid $(cat /tmp/edge-driver.pid)"
'

app_id=""
for i in $(seq 1 60); do
  app_id="$(
    yarn_apps_json | tr '{' '\n' | awk '
      BEGIN { id=""; name=""; state="" }
      /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
      /"name"/ { gsub(/[",]/, "", $0); split($0, a, ":"); name=a[2] }
      /"state"/ {
        gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
        if (name == "edge-driver-fragile" && (state == "RUNNING" || state == "ACCEPTED")) {
          print id; exit
        }
      }
    '
  )"
  if [[ -n "$app_id" ]]; then
    break
  fi
  sleep 2
done

if [[ -z "$app_id" ]]; then
  echo "edge-driver app never appeared" >&2
  in_shell 'tail -n 50 /tmp/edge-driver.log 2>/dev/null || true' >&2 || true
  exit 1
fi

echo "edge application id: $app_id (waiting briefly then killing shell driver)"
sleep 8

# Kill the client-mode driver tree on the shell (spark-submit + child JVMs).
in_shell '
  set -euo pipefail
  if [[ -f /tmp/edge-driver.pid ]]; then
    pid=$(cat /tmp/edge-driver.pid)
    # Kill the submit process group; fall back to pkill on SparkSubmit.
    kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  fi
  pkill -f "org.apache.spark.deploy.SparkSubmit" 2>/dev/null || true
  pkill -f "edge-driver-fragile" 2>/dev/null || true
  # Also stop any local driver JVM leftover from client mode.
  jps -l 2>/dev/null | awk "/SparkSubmit|SparkPi|sleep_backfill|queue-backfill/ { print \$1 }" | xargs -r kill -TERM 2>/dev/null || true
  sleep 2
  echo "edge driver kill attempted"
'

# Wait until the app leaves RUNNING (FAILED/KILLED).
for i in $(seq 1 45); do
  st="$(
    yarn_apps_json | tr '{' '\n' | awk -v want="$app_id" '
      BEGIN { id=""; state="" }
      /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
      /"state"/ {
        gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
        if (id == want) { print state; exit }
      }
    '
  )"
  if [[ "$st" == "FAILED" || "$st" == "KILLED" || "$st" == "FINISHED" ]]; then
    echo "edge app ended in state $st"
    break
  fi
  sleep 2
done

in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$app_id' > /opt/lab/state/failed_app_id"
in_shell "printf '%s\\n' '$app_id' > \"\$HOME/lab/failed_app_id\""

ok "planted failed client-mode edge driver app $app_id"
