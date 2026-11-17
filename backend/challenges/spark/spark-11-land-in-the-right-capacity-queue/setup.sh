#!/usr/bin/env bash
# Spark-11: capacity queues + a lasting submit path that still targets default.
#
# Plant:
#   - default / production / adhoc at 10 / 70 / 20
#   - ~/lab/submit-store-rollup.sh is YARN-shaped but --queue default
#   - Platform notes say store-rollup belongs in production
#   - Running the wrapper leaves store-rollup ACCEPTED in default: the AM ask
#     (~1024 MB) does not fit default's ~10% share of the lab cluster, while
#     production has spare room
#
# Lasting fix: repair the wrapper to --queue production (do not inflate default),
# then run it so a store-rollup finishes in production.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

STUCK_NAME="store-rollup"

# RM REST: print "<id> <state> <queue>" for apps with the given name.
rm_apps_named() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - "$1" <<'PY'
import json, sys, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
for a in ((data.get("apps") or {}).get("app")) or []:
    if a.get("name") == sys.argv[1]:
        print(a.get("id"), a.get("state"), a.get("queue"))
PY
}

yarn_seed_all

echo "==> write capacity queues (default tight, production fat)"
yarn_write_capacity_queues 10 70 20

echo "==> start HDFS + ResourceManager + NodeManagers"
yarn_start_cluster || { echo "YARN start failed" >&2; exit 1; }
yarn_seed_shell_helpers
boot_phase "Preparing the lab"

in_shell 'test -f /opt/lab/jobs/store_join.py && test -f /opt/lab/data/orders.csv' \
  || { echo "lab job / data missing from image" >&2; exit 1; }

echo "==> plant the morning store-rollup wrapper (still points at default)"
in_shell '
  set -euo pipefail
  mkdir -p "$HOME/lab"
  cat > "$HOME/lab/submit-store-rollup.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
# Morning store-rollup — platform cron entry.
# POLICY: store-rollup runs in the production queue on this YARN cluster.
# This copy still has the wrong queue. Fix the lasting path; do not just
# inflate default capacity to make Accepted look green.
set -euo pipefail
exec spark-submit \
  --master yarn \
  --deploy-mode client \
  --queue default \
  --name store-rollup \
  --num-executors 2 \
  --executor-cores 1 \
  --executor-memory 512m \
  /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-store-rollup.sh"

  cat > "$HOME/lab/notes.txt" <<EOF
Chapter 2.3 — store-rollup Accepted; production has room
Platform policy: store-rollup → production queue
Wrapper on disk:  ~/lab/submit-store-rollup.sh
Driver output:    ~/lab/stuck.out   (from the morning run)
Do not raise default capacity to paper over a placement bug.
EOF
'

echo "==> run the broken wrapper so the morning job sits Accepted"
in_shell '
  set -euo pipefail
  nohup setsid "$HOME/lab/submit-store-rollup.sh" > "$HOME/lab/stuck.out" 2>&1 < /dev/null &
  echo $! > "$HOME/lab/stuck.pid"
  echo "stuck driver pid $(cat "$HOME/lab/stuck.pid")"
' || { echo "could not start the morning wrapper" >&2; exit 1; }

echo "==> wait for $STUCK_NAME to be ACCEPTED in default"
STUCK_ID=""
STUCK_QUEUE=""
for i in $(seq 1 60); do
  row="$(rm_apps_named "$STUCK_NAME" 2>/dev/null | awk '$2 == "ACCEPTED" { print; exit }' || true)"
  if [[ -n "$row" ]]; then
    STUCK_ID="$(awk '{ print $1 }' <<<"$row")"
    STUCK_QUEUE="$(awk '{ print $3 }' <<<"$row")"
    break
  fi
  sleep 2
done

if [[ -z "$STUCK_ID" ]]; then
  echo "morning job never reached ACCEPTED on the RM" >&2
  rm_apps_named "$STUCK_NAME" >&2 || true
  in_shell 'tail -n 50 "$HOME/lab/stuck.out"' >&2 || true
  exit 1
fi

# Queue field is often root.default — accept either form.
if [[ "$STUCK_QUEUE" != *default* ]]; then
  echo "expected stuck app in default, RM showed queue=$STUCK_QUEUE" >&2
  exit 1
fi

echo "stuck application id: $STUCK_ID (queue=$STUCK_QUEUE)"
in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$STUCK_ID' > /opt/lab/state/stuck_app_id"
in_shell "printf '%s\\n' '$STUCK_ID' > \"\$HOME/lab/stuck_app_id\""

ok "YARN up; $STUCK_NAME $STUCK_ID ACCEPTED in default; wrapper still --queue default"
