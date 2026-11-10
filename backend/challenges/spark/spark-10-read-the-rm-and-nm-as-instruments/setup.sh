#!/usr/bin/env bash
# Spark-10: start YARN, plant one finished probe app the learner must read from
# RM / NM UIs, then verify two claims on the node (yarn logs / local dirs).
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

yarn_bootstrap

PROBE_NAME="store-rollup-probe"

echo "==> plant a finished probe application ($PROBE_NAME)"
in_shell "
  set -euo pipefail
  spark-submit \
    --master yarn \
    --deploy-mode client \
    --name ${PROBE_NAME} \
    --num-executors 2 \
    --executor-cores 1 \
    --executor-memory 512m \
    local:/opt/lab/jobs/store_join.py
" || { echo "probe spark-submit failed" >&2; exit 1; }

# Resolve the probe application id from the RM and stash it for the Guide / grade.
APP_ID="$(
  yarn_apps_json | tr '{' '\n' | awk -v n="$PROBE_NAME" '
    BEGIN { id=""; name=""; state="" }
    /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
    /"name"/ { gsub(/[",]/, "", $0); split($0, a, ":"); name=a[2] }
    /"state"/ { gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
      if (name == n && (state == "FINISHED" || state == "RUNNING" || state == "ACCEPTED")) {
        print id; exit
      }
    }
  '
)"
if [[ -z "${APP_ID}" ]]; then
  # Fallback: yarn CLI from the shell.
  APP_ID="$(
    in_shell "yarn application -list -appStates ALL 2>/dev/null | awk -v n='$PROBE_NAME' '\$2==n { print \$1; exit }'" \
      | tr -d '\r' | awk 'NF{print; exit}'
  )"
fi
if [[ -z "${APP_ID}" ]]; then
  echo "could not resolve probe application id" >&2
  yarn_apps_json >&2 || true
  exit 1
fi

echo "probe application id: $APP_ID"
in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$APP_ID' > /opt/lab/state/probe_app_id && printf '%s\\n' '$PROBE_NAME' > /opt/lab/state/probe_app_name"
in_shell "mkdir -p \"\$HOME/lab\" && printf '%s\\n' '$APP_ID' > \"\$HOME/lab/probe_app_id\" && printf '%s\\n' '$PROBE_NAME' > \"\$HOME/lab/probe_app_name\""

# Cluster should be idle after the probe finishes (no RUNNING apps required).
ok "YARN up with finished probe app $APP_ID"
