#!/usr/bin/env bash
# Spark-02: bring the standalone cluster up healthy, then plant two faults on
# ds-spark-02:
#   1) Stop the Worker (process gone — Master shows DEAD).
#   2) Rewrite spark.worker.timeout on that host to a huge value so a naive
#      start-worker registers (ALIVE), then heartbeats only every timeout/4 and
#      the Master (still at 30s) marks it DEAD again.
# Lasting fix: set spark.worker.timeout back to 30 on ds-spark-02 and restart
# the Worker.
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
# Daemon / process environment. Sourced before Master or Worker starts.
export SPARK_LOG_DIR="${SPARK_HOME:-/opt/spark}/logs"
export SPARK_WORKER_DIR="${SPARK_HOME:-/opt/spark}/work"
# spark-daemon.sh treats SPARK_MASTER as an rsync host — never set it here.
unset SPARK_MASTER 2>/dev/null || true
EOF

cat > "$SPARK_HOME/conf/spark-defaults.conf" <<'EOF'
# Application defaults.
# spark.worker.timeout is seconds as a long (no unit suffix).
# Master: marks a Worker DEAD after this many seconds without RPC heartbeats.
# Worker: sends a heartbeat every (timeout / 4) seconds.
spark.worker.timeout 30
# spark.executor.memory 512m
EOF

chmod 755 "$SPARK_HOME/conf/spark-env.sh"
SEED
}

for pod in "${DAEMON_PODS[@]}"; do
  echo "==> seed conf/logs/work on $pod"
  seed_layout "$pod" || { echo "could not seed $pod" >&2; exit 1; }
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
  ls -lt /opt/spark/logs >&2 || true
  tail -n 40 /opt/spark/logs/*master*.out >&2 || true
  exit 1
" || { echo "start-master failed" >&2; exit 1; }

sleep 5

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
# Plant the lasting bug on the Worker host *before* killing the process, so the
# next start-worker picks up the stretched heartbeat interval (timeout/4).
# Master on ds-spark-01 keeps spark.worker.timeout 30.
echo "==> plant stretched Worker heartbeat interval on ds-spark-02"
in_pod ds-spark-02 '
  set -euo pipefail
  export HOME=/opt/spark
  cat > /opt/spark/conf/spark-defaults.conf <<EOF
# Application defaults.
spark.worker.timeout 600
# spark.executor.memory 512m
EOF
  grep -E "^spark\\.worker\\.timeout[[:space:]]+600$" /opt/spark/conf/spark-defaults.conf
' || { echo "failed to plant timeout on ds-spark-02" >&2; exit 1; }

echo "==> plant missing Worker: stop Worker on ds-spark-02"
in_pod ds-spark-02 '
  set -euo pipefail
  export HOME=/opt/spark
  unset SPARK_MASTER 2>/dev/null || true

  # Live Worker = JVM still scheduling (exclude defunct/zombie rows that
  # keep matching ps -p after kill and falsely fail the plant).
  worker_live() {
    ps -eo pid,stat,args 2>/dev/null \
      | awk "/org.apache.spark.deploy.worker.Worker/ && !/awk/ && \$2 !~ /Z/ { print \$1; exit }"
  }

  before="$(worker_live || true)"
  if [[ -z "${before}" ]]; then
    echo "no live Worker JVM to stop" >&2
    exit 1
  fi

  # Prefer Spark stop-worker — same end state the learner sees (process gone).
  "$SPARK_HOME/sbin/stop-worker.sh" >/dev/null 2>&1 || true

  for i in $(seq 1 30); do
    if [[ -z "$(worker_live || true)" ]]; then
      mkdir -p "$HOME/lab/state"
      printf "%s\n" "$before" > "$HOME/lab/state/killed_worker_pid"
      echo "stopped Worker (was pid=$before)"
      exit 0
    fi
    sleep 0.5
  done

  # Last resort: SIGKILL every live Worker JVM on this host.
  for pid in $(ps -eo pid,stat,args 2>/dev/null \
      | awk "/org.apache.spark.deploy.worker.Worker/ && !/awk/ && \$2 !~ /Z/ { print \$1 }"); do
    kill -9 "$pid" 2>/dev/null || true
  done
  sleep 1
  if [[ -n "$(worker_live || true)" ]]; then
    echo "Worker JVM still live after stop-worker + SIGKILL:" >&2
    ps -eo pid,stat,args 2>/dev/null | awk "/[Ww]orker/ && !/awk/" >&2 || true
    exit 1
  fi
  mkdir -p "$HOME/lab/state"
  printf "%s\n" "$before" > "$HOME/lab/state/killed_worker_pid"
  echo "force-killed Worker (was pid=$before)"
' || { echo "failed to stop Worker on ds-spark-02" >&2; exit 1; }

# Wait until Master drops the missing Worker (timeout is 30s on Master).
echo "==> wait for Master to mark the missing Worker DEAD"
dropped=0
for i in $(seq 1 50); do
  got="$(alive_workers || true)"
  if [[ -n "$got" && "$got" -lt 2 ]]; then
    echo "Master ALIVE workers now: $got"
    dropped=1
    break
  fi
  sleep 2
done
if [[ "$dropped" -ne 1 ]]; then
  echo "Master never dropped the killed Worker from ALIVE" >&2
  exit 1
fi

in_shell 'mkdir -p "$HOME/answers" "$HOME/lab" && rm -f "$HOME/answers"/* && printf "%s\n" "ds-spark-02" > "$HOME/lab/down_worker_host"'

ok "cluster up; Worker on ds-spark-02 stopped; heartbeat timeout planted at 600"
