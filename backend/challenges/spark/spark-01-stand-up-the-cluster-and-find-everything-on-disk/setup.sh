#!/usr/bin/env bash
# Spark-01: nodes are procured with Spark installed, but Master/Worker are NOT running.
# Seed conf/logs/work, clear Investigation answers. Bring-up steps live in the Guide tab.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

DAEMON_PODS=(ds-spark-01 ds-spark-02 ds-spark-03)

seed_layout() {
  local pod=$1
  kubectl -n "$LEARNER_NS" exec -i "$pod" -c "$pod" -- \
    env SPARK_HOME=/opt/spark bash -s <<'SEED'
set -euo pipefail
SPARK_HOME="${SPARK_HOME:-/opt/spark}"
mkdir -p "$SPARK_HOME/conf" "$SPARK_HOME/logs" "$SPARK_HOME/work"

cat > "$SPARK_HOME/conf/spark-env.sh" <<'EOF'
#!/usr/bin/env bash
# Daemon / process environment. Sourced before Master or Worker starts.
# Put host-level knobs here (memory the daemon offers, log/work dirs, ports).
# Examples: SPARK_WORKER_MEMORY, SPARK_DAEMON_MEMORY, SPARK_LOG_DIR, SPARK_WORKER_DIR.
export SPARK_LOG_DIR="${SPARK_HOME:-/opt/spark}/logs"
export SPARK_WORKER_DIR="${SPARK_HOME:-/opt/spark}/work"
# spark-daemon.sh treats SPARK_MASTER as an rsync *host* ("rsync from …").
# Never leave a spark:// URL in SPARK_MASTER; use SPARK_MASTER_URL instead.
unset SPARK_MASTER 2>/dev/null || true
EOF

cat > "$SPARK_HOME/conf/spark-defaults.conf" <<'EOF'
# Application defaults. Read into SparkConf when an application (or the UI) starts.
# Put job-level knobs here — not daemon env.
# Examples: spark.executor.memory, spark.eventLog.enabled, spark.master.
# spark.executor.memory 512m
EOF

chmod 755 "$SPARK_HOME/conf/spark-env.sh"
SEED
}

for pod in "${DAEMON_PODS[@]}"; do
  echo "==> seed conf/logs/work on $pod"
  seed_layout "$pod" || { echo "could not seed $pod" >&2; exit 1; }
done

# Do NOT start Master/Worker — that is the learner's job (see the Guide tab).
in_shell 'mkdir -p "$HOME/answers" && rm -f "$HOME/answers"/*'

ok "nodes ready with Spark installed; cluster not started"
