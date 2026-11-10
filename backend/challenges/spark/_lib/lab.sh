# Shared helpers for Spark-lab setup.sh / grade.sh. Sourced, not run.
#
# Scripts run on the backend host with controller kubectl (never inside the
# shell pod), so the learner cannot alter the grader. Spark commands run in
# the shell / daemon pods, where SPARK_HOME and PATH are set.
#
# Env from the backend: LEARNER_NS (sp-<user>), SPARK_POD (the shell pod),
# SHELL_CONTAINER, SPARK_MASTER, SPARK_MASTER_UI, SPARK_MASTER_POD, CHALLENGE_ID.
set -euo pipefail

# Emit a lab boot-stepper label. runChallengeScript watches stdout for this
# prefix and forwards it to the open-session phase UI.
boot_phase() {
  printf 'BOOT_PHASE:%s\n' "$1"
}

: "${LEARNER_NS:?LEARNER_NS is required}"
SPARK_POD="${SPARK_POD:-shell}"
SHELL_CONTAINER="${SHELL_CONTAINER:-shell}"
: "${SPARK_MASTER:?SPARK_MASTER is required}"
: "${SPARK_MASTER_UI:?SPARK_MASTER_UI is required}"
SPARK_MASTER_POD="${SPARK_MASTER_POD:-ds-spark-01}"

# Shared PATH for standalone and YARN lab images.
_LAB_PATH="/opt/spark/bin:/opt/spark/sbin:/opt/hadoop/bin:/opt/hadoop/sbin:/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
YARN_RM_HOST="${YARN_RM_HOST:-ds-spark-01}"
YARN_RM_UI="${YARN_RM_UI:-http://ds-spark-01:8088}"
YARN_RM_POD="${YARN_RM_POD:-ds-spark-01}"

# Do not force HOME — standalone pods use /opt/spark; YARN pods use /home/spark.
# Forcing /home/spark breaks apache/spark (mkdir Permission denied) and can
# prevent start-master.sh from writing logs. Also do not export SPARK_MASTER
# into daemon pods: spark-daemon.sh treats it as an rsync host.
_lab_exec_env=(
  PATH="$_LAB_PATH"
  JAVA_HOME="/opt/java/openjdk"
  HADOOP_HOME="/opt/hadoop"
  HADOOP_CONF_DIR="/opt/hadoop/etc/hadoop"
  YARN_CONF_DIR="/opt/hadoop/etc/hadoop"
  SPARK_HOME="/opt/spark"
  SPARK_CONF_DIR="/opt/spark/conf"
  SPARK_MASTER_UI="$SPARK_MASTER_UI"
  SPARK_MASTER_URL="${SPARK_MASTER_URL:-$SPARK_MASTER}"
  YARN_RM_HOST="$YARN_RM_HOST"
  YARN_RM_UI="$YARN_RM_UI"
)

# in_pod <pod> '<shell command>' — run inside that pod's main container.
in_pod() {
  local pod=$1
  shift
  kubectl -n "$LEARNER_NS" exec "$pod" -c "$pod" -- \
    env "${_lab_exec_env[@]}" \
    bash -c "$1"
}

# in_shell '<shell command>' — run inside the learner shell container.
in_shell() {
  kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
    env "${_lab_exec_env[@]}" \
        SPARK_MASTER="$SPARK_MASTER" \
    bash -c "$1"
}

# shell_script <<'EOF' ... EOF — run stdin as bash inside the shell container.
shell_script() {
  kubectl -n "$LEARNER_NS" exec -i "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
    env "${_lab_exec_env[@]}" \
        SPARK_MASTER="$SPARK_MASTER" \
    bash -s
}

# RM cluster metrics JSON (YARN ResourceManager UI).
# Probe 127.0.0.1 — yarn-site must bind the webapp to 0.0.0.0 (not only the hostname).
yarn_rm_metrics() {
  kubectl -n "$LEARNER_NS" exec "$YARN_RM_POD" -c "$YARN_RM_POD" -- \
    bash -c 'exec 3<>/dev/tcp/127.0.0.1/8088
printf "GET /ws/v1/cluster/metrics HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3
sed "1,/^\r\{0,1\}$/d" <&3' 2>/dev/null
}

yarn_active_nodes() {
  yarn_rm_metrics | tr ',' '\n' | awk -F: '
    /"activeNodes"/ { gsub(/[^0-9]/, "", $2); print $2+0; exit }
  '
}

# True if a real JVM ResourceManager is up. Use jps only — pgrep -f matches the
# kubectl/bash -c cmdline that embeds the class name.
yarn_rm_running() {
  kubectl -n "$LEARNER_NS" exec "$YARN_RM_POD" -c "$YARN_RM_POD" -- \
    bash -c 'jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.resourcemanager.ResourceManager >/dev/null'
}

wait_yarn_rm() {
  local i
  for i in $(seq 1 45); do
    if yarn_rm_metrics >/dev/null; then
      echo "YARN ResourceManager UI is up"
      return 0
    fi
    sleep 2
  done
  echo "ResourceManager UI on ${YARN_RM_POD}:8088 never came up" >&2
  kubectl -n "$LEARNER_NS" exec "$YARN_RM_POD" -c "$YARN_RM_POD" -- \
    bash -c 'echo "== jps =="; jps -l 2>/dev/null || true; echo "== listen =="; (ss -lntp || netstat -lntp) 2>/dev/null | head -20 || true; echo "== logs =="; ls -lt /opt/hadoop/logs 2>/dev/null | head -15; echo "== rm out =="; tail -n 80 /opt/hadoop/logs/resourcemanager.out 2>/dev/null || true; echo "== rm log =="; tail -n 80 /opt/hadoop/logs/*resourcemanager*.log 2>/dev/null || true' >&2 || true
  return 1
}

wait_yarn_nodes() {
  local want=${1:-2} i got
  for i in $(seq 1 60); do
    got="$(yarn_active_nodes || true)"
    if [[ -n "$got" && "$got" -ge "$want" ]]; then
      echo "YARN active nodes: $got"
      return 0
    fi
    sleep 2
  done
  echo "expected >= $want active NodeManagers; last reading was ${got:-none}" >&2
  yarn_rm_metrics >&2 || true
  return 1
}

yarn_nm_running_on() {
  local pod=$1
  in_pod "$pod" 'jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.nodemanager.NodeManager >/dev/null'
}

# Seed yarn-site / spark-defaults on one host. Appends 0.0.0.0 bind overrides so
# in-pod probes to 127.0.0.1:8088 work (hostname-only webapp.address does not).
yarn_seed_host() {
  local pod=$1
  in_pod "$pod" '
    set -euo pipefail
    conf=/opt/hadoop/etc/hadoop/yarn-site.xml
    /opt/lab/bin/write-yarn-conf.sh
    tmp=$(mktemp)
    awk -v extras="\
  <property>\n\
    <name>yarn.resourcemanager.bind-host</name>\n\
    <value>0.0.0.0</value>\n\
  </property>\n\
  <property>\n\
    <name>yarn.resourcemanager.webapp.address</name>\n\
    <value>0.0.0.0:8088</value>\n\
  </property>\n\
  <property>\n\
    <name>yarn.nodemanager.bind-host</name>\n\
    <value>0.0.0.0</value>\n\
  </property>\n\
  <property>\n\
    <name>yarn.nodemanager.webapp.address</name>\n\
    <value>0.0.0.0:8042</value>\n\
  </property>" \
      "{ if (index(\$0, \"</configuration>\") && !done) { print extras; done=1 } print }" \
      "$conf" > "$tmp"
    mv "$tmp" "$conf"
    mkdir -p /opt/spark/work/eventlogs /opt/spark/logs /opt/hadoop/logs /opt/lab/state
    cp -f /opt/lab/conf/spark-defaults.conf /opt/spark/conf/spark-defaults.conf
    echo "yarn-site seeded on $(hostname)"
  '
}

yarn_start_rm() {
  in_pod ds-spark-01 '
    set -euo pipefail
    if jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.resourcemanager.ResourceManager >/dev/null; then
      echo "RM already up"
      exit 0
    fi
    export YARN_RESOURCEMANAGER_HEAPSIZE="${YARN_RESOURCEMANAGER_HEAPSIZE:-384}"
    if [[ -x "$HADOOP_HOME/sbin/yarn-daemon.sh" ]]; then
      "$HADOOP_HOME/sbin/yarn-daemon.sh" start resourcemanager
    else
      nohup yarn resourcemanager >/opt/hadoop/logs/resourcemanager.out 2>&1 &
    fi
    for i in $(seq 1 30); do
      if jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.resourcemanager.ResourceManager >/dev/null; then
        echo "RM process is up"
        exit 0
      fi
      sleep 1
    done
    echo "RM process did not appear" >&2
    exit 1
  '
}

yarn_start_nm() {
  local pod=$1
  in_pod "$pod" '
    set -euo pipefail
    if jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.nodemanager.NodeManager >/dev/null; then
      echo "NM already up"
      exit 0
    fi
    export YARN_NODEMANAGER_HEAPSIZE="${YARN_NODEMANAGER_HEAPSIZE:-256}"
    if [[ -x "$HADOOP_HOME/sbin/yarn-daemon.sh" ]]; then
      "$HADOOP_HOME/sbin/yarn-daemon.sh" start nodemanager
    else
      nohup yarn nodemanager >/opt/hadoop/logs/nodemanager.out 2>&1 &
    fi
    for i in $(seq 1 30); do
      if jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.nodemanager.NodeManager >/dev/null; then
        echo "NM process is up"
        exit 0
      fi
      sleep 1
    done
    echo "NM process did not appear" >&2
    exit 1
  '
}

yarn_seed_all() {
  local pod
  echo "==> write YARN / Spark conf on every host"
  for pod in ds-spark-01 ds-spark-02 ds-spark-03 shell; do
    yarn_seed_host "$pod" || { echo "conf seed failed on $pod" >&2; exit 1; }
  done
}

yarn_start_cluster() {
  echo "==> start ResourceManager on ds-spark-01"
  yarn_start_rm || { echo "start ResourceManager failed" >&2; exit 1; }
  wait_yarn_rm || { echo "ResourceManager did not become ready" >&2; exit 1; }
  echo "==> start NodeManagers on ds-spark-02 and ds-spark-03"
  yarn_start_nm ds-spark-02 || { echo "start NodeManager failed on ds-spark-02" >&2; exit 1; }
  yarn_start_nm ds-spark-03 || { echo "start NodeManager failed on ds-spark-03" >&2; exit 1; }
  wait_yarn_nodes 2 || { echo "YARN did not reach 2 active NodeManagers" >&2; exit 1; }
}

yarn_seed_shell_helpers() {
  in_shell 'mkdir -p "$HOME/answers" "$HOME/lab" && rm -f "$HOME/answers"/*'
  in_shell '
    mkdir -p "$HOME"
    cat > "$HOME/.spark_yarn_lab" <<EOF
export HADOOP_CONF_DIR=/opt/hadoop/etc/hadoop
export YARN_CONF_DIR=/opt/hadoop/etc/hadoop
alias yarn-nodes="yarn node -list"
alias yarn-apps="yarn application -list"
EOF
    grep -q spark_yarn_lab "$HOME/.bashrc" 2>/dev/null || echo ". \"\$HOME/.spark_yarn_lab\"" >> "$HOME/.bashrc"
  ' || true
}

# Conf + RM + both NMs + empty answers dir. Patch capacity-scheduler on every
# host after yarn_seed_all and before yarn_start_cluster when a lab needs queues.
yarn_bootstrap() {
  yarn_seed_all
  yarn_start_cluster
  yarn_seed_shell_helpers
}

# Write a multi-queue capacity-scheduler.xml on every YARN host (call after seed,
# before starting the RM). Args: default% production% adhoc%.
yarn_write_capacity_queues() {
  local def_cap=${1:-10} prod_cap=${2:-70} adhoc_cap=${3:-20}
  local pod
  for pod in ds-spark-01 ds-spark-02 ds-spark-03 shell; do
    in_pod "$pod" "
      set -euo pipefail
      cat > /opt/hadoop/etc/hadoop/capacity-scheduler.xml <<EOF
<?xml version=\"1.0\"?>
<configuration>
  <property>
    <name>yarn.scheduler.capacity.root.queues</name>
    <value>default,production,adhoc</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.capacity</name>
    <value>${def_cap}</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.maximum-capacity</name>
    <value>${def_cap}</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.production.capacity</name>
    <value>${prod_cap}</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.production.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.adhoc.capacity</name>
    <value>${adhoc_cap}</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.adhoc.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.maximum-am-resource-percent</name>
    <value>0.5</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.resource-calculator</name>
    <value>org.apache.hadoop.yarn.util.resource.DefaultResourceCalculator</value>
  </property>
</configuration>
EOF
      echo \"capacity queues default=${def_cap} production=${prod_cap} adhoc=${adhoc_cap} on \$(hostname)\"
    " || { echo "capacity write failed on $pod" >&2; exit 1; }
  done
}

# Install a long-sleep PySpark job on the shell (no image rebuild required).
yarn_install_sleep_job() {
  in_shell '
    set -euo pipefail
    mkdir -p "$HOME/lab"
    cat > "$HOME/lab/sleep_backfill.py" <<'"'"'PY'"'"'
import time
from pyspark.sql import SparkSession
spark = SparkSession.builder.appName("queue-backfill").getOrCreate()
time.sleep(3600)
spark.stop()
PY
    echo "wrote $HOME/lab/sleep_backfill.py"
  '
}

yarn_apps_json() {
  kubectl -n "$LEARNER_NS" exec "$YARN_RM_POD" -c "$YARN_RM_POD" -- \
    bash -c 'exec 3<>/dev/tcp/127.0.0.1/8088
printf "GET /ws/v1/cluster/apps HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3
sed "1,/^\r\{0,1\}$/d" <&3' 2>/dev/null
}

yarn_cluster_metrics_field() {
  local key=$1
  yarn_rm_metrics | tr ',' '\n' | awk -F: -v k="\"$key\"" '
    index($0, k) { gsub(/[^0-9]/, "", $2); print $2+0; exit }
  '
}

# Master JSON from the Master UI (bash /dev/tcp — the JVM image has no curl/python).
master_json() {
  kubectl -n "$LEARNER_NS" exec "$SPARK_MASTER_POD" -c "$SPARK_MASTER_POD" -- \
    bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080
printf "GET /json/ HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3
# Drop HTTP headers; print the JSON body.
sed "1,/^\r\{0,1\}$/d" <&3' 2>/dev/null
}

# apache/spark image is often JRE-only (no jps). Match the Master/Worker JVM via ps.
spark_master_running() {
  kubectl -n "$LEARNER_NS" exec "$SPARK_MASTER_POD" -c "$SPARK_MASTER_POD" -- \
    bash -c 'ps -eo args 2>/dev/null | grep -F org.apache.spark.deploy.master.Master | grep -vq grep'
}

spark_worker_running_on() {
  local pod=$1
  in_pod "$pod" 'ps -eo args 2>/dev/null | grep -F org.apache.spark.deploy.worker.Worker | grep -vq grep'
}

# Alive worker count from Master JSON (busybox-friendly).
alive_workers() {
  master_json | tr ',' '\n' | awk -F: '
    /"aliveworkers"/ { gsub(/[^0-9]/, "", $2); print $2+0; exit }
    /"aliveWorkers"/ { gsub(/[^0-9]/, "", $2); print $2+0; exit }
  '
}

wait_alive_workers() {
  local want=${1:-2} i got
  for i in $(seq 1 60); do
    got="$(alive_workers || true)"
    if [[ -n "$got" && "$got" -ge "$want" ]]; then
      echo "alive workers: $got"
      return 0
    fi
    sleep 2
  done
  echo "expected >= $want alive workers; last reading was ${got:-none}" >&2
  kubectl -n "$LEARNER_NS" exec "$SPARK_MASTER_POD" -c "$SPARK_MASTER_POD" -- \
    bash -c 'echo "== jps =="; jps -l 2>/dev/null || true; echo "== logs =="; ls -lt /opt/spark/logs 2>/dev/null | head -10; tail -n 40 /opt/spark/logs/*master*.out 2>/dev/null || true' >&2 || true
  return 1
}

# Keep going after a miss so the result can list every task, not only the first one.
_grade_failures=0
_grade_miss=0
fail() {
  echo "FAIL: $*" >&2
  echo "fail: $*"
  _grade_failures=$((_grade_failures + 1))
  _grade_miss=1
}
pass() {
  if [[ "${_grade_failures}" -gt 0 ]]; then
    exit 1
  fi
  echo "PASS: $*"
  exit 0
}
_grade_finish() {
  if [[ "${_grade_failures}" -gt 0 ]]; then
    exit 1
  fi
}
trap _grade_finish EXIT

ok() {
  if [[ "${_grade_miss}" -eq 0 ]]; then
    echo "ok: $*"
  fi
  _grade_miss=0
}
