#!/usr/bin/env bash
# Spark-07 capstone: healthy → shuffle → FetchFailed.
# Plant: Worker local shuffle dirs under pressure — a janitor wipes blockmgr
# shuffle blocks (disk-pressure / cleanup gone wrong) plus a small capped filler
# so df shows a tight spark-local path. Platform fix: stop janitor, free local
# space, re-run. Not app cache() edits; not Lab 6 placement.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

DAEMON_PODS=(ds-spark-01 ds-spark-02 ds-spark-03)

seed_layout() {
  local pod=$1
  kubectl -n "$LEARNER_NS" exec -i "$pod" -c "$pod" -- \
    env SPARK_HOME=/opt/spark HOME=/opt/spark bash -s <<'SEED'
set -euo pipefail
SPARK_HOME="${SPARK_HOME:-/opt/spark}"
export HOME="${HOME:-/opt/spark}"
mkdir -p "$HOME" "$SPARK_HOME/conf" "$SPARK_HOME/logs" "$SPARK_HOME/work" \
  "$SPARK_HOME/work/eventlogs" "$SPARK_HOME/work/spark-local"

cat > "$SPARK_HOME/conf/spark-env.sh" <<'EOF'
#!/usr/bin/env bash
export SPARK_LOG_DIR="${SPARK_HOME:-/opt/spark}/logs"
export SPARK_WORKER_DIR="${SPARK_HOME:-/opt/spark}/work"
# Shuffle / spill locals — the surface this lab pressures.
export SPARK_LOCAL_DIRS="${SPARK_HOME:-/opt/spark}/work/spark-local"
unset SPARK_MASTER 2>/dev/null || true
EOF

cat > "$SPARK_HOME/conf/spark-defaults.conf" <<'EOF'
spark.worker.timeout 30
spark.eventLog.enabled true
spark.eventLog.dir file:/opt/spark/work/eventlogs
spark.executor.memory 512m
spark.executor.memoryOverhead 128m
spark.sql.shuffle.partitions 64
EOF

chmod 755 "$SPARK_HOME/conf/spark-env.sh"
SEED
}

seed_jobs() {
  kubectl -n "$LEARNER_NS" exec -i shell -c shell -- \
    env HOME=/opt/spark bash -s <<'ASSETS'
set -euo pipefail
mkdir -p /opt/spark/lab/jobs "$HOME/lab"

cat > /opt/spark/lab/jobs/store_rollup_shuffle.py <<'EOF'
#!/usr/bin/env python3
"""Shuffle-heavy rollup — needs durable Worker local shuffle blocks."""
import os
import sys
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder.appName("store-rollup-shuffle")
    .config("spark.sql.shuffle.partitions", "64")
    .config("spark.ui.showConsoleProgress", "false")
    .getOrCreate()
)
sc = spark.sparkContext
sc.setLogLevel("WARN")

print("SHUFFLE_START", flush=True)
status = "fail"
try:
    # Enough partitions/keys to force a real shuffle without starving 512m executors.
    rdd = sc.parallelize(range(120000), 24).map(
        lambda i: (i % 96, ("p%d-" % i) + ("z" * 512))
    )
    out = rdd.reduceByKey(lambda a, b: a).count()
    print("SHUFFLE_OK count=%s" % out, flush=True)
    status = "ok"
except Exception as exc:
    print("SHUFFLE_FAIL %s: %s" % (type(exc).__name__, str(exc)[:900]), flush=True)
    status = "fail"

os.makedirs("/opt/spark/lab", exist_ok=True)
with open("/opt/spark/lab/last_run.txt", "w", encoding="utf-8") as fh:
    fh.write("APP=store-rollup-shuffle\n")
    fh.write("STATUS=%s\n" % status)

spark.stop()
sys.exit(0 if status == "ok" else 2)
EOF

chmod 644 /opt/spark/lab/jobs/*.py
rm -f /opt/spark/lab/last_run.txt
ASSETS
}

plant_local_pressure() {
  local pod=$1
  kubectl -n "$LEARNER_NS" exec -i "$pod" -c "$pod" -- bash -s <<'PLANT'
set -euo pipefail
export HOME=/opt/spark
LOCAL="${SPARK_HOME:-/opt/spark}/work/spark-local"
mkdir -p "$LOCAL" "$HOME/lab"

# Capped filler — evidence for df; never unbounded (protects shared hosts).
# 80 MiB is enough signal without filling a node.
dd if=/dev/zero of="$LOCAL/DISK_FILLER" bs=1M count=80 status=none 2>/dev/null || \
  head -c $((80*1024*1024)) /dev/zero > "$LOCAL/DISK_FILLER" || true

# Janitor: wipe shuffle blockmgr files — simulates disk-pressure cleanup
# destroying map outputs → FetchFailed on the reduce side.
cat > "$HOME/lab/shuffle_janitor.sh" <<'JAN'
#!/usr/bin/env bash
WORK="${SPARK_HOME:-/opt/spark}/work"
while true; do
  sleep 2
  find "$WORK" -type f \( -path '*/blockmgr-*/*' -o -name 'shuffle_*' \) \
    ! -name 'DISK_FILLER' -delete 2>/dev/null || true
done
JAN
chmod 755 "$HOME/lab/shuffle_janitor.sh"
nohup "$HOME/lab/shuffle_janitor.sh" > "$HOME/lab/shuffle_janitor.log" 2>&1 &
echo $! > "$HOME/lab/shuffle_janitor.pid"
echo "janitor pid=$(cat "$HOME/lab/shuffle_janitor.pid") on $(hostname)"
PLANT
}

for pod in "${DAEMON_PODS[@]}"; do
  echo "==> seed conf on $pod"
  seed_layout "$pod" || exit 1
done

_master_up='ps -eo args 2>/dev/null | grep -F org.apache.spark.deploy.master.Master | grep -vq grep'
_worker_up='ps -eo args 2>/dev/null | grep -F org.apache.spark.deploy.worker.Worker | grep -vq grep'

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

sleep 3

boot_phase 'Starting the workers'
for w in ds-spark-02 ds-spark-03; do
  in_pod "$w" "
    set -euo pipefail
    export HOME=/opt/spark
    unset SPARK_MASTER 2>/dev/null || true
    if ${_worker_up}; then
      \"\$SPARK_HOME/sbin/stop-worker.sh\" >/dev/null 2>&1 || true
      sleep 1
    fi
    \"\$SPARK_HOME/sbin/start-worker.sh\" \"\$SPARK_MASTER_URL\" --cores 2 --memory 1536m
    for i in \$(seq 1 45); do
      if ${_worker_up}; then exit 0; fi
      sleep 1
    done
    exit 1
  " || exit 1
done

wait_alive_workers 2 || exit 1

boot_phase 'Preparing the lab'
seed_jobs || exit 1
in_shell 'mkdir -p "$HOME/answers" "$HOME/lab" && rm -f "$HOME/answers"/*'

echo "==> plant local-dir filler + shuffle janitor on Workers"
for w in ds-spark-02 ds-spark-03; do
  plant_local_pressure "$w" || exit 1
done

echo "==> plant a failed shuffle run"
in_shell '
  set -euo pipefail
  export HOME=/opt/spark
  set +e
  spark-submit \
    --master "$SPARK_MASTER_URL" \
    --deploy-mode client \
    --name store-rollup-shuffle \
    --total-executor-cores 2 \
    --executor-memory 512m \
    --conf spark.executor.memoryOverhead=128m \
    /opt/spark/lab/jobs/store_rollup_shuffle.py \
    > "$HOME/lab/failed_shuffle.out" 2> "$HOME/lab/failed_shuffle.err"
  set -e
  cp -f /opt/spark/lab/last_run.txt "$HOME/lab/failed_last_run.txt" 2>/dev/null || true
  rm -f /opt/spark/lab/last_run.txt
'

ok "cluster warm; shuffle-local pressure planted; failed shuffle recorded"
