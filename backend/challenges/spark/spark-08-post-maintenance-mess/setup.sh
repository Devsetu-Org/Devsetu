#!/usr/bin/env bash
# Spark-08: Post-Maintenance Mess — three stacked platform faults after a weekend
# "maintenance" script. Master is up; Workers are not healthy; work dirs locked;
# eventLog path is a file instead of a directory.
#
# Plants:
#   1) Wrong Master URL left in ~/lab/MAINTENANCE_MASTER (+ workers never registered)
#   2) chmod 000 on $SPARK_HOME/work on both Workers
#   3) eventlogs path is a FILE (not a dir) on Master + Workers
# Fix: start Workers with the real $SPARK_MASTER_URL, unlock work, restore
# eventlogs dir, re-run store-rollup-probe → STATUS=ok.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

DAEMON_PODS=(ds-spark-01 ds-spark-02 ds-spark-03)

seed_layout() {
  local pod=$1
  kubectl -n "$LEARNER_NS" exec -i "$pod" -c "$pod" -- \
    env SPARK_HOME=/opt/spark HOME=/opt/spark bash -s <<'SEED'
set -euo pipefail
SPARK_HOME="${SPARK_HOME:-/opt/spark}"
export HOME="${HOME:-/opt/spark}"
mkdir -p "$HOME" "$SPARK_HOME/conf" "$SPARK_HOME/logs" "$SPARK_HOME/work"

cat > "$SPARK_HOME/conf/spark-env.sh" <<'EOF'
#!/usr/bin/env bash
export SPARK_LOG_DIR="${SPARK_HOME:-/opt/spark}/logs"
export SPARK_WORKER_DIR="${SPARK_HOME:-/opt/spark}/work"
unset SPARK_MASTER 2>/dev/null || true
EOF

# eventLog.dir points at a path we will turn into a FILE (maintenance botch).
cat > "$SPARK_HOME/conf/spark-defaults.conf" <<'EOF'
spark.worker.timeout 30
spark.eventLog.enabled true
spark.eventLog.dir file:/opt/spark/work/eventlogs
spark.executor.memory 512m
spark.executor.memoryOverhead 128m
EOF

chmod 755 "$SPARK_HOME/conf/spark-env.sh"
SEED
}

seed_jobs() {
  kubectl -n "$LEARNER_NS" exec -i shell -c shell -- \
    env HOME=/opt/spark bash -s <<'ASSETS'
set -euo pipefail
mkdir -p /opt/spark/lab/jobs "$HOME/lab"

cat > /opt/spark/lab/jobs/store_rollup_probe.py <<'EOF'
#!/usr/bin/env python3
"""Light probe — needs registered Workers, writable work dirs, and event logs."""
import os
import sys
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder.appName("store-rollup-probe")
    .config("spark.ui.showConsoleProgress", "false")
    .getOrCreate()
)
sc = spark.sparkContext
sc.setLogLevel("WARN")

print("PROBE_START", flush=True)
status = "fail"
try:
    out = sc.parallelize(range(2000), 8).map(lambda i: (i % 16, i)).reduceByKey(lambda a, b: a + b).count()
    print("PROBE_OK count=%s" % out, flush=True)
    status = "ok"
except Exception as exc:
    print("PROBE_FAIL %s: %s" % (type(exc).__name__, str(exc)[:900]), flush=True)
    status = "fail"

os.makedirs("/opt/spark/lab", exist_ok=True)
with open("/opt/spark/lab/last_run.txt", "w", encoding="utf-8") as fh:
    fh.write("APP=store-rollup-probe\n")
    fh.write("STATUS=%s\n" % status)

try:
    spark.stop()
except Exception:
    pass
sys.exit(0 if status == "ok" else 2)
EOF

chmod 644 /opt/spark/lab/jobs/*.py
rm -f /opt/spark/lab/last_run.txt

# Maintenance left a stale Master URL — do NOT use this to start Workers.
cat > "$HOME/lab/MAINTENANCE_MASTER" <<'EOF'
spark://old-master.quickbite.internal:7077
EOF
cat > "$HOME/lab/maintenance_notes.txt" <<'EOF'
Weekend maintenance checklist (partial):
- rotated Master hostname in inventory → old-master.quickbite.internal
- tightened permissions on /opt/spark/work (security request)
- "cleaned" eventlogs path on every host
EOF
ASSETS
}

for pod in "${DAEMON_PODS[@]}"; do
  echo "==> seed conf on $pod"
  seed_layout "$pod" || exit 1
done

_master_up='ps -eo args 2>/dev/null | grep -F org.apache.spark.deploy.master.Master | grep -vq grep'

boot_phase 'Starting the master'
in_pod ds-spark-01 "
  set -euo pipefail
  export HOME=/opt/spark
  unset SPARK_MASTER 2>/dev/null || true
  if ${_master_up}; then exit 0; fi
  \"\$SPARK_HOME/sbin/start-master.sh\"
  for i in \$(seq 1 45); do
    if ${_master_up}; then exit 0; fi
    sleep 1
  done
  exit 1
" || exit 1

sleep 2

boot_phase 'Preparing the lab'
seed_jobs || exit 1
in_shell 'mkdir -p "$HOME/answers" "$HOME/lab" && rm -f "$HOME/answers"/*'

echo "==> plant: lock Worker work dirs + break eventlogs path (file instead of dir)"
for w in ds-spark-01 ds-spark-02 ds-spark-03; do
  in_pod "$w" '
    set -euo pipefail
    export HOME=/opt/spark
    # Remove any real eventlogs dir and replace with a FILE — Spark cannot create event logs.
    rm -rf /opt/spark/work/eventlogs
    echo "maintenance-placeholder" > /opt/spark/work/eventlogs
  ' || exit 1
done

for w in ds-spark-02 ds-spark-03; do
  in_pod "$w" '
    set -euo pipefail
    # Lock the Worker work dir — executors cannot stage app files.
    chmod 000 /opt/spark/work
  ' || exit 1
done

echo "==> plant: attempt Worker bring-up with the STALE maintenance Master URL (will not register)"
for w in ds-spark-02 ds-spark-03; do
  in_pod "$w" '
    set -euo pipefail
    export HOME=/opt/spark
    unset SPARK_MASTER 2>/dev/null || true
    "$SPARK_HOME/sbin/stop-worker.sh" >/dev/null 2>&1 || true
    # Intentionally wrong — matches ~/lab/MAINTENANCE_MASTER on the shell.
    "$SPARK_HOME/sbin/start-worker.sh" "spark://old-master.quickbite.internal:7077" --cores 2 --memory 1536m >/dev/null 2>&1 || true
  ' || true
done

sleep 3

echo "==> plant a failed probe (no ALIVE workers / broken locals)"
in_shell '
  set -euo pipefail
  export HOME=/opt/spark
  set +e
  # Cap wait — with 0 ALIVE workers a bare submit would hang the boot forever.
  spark-submit \
    --master "$SPARK_MASTER_URL" \
    --deploy-mode client \
    --name store-rollup-probe \
    --total-executor-cores 2 \
    --executor-memory 512m \
    --conf spark.executor.memoryOverhead=128m \
    --conf spark.scheduler.maxRegisteredResourcesWaitingTime=20s \
    /opt/spark/lab/jobs/store_rollup_probe.py \
    > "$HOME/lab/failed_probe.out" 2> "$HOME/lab/failed_probe.err"
  set -e
  cp -f /opt/spark/lab/last_run.txt "$HOME/lab/failed_last_run.txt" 2>/dev/null || true
  rm -f /opt/spark/lab/last_run.txt
'

ok "Master up; maintenance mess planted (stale Master URL, locked work, broken eventlogs)"
