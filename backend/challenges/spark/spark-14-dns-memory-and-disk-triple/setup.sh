#!/usr/bin/env bash
# Spark-14: DNS + Memory + Disk Triple — three stacked faults; peel the onion.
#
# Plants (all live at once):
#   1) spark.driver.host / wrong bind name on the submit path → executors cannot
#      reach the client driver (connection / hostname failures).
#   2) spark.executor.memoryOverhead too small (48m) for a PySpark burn →
#      lost tasks / Python worker death after the hostname is fixed.
#   3) DISK_FILLER under SPARK_LOCAL_DIRS on Workers → shuffle pressure after
#      memory is fixed.
#
# Fix: correct driver host → raise overhead → remove filler → STATUS=ok.
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
export SPARK_LOCAL_DIRS="${SPARK_HOME:-/opt/spark}/work/spark-local"
unset SPARK_MASTER 2>/dev/null || true
EOF

# Intentionally bad platform defaults — overhead too small; driver host wrong on shell.
cat > "$SPARK_HOME/conf/spark-defaults.conf" <<'EOF'
spark.worker.timeout 30
spark.eventLog.enabled true
spark.eventLog.dir file:/opt/spark/work/eventlogs
spark.executor.memory 512m
spark.executor.memoryOverhead 48m
spark.sql.shuffle.partitions 32
EOF

chmod 755 "$SPARK_HOME/conf/spark-env.sh"
SEED
}

seed_shell_bad_driver_host() {
  kubectl -n "$LEARNER_NS" exec -i shell -c shell -- \
    env HOME=/opt/spark bash -s <<'SHELLBAD'
set -euo pipefail
mkdir -p /opt/spark/conf /opt/spark/lab/jobs "$HOME/lab"

# Append / override on the shell — client driver advertises an unresolvable host.
cat >> /opt/spark/conf/spark-defaults.conf <<'EOF'

# planted by setup — weekend "hostname cleanup"
spark.driver.host=broken-host.quickbite.invalid
spark.driver.bindAddress=0.0.0.0
EOF

cat > /opt/spark/lab/jobs/store_rollup_triple.py <<'EOF'
#!/usr/bin/env python3
"""Needs reachable driver host, sane overhead, and free shuffle locals."""
import os
import sys
import time
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder.appName("store-rollup-triple")
    .config("spark.ui.showConsoleProgress", "false")
    .config("spark.task.maxFailures", "1")
    .getOrCreate()
)
sc = spark.sparkContext
sc.setLogLevel("WARN")

print("TRIPLE_START", flush=True)
status = "fail"
try:
    def burn(i):
        # Force real RSS so tiny memoryOverhead dies after hostname is fixed.
        chunks = [bytearray(40 * 1024 * 1024) for _ in range(4)]
        for c in chunks:
            for j in range(0, len(c), 4096):
                c[j] = (i + j) & 0xFF
        time.sleep(1)
        return sum(len(c) for c in chunks)

    # Narrow burn then a shuffle — hits memory then disk when earlier layers are fixed.
    burned = sc.parallelize(range(4), 4).map(burn).collect()
    print("TRIPLE_BURN %s" % (burned,), flush=True)
    rdd = sc.parallelize(range(80000), 16).map(
        lambda i: (i % 64, ("p%d-" % i) + ("z" * 256))
    )
    out = rdd.reduceByKey(lambda a, b: a).count()
    print("TRIPLE_OK count=%s" % out, flush=True)
    status = "ok"
except Exception as exc:
    print("TRIPLE_FAIL %s: %s" % (type(exc).__name__, str(exc)[:900]), flush=True)
    status = "fail"

os.makedirs("/opt/spark/lab", exist_ok=True)
with open("/opt/spark/lab/last_run.txt", "w", encoding="utf-8") as fh:
    fh.write("APP=store-rollup-triple\n")
    fh.write("STATUS=%s\n" % status)

try:
    spark.stop()
except Exception:
    pass
sys.exit(0 if status == "ok" else 2)
EOF

chmod 644 /opt/spark/lab/jobs/*.py
rm -f /opt/spark/lab/last_run.txt
echo "broken-host.quickbite.invalid" > "$HOME/lab/planted_driver_host.txt"
SHELLBAD
}

plant_filler() {
  local pod=$1
  kubectl -n "$LEARNER_NS" exec -i "$pod" -c "$pod" -- bash -s <<'PLANT'
set -euo pipefail
LOCAL="${SPARK_HOME:-/opt/spark}/work/spark-local"
mkdir -p "$LOCAL"
dd if=/dev/zero of="$LOCAL/DISK_FILLER" bs=1M count=80 status=none 2>/dev/null || \
  head -c $((80*1024*1024)) /dev/zero > "$LOCAL/DISK_FILLER" || true
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
    \"\$SPARK_HOME/sbin/stop-worker.sh\" >/dev/null 2>&1 || true
    sleep 1
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
seed_shell_bad_driver_host || exit 1
in_shell 'mkdir -p "$HOME/answers" "$HOME/lab" && rm -f "$HOME/answers"/*'

echo "==> plant DISK_FILLER on Workers"
for w in ds-spark-02 ds-spark-03; do
  plant_filler "$w" || exit 1
done

echo "==> plant failed triple run"
in_shell '
  set -euo pipefail
  export HOME=/opt/spark
  set +e
  spark-submit \
    --master "$SPARK_MASTER_URL" \
    --deploy-mode client \
    --name store-rollup-triple \
    --total-executor-cores 2 \
    --executor-memory 512m \
    /opt/spark/lab/jobs/store_rollup_triple.py \
    > "$HOME/lab/failed_triple.out" 2> "$HOME/lab/failed_triple.err"
  set -e
  cp -f /opt/spark/lab/last_run.txt "$HOME/lab/failed_last_run.txt" 2>/dev/null || true
  rm -f /opt/spark/lab/last_run.txt
'

ok "cluster warm; DNS + tiny overhead + disk filler planted; failed run recorded"
