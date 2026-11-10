#!/usr/bin/env bash
# Spark-03: warm the standalone cluster (2 ALIVE), seed three DAG-shape jobs
# + CSVs on shell and Workers. Learner submits each and traces the Application UI.
# No fault plant — orientation after the flaky-Worker incident.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

DAEMON_PODS=(ds-spark-01 ds-spark-02 ds-spark-03)
LAB_PODS=(shell ds-spark-02 ds-spark-03)

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
# Daemon / process environment. Sourced before Master or Worker starts.
export SPARK_LOG_DIR="${SPARK_HOME:-/opt/spark}/logs"
export SPARK_WORKER_DIR="${SPARK_HOME:-/opt/spark}/work"
# spark-daemon.sh treats SPARK_MASTER as an rsync host — never set it here.
unset SPARK_MASTER 2>/dev/null || true
EOF

cat > "$SPARK_HOME/conf/spark-defaults.conf" <<'EOF'
# Application defaults.
spark.worker.timeout 30
spark.eventLog.enabled true
spark.eventLog.dir file:/opt/spark/work/eventlogs
# Lab submits use 512m heap; keep overhead small so it fits Worker 768m offers.
spark.executor.memory 512m
spark.executor.memoryOverhead 128m
EOF

chmod 755 "$SPARK_HOME/conf/spark-env.sh"
SEED
}

seed_join_assets() {
  local pod=$1
  kubectl -n "$LEARNER_NS" exec -i "$pod" -c "$pod" -- \
    env HOME=/opt/spark bash -s <<'ASSETS'
set -euo pipefail
mkdir -p /opt/spark/lab/jobs /opt/spark/lab/data

cat > /opt/spark/lab/data/orders.csv <<'EOF'
order_id,store_id,amount
1,10,12.50
2,10,8.00
3,20,22.00
4,20,5.50
5,30,40.00
6,10,3.25
7,30,15.00
8,20,9.75
EOF

cat > /opt/spark/lab/data/stores.csv <<'EOF'
store_id,region
10,west
20,east
30,west
EOF

# Part 1 — narrow transforms only (0 shuffles → one stage).
cat > /opt/spark/lab/jobs/orders_narrow.py <<'EOF'
#!/usr/bin/env python3
"""Lab 1.3 Part 1 — narrow transforms only (filter/select), one write action, no shuffle."""
import time
from pyspark.sql import SparkSession
from pyspark.sql.types import DoubleType, IntegerType, StructField, StructType

ORDERS_SCHEMA = StructType([
    StructField("order_id", IntegerType(), False),
    StructField("store_id", IntegerType(), False),
    StructField("amount", DoubleType(), False),
])

spark = (
    SparkSession.builder.appName("orders-narrow")
    .config("spark.sql.adaptive.enabled", "false")
    .config("spark.sql.shuffle.partitions", "2")
    .getOrCreate()
)
orders = spark.read.csv(
    "/opt/spark/lab/data/orders.csv", header=True, schema=ORDERS_SCHEMA,
)
# Narrow only: filter + project. Write is the single action (still no shuffle).
big = orders.filter("amount > 10").select("order_id", "store_id", "amount")
big.write.mode("overwrite").csv("/tmp/lab-orders-narrow", header=True)
print("TRACE_HOLD: Application UI ~75s — Stages should show ONE stage, no Shuffle Read/Write.", flush=True)
time.sleep(75)
spark.stop()
EOF

# Part 2 — one wide transform (single shuffle boundary → two stages).
cat > /opt/spark/lab/jobs/orders_by_store.py <<'EOF'
#!/usr/bin/env python3
"""Lab 1.3 Part 2 — one shuffle: groupBy store_id + sum(amount)."""
import time
from pyspark.sql import SparkSession
from pyspark.sql.types import DoubleType, IntegerType, StructField, StructType

ORDERS_SCHEMA = StructType([
    StructField("order_id", IntegerType(), False),
    StructField("store_id", IntegerType(), False),
    StructField("amount", DoubleType(), False),
])

spark = (
    SparkSession.builder.appName("orders-by-store")
    .config("spark.sql.adaptive.enabled", "false")
    .config("spark.sql.shuffle.partitions", "2")
    .getOrCreate()
)
orders = spark.read.csv(
    "/opt/spark/lab/data/orders.csv", header=True, schema=ORDERS_SCHEMA,
)
rollup = orders.groupBy("store_id").sum("amount")
# One action. Expect TWO stages: partial agg + shuffle, then final agg.
for row in rollup.collect():
    print(row, flush=True)
print("TRACE_HOLD: Application UI ~90s — expect TWO stages and ONE shuffle boundary.", flush=True)
time.sleep(90)
spark.stop()
EOF

# Part 3 — multiple shuffles (join + aggregate).
cat > /opt/spark/lab/jobs/store_rollup_join.py <<'EOF'
#!/usr/bin/env python3
"""Lab 1.3 Part 3 — multiple shuffles: join orders↔stores, then groupBy region."""
import time
from pyspark.sql import SparkSession
from pyspark.sql.types import DoubleType, IntegerType, StringType, StructField, StructType

ORDERS_SCHEMA = StructType([
    StructField("order_id", IntegerType(), False),
    StructField("store_id", IntegerType(), False),
    StructField("amount", DoubleType(), False),
])
STORES_SCHEMA = StructType([
    StructField("store_id", IntegerType(), False),
    StructField("region", StringType(), False),
])

spark = (
    SparkSession.builder.appName("store-rollup-join")
    .config("spark.sql.adaptive.enabled", "false")
    .config("spark.sql.shuffle.partitions", "2")
    .getOrCreate()
)
orders = spark.read.csv(
    "/opt/spark/lab/data/orders.csv", header=True, schema=ORDERS_SCHEMA,
)
stores = spark.read.csv(
    "/opt/spark/lab/data/stores.csv", header=True, schema=STORES_SCHEMA,
)
joined = orders.join(stores, "store_id")
rollup = joined.groupBy("region").sum("amount")
for row in rollup.orderBy("region").collect():
    print(row, flush=True)
print("TRACE_HOLD: Application UI ~3 min — multiple stages/shuffles; trace one task to a Worker.", flush=True)
time.sleep(180)
spark.stop()
EOF

chmod 644 /opt/spark/lab/jobs/*.py /opt/spark/lab/data/*.csv
ASSETS
}

for pod in "${DAEMON_PODS[@]}"; do
  echo "==> seed conf/logs/work on $pod"
  seed_layout "$pod" || { echo "could not seed $pod" >&2; exit 1; }
done

for pod in "${LAB_PODS[@]}"; do
  echo "==> seed Part 1–3 lab jobs on $pod"
  seed_join_assets "$pod" || { echo "could not seed lab jobs on $pod" >&2; exit 1; }
done

_master_up='ps -eo args 2>/dev/null | grep -F org.apache.spark.deploy.master.Master | grep -vq grep'
_worker_up='ps -eo args 2>/dev/null | grep -F org.apache.spark.deploy.worker.Worker | grep -vq grep'

boot_phase 'Starting the master'
echo "==> start Master on ds-spark-01"
in_pod ds-spark-01 "
  set -euo pipefail
  export HOME=/opt/spark
  unset SPARK_MASTER 2>/dev/null || true
  if ${_master_up}; then
    echo 'Master already up'
    exit 0
  fi
  \"\$SPARK_HOME/sbin/start-master.sh\"
  for i in \$(seq 1 45); do
    if ${_master_up}; then
      echo 'Master process is up'
      exit 0
    fi
    sleep 1
  done
  echo 'Master process did not appear' >&2
  exit 1
" || { echo "start-master failed" >&2; exit 1; }

sleep 3

boot_phase 'Starting the workers'
echo "==> start Workers on ds-spark-02 and ds-spark-03"
for w in ds-spark-02 ds-spark-03; do
  in_pod "$w" "
    set -euo pipefail
    export HOME=/opt/spark
    unset SPARK_MASTER 2>/dev/null || true
    if ${_worker_up}; then
      echo 'Worker already up'
      exit 0
    fi
    \"\$SPARK_HOME/sbin/start-worker.sh\" \"\$SPARK_MASTER_URL\"
    for i in \$(seq 1 45); do
      if ${_worker_up}; then
        echo 'Worker process is up'
        exit 0
      fi
      sleep 1
    done
    echo 'Worker process did not appear' >&2
    exit 1
  " || { echo "start-worker failed on $w" >&2; exit 1; }
done

wait_alive_workers 2 || { echo "cluster did not reach 2 ALIVE workers" >&2; exit 1; }

boot_phase 'Preparing the lab'
in_shell 'mkdir -p "$HOME/answers" "$HOME/lab" && rm -f "$HOME/answers"/*'

ok "cluster warm (2 ALIVE); three DAG jobs seeded (narrow / one-shuffle / multi-shuffle)"
