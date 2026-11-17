#!/usr/bin/env bash
# Spark-12: stacked failure — client-mode edge driver dies, then cluster mode
# hits shell-only data paths.
#
# Plant:
#   - CSVs only under ~/lab/edge-data/ on shell (not on the NodeManagers)
#   - ~/lab/store_rollup.py reads those edge paths
#   - ~/lab/submit-store-rollup.sh still uses --deploy-mode client
#   - Overnight sleep job in client mode is killed mid-flight → FAILED
#   - /mnt/lab-shared is the cluster-wide mount (empty at start)
#
# Fix path: cluster deploy mode + copy data to /mnt/lab-shared + point the job
# at the shared paths + prove FINISHED with AM on a NodeManager.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

FAILED_NAME="overnight-edge-driver"
SHARED="/mnt/lab-shared"

rm_apps_named() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - "$1" <<'PY'
import json, sys, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
for a in ((data.get("apps") or {}).get("app")) or []:
    if a.get("name") == sys.argv[1]:
        print(a.get("id"), a.get("state"), a.get("finalStatus"))
PY
}

yarn_bootstrap

in_shell 'test -f /opt/lab/data/orders.csv && test -f /opt/lab/data/stores.csv' \
  || { echo "lab CSV data missing from image" >&2; exit 1; }

echo "==> ensure shared mount exists (cluster volume at $SHARED)"
for host in ds-spark-01 ds-spark-02 ds-spark-03 shell; do
  in_pod "$host" "mkdir -p '$SHARED' && test -d '$SHARED' && echo shared-ok-on-\$(hostname)" \
    || { echo "shared mount missing on $host — expected $SHARED" >&2; exit 1; }
done

echo "==> plant edge-only data + jobs + client-mode wrapper on shell"
in_shell "
  set -euo pipefail
  mkdir -p \"\$HOME/lab/edge-data\" \"\$HOME/lab\"
  cp -f /opt/lab/data/orders.csv /opt/lab/data/stores.csv \"\$HOME/lab/edge-data/\"
  # Must NOT appear on the shared mount yet.
  rm -rf '$SHARED'/rollup 2>/dev/null || true

  cat > \"\$HOME/lab/store_rollup.py\" <<'PY'
import time
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()
# Edge laptop paths — fine in client mode (driver on shell). Wrong for cluster mode.
orders = spark.read.csv(
    \"file:///home/spark/lab/edge-data/orders.csv\", header=True, inferSchema=True
)
stores = spark.read.csv(
    \"file:///home/spark/lab/edge-data/stores.csv\", header=True, inferSchema=True
)
joined = orders.join(stores, \"store_id\")
rollup = joined.groupBy(\"region\").sum(\"amount\")
rollup.orderBy(\"region\").show(truncate=False)
spark.stop()
PY

  cat > \"\$HOME/lab/overnight_rollup.py\" <<'PY'
import time
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()
# Same edge paths as store_rollup — then sleep so setup can kill the edge driver.
orders = spark.read.csv(
    \"file:///home/spark/lab/edge-data/orders.csv\", header=True, inferSchema=True
)
stores = spark.read.csv(
    \"file:///home/spark/lab/edge-data/stores.csv\", header=True, inferSchema=True
)
_ = orders.join(stores, \"store_id\").count()
time.sleep(3600)
spark.stop()
PY

  cat > \"\$HOME/lab/submit-store-rollup.sh\" <<'EOF'
#!/usr/bin/env bash
# Production store-rollup entry. POLICY: unattended jobs use cluster deploy mode
# and data under /mnt/lab-shared (visible on every YARN host).
# This copy still uses client mode and edge-laptop paths.
set -euo pipefail
exec spark-submit \\
  --master yarn \\
  --deploy-mode client \\
  --name store-rollup \\
  --num-executors 2 \\
  --executor-cores 1 \\
  --executor-memory 512m \\
  \"\$HOME/lab/store_rollup.py\"
EOF
  chmod +x \"\$HOME/lab/submit-store-rollup.sh\"

  cat > \"\$HOME/lab/notes.txt\" <<EOF
Chapter 2.4 — overnight edge driver died; morning wrapper still fragile
Failed overnight app: see ~/lab/failed_app_id
Wrapper:             ~/lab/submit-store-rollup.sh
Job:                 ~/lab/store_rollup.py
Edge-only CSVs:      ~/lab/edge-data/   (shell only — not on the NMs)
Cluster shared mount: $SHARED/          (same path on shell + every NodeManager)
Platform policy: cluster deploy mode + data on the shared mount.
EOF
"

echo "==> start overnight client-mode job, then kill the shell driver"
in_shell "
  set -euo pipefail
  nohup setsid spark-submit \
    --master yarn \
    --deploy-mode client \
    --name $FAILED_NAME \
    --num-executors 2 \
    --executor-cores 1 \
    --executor-memory 512m \
    \"\$HOME/lab/overnight_rollup.py\" \
    > \"\$HOME/lab/overnight.out\" 2>&1 < /dev/null &
  echo \$! > \"\$HOME/lab/overnight.pid\"
  echo \"overnight pid \$(cat \"\$HOME/lab/overnight.pid\")\"
"

APP_ID=""
for i in $(seq 1 60); do
  APP_ID="$(rm_apps_named "$FAILED_NAME" 2>/dev/null | awk '$2 == "RUNNING" || $2 == "ACCEPTED" { print $1; exit }' || true)"
  [[ -n "$APP_ID" ]] && break
  sleep 2
done
if [[ -z "$APP_ID" ]]; then
  echo "overnight app never appeared" >&2
  in_shell 'tail -n 40 "$HOME/lab/overnight.out"' >&2 || true
  exit 1
fi
echo "overnight application id: $APP_ID"

# Let the driver get past the CSV read, then kill the edge driver tree.
# Do NOT pkill -f patterns that also appear in this bash -c cmdline — that
# kills the setup exec itself (exit 143) before the app can fail on the RM.
sleep 10
in_shell '
  set +e
  if [[ -f "$HOME/lab/overnight.pid" ]]; then
    pid=$(cat "$HOME/lab/overnight.pid")
    # Process group of the nohup setsid spark-submit (driver + children).
    kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    sleep 2
    kill -KILL -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
  fi
  # Client-mode driver JVMs on this shell only (jps — never pkill -f).
  while read -r jpid; do
    [[ -n "$jpid" ]] || continue
    kill -TERM "$jpid" 2>/dev/null
  done < <(jps -l 2>/dev/null | awk "/[Ss]park[Ss]ubmit|[Pp]ython/ { print \$1 }")
  sleep 1
  echo "edge driver kill attempted"
  set -e
'

ended=""
for i in $(seq 1 45); do
  row="$(rm_apps_named "$FAILED_NAME" 2>/dev/null | awk -v id="$APP_ID" '$1 == id { print; exit }' || true)"
  st="$(awk '{ print $2 }' <<<"$row")"
  if [[ "$st" == "FAILED" || "$st" == "KILLED" || "$st" == "FINISHED" ]]; then
    ended="$st"
    break
  fi
  sleep 2
done
echo "overnight app ended in state ${ended:-unknown}"

in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$APP_ID' > /opt/lab/state/failed_app_id"
in_shell "printf '%s\\n' '$APP_ID' > \"\$HOME/lab/failed_app_id\""

# Prove edge data is not on the NMs / shared mount.
in_pod ds-spark-02 "test ! -f /home/spark/lab/edge-data/orders.csv" || true
in_pod ds-spark-02 "test ! -f $SHARED/rollup/orders.csv" \
  || { echo "shared mount already had rollup data — plant leaked" >&2; exit 1; }

ok "planted failed client edge driver $APP_ID; wrapper still client + edge paths"
