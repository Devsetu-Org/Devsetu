#!/usr/bin/env bash
# Spark-06: heterogeneous Workers + misplaced oversized hold on the big Worker.
# ds-spark-02 (A): 1 core / 768m — can host a right-sized hold only.
# ds-spark-03 (B): 2 cores / 2048m advertised — only host that fits 1024m asks.
# Plant: team-b-debug-hold at 1024m on B (Storage tiny; request fat).
# store-rollup-mem also needs 1024m → cannot use A; sharing B dies under pressure.
# Fix: right-size hold (≤768m), place it on A (stop B briefly if needed), run victim on B.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

DAEMON_PODS=(ds-spark-01 ds-spark-02 ds-spark-03)

seed_layout() {
  local pod=$1
  kubectl -n "$LEARNER_NS" exec -i "$pod" -c "$pod" -- \
    env SPARK_HOME=/opt/spark HOME=/opt/spark bash -s <<'SEED'
set -euo pipefail
SPARK_HOME="${SPARK_HOME:-/opt/spark}"
export HOME="${HOME:-/opt/spark}"
mkdir -p "$HOME" "$SPARK_HOME/conf" "$SPARK_HOME/logs" "$SPARK_HOME/work" "$SPARK_HOME/work/eventlogs"

cat > "$SPARK_HOME/conf/spark-env.sh" <<'EOF'
#!/usr/bin/env bash
export SPARK_LOG_DIR="${SPARK_HOME:-/opt/spark}/logs"
export SPARK_WORKER_DIR="${SPARK_HOME:-/opt/spark}/work"
unset SPARK_MASTER 2>/dev/null || true
EOF

cat > "$SPARK_HOME/conf/spark-defaults.conf" <<'EOF'
spark.worker.timeout 30
spark.eventLog.enabled true
spark.eventLog.dir file:/opt/spark/work/eventlogs
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

cat > /opt/spark/lab/jobs/team_b_debug_hold.py <<'EOF'
#!/usr/bin/env python3
"""Team-B hold — small Storage footprint, long-lived executor."""
import time
from pyspark import StorageLevel
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder.appName("team-b-debug-hold")
    .config("spark.ui.showConsoleProgress", "false")
    .getOrCreate()
)
sc = spark.sparkContext
sc.setLogLevel("WARN")

# ~8 MiB cached — Storage/Executors show used << allocated request.
rdd = sc.parallelize([b"x" * 1024 for _ in range(8 * 1024)], 2)
cached = rdd.persist(StorageLevel.MEMORY_ONLY)
print("X_STORAGE_COUNT=%s" % cached.count(), flush=True)

def hold(_):
    blob = bytearray(100 * 1024 * 1024)
    for i in range(0, len(blob), 4096):
        blob[i] = 1
    print("X_HOLDING", flush=True)
    time.sleep(3600)
    return len(blob)

sc.parallelize([1], 1).map(hold).collect()
spark.stop()
EOF

cat > /opt/spark/lab/jobs/store_rollup_mem.py <<'EOF'
#!/usr/bin/env python3
"""Victim — needs a 1024m executor (only the big Worker can offer that alone)."""
import os
import sys
import time
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder.appName("store-rollup-mem")
    .config("spark.ui.showConsoleProgress", "false")
    .config("spark.task.maxFailures", "1")
    .getOrCreate()
)
sc = spark.sparkContext
sc.setLogLevel("WARN")

def burn(i):
    chunks = [bytearray(70 * 1024 * 1024) for _ in range(8)]
    for c in chunks:
        for j in range(0, len(c), 4096):
            c[j] = (i + j) & 0xFF
    time.sleep(2)
    return sum(len(c) for c in chunks)

status = "fail"
print("Y_START", flush=True)
try:
    out = sc.parallelize(range(4), 4).map(burn).collect()
    print("Y_OK %s" % (out,), flush=True)
    status = "ok"
except Exception as exc:
    print("Y_FAIL %s: %s" % (type(exc).__name__, str(exc)[:800]), flush=True)
    status = "fail"

os.makedirs("/opt/spark/lab", exist_ok=True)
with open("/opt/spark/lab/last_run.txt", "w", encoding="utf-8") as fh:
    fh.write("APP=store-rollup-mem\n")
    fh.write("STATUS=%s\n" % status)

try:
    spark.stop()
except Exception:
    pass
sys.exit(0 if status == "ok" else 2)
EOF

chmod 644 /opt/spark/lab/jobs/*.py
rm -f /opt/spark/lab/last_run.txt
ASSETS
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
  if ${_master_up}; then echo 'Master already up'; exit 0; fi
  \"\$SPARK_HOME/sbin/start-master.sh\"
  for i in \$(seq 1 45); do
    if ${_master_up}; then echo 'Master up'; exit 0; fi
    sleep 1
  done
  exit 1
" || exit 1

sleep 3

boot_phase 'Starting the workers'
echo "==> Worker A ds-spark-02: 1 core / 768m"
in_pod ds-spark-02 "
  set -euo pipefail
  export HOME=/opt/spark
  unset SPARK_MASTER 2>/dev/null || true
  \"\$SPARK_HOME/sbin/stop-worker.sh\" >/dev/null 2>&1 || true
  sleep 1
  \"\$SPARK_HOME/sbin/start-worker.sh\" \"\$SPARK_MASTER_URL\" --cores 1 --memory 768m
  for i in \$(seq 1 45); do
    if ${_worker_up}; then exit 0; fi
    sleep 1
  done
  exit 1
" || exit 1

echo "==> Worker B ds-spark-03: 2 cores / 2048m"
in_pod ds-spark-03 "
  set -euo pipefail
  export HOME=/opt/spark
  unset SPARK_MASTER 2>/dev/null || true
  \"\$SPARK_HOME/sbin/stop-worker.sh\" >/dev/null 2>&1 || true
  sleep 1
  \"\$SPARK_HOME/sbin/start-worker.sh\" \"\$SPARK_MASTER_URL\" --cores 2 --memory 2048m
  for i in \$(seq 1 45); do
    if ${_worker_up}; then exit 0; fi
    sleep 1
  done
  exit 1
" || exit 1

wait_alive_workers 2 || exit 1

boot_phase 'Preparing the lab'
seed_jobs || exit 1
in_shell 'mkdir -p "$HOME/answers" "$HOME/lab" && rm -f "$HOME/answers"/*'

echo "==> plant team-b-debug-hold at 1024m (lands on big Worker B)"
in_shell '
  set -euo pipefail
  export HOME=/opt/spark
  rm -f "$HOME/lab/cotenant.log" "$HOME/lab/cotenant.pid" /opt/spark/lab/last_run.txt
  nohup spark-submit \
    --master "$SPARK_MASTER_URL" \
    --deploy-mode client \
    --name team-b-debug-hold \
    --total-executor-cores 1 \
    --executor-memory 1024m \
    --conf spark.executor.memoryOverhead=128m \
    /opt/spark/lab/jobs/team_b_debug_hold.py \
    > "$HOME/lab/cotenant.log" 2>&1 &
  echo $! > "$HOME/lab/cotenant.pid"
'

cotenant_up=0
for i in $(seq 1 90); do
  if master_json | tr '"' '\n' | grep -Fxq 'team-b-debug-hold'; then
    cotenant_up=1
    break
  fi
  sleep 2
done
[[ "$cotenant_up" -eq 1 ]] || { in_shell 'tail -n 80 "$HOME/lab/cotenant.log"' >&2 || true; exit 1; }

# Wait until hold task pinned.
for i in $(seq 1 60); do
  if in_shell 'grep -q X_HOLDING "$HOME/lab/cotenant.log" 2>/dev/null'; then break; fi
  sleep 2
done
sleep 3

echo "==> plant failed victim beside the hold on B"
in_shell '
  set -euo pipefail
  export HOME=/opt/spark
  set +e
  spark-submit \
    --master "$SPARK_MASTER_URL" \
    --deploy-mode client \
    --name store-rollup-mem \
    --total-executor-cores 1 \
    --executor-memory 1024m \
    --conf spark.executor.memoryOverhead=128m \
    /opt/spark/lab/jobs/store_rollup_mem.py \
    > "$HOME/lab/failed_victim.out" 2> "$HOME/lab/failed_victim.err"
  set -e
  cp -f /opt/spark/lab/last_run.txt "$HOME/lab/failed_last_run.txt" 2>/dev/null || true
  rm -f /opt/spark/lab/last_run.txt
'

ok "heterogeneous Workers up; oversized hold on B; victim failure planted"
