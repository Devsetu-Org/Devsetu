#!/usr/bin/env bash
# Spark-01: Investigation answers match the live cluster layout.
# Cluster must still show master + two ALIVE workers.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

normalize_path() {
  local p=$1
  p="${p#"${p%%[![:space:]]*}"}"
  p="${p%"${p##*[![:space:]]}"}"
  p="${p%/}"
  # Expand common home-relative forms.
  p="${p/#\$SPARK_HOME//opt/spark}"
  p="${p/#\$\{SPARK_HOME\}//opt/spark}"
  printf '%s' "$p"
}

paths_equal() {
  local a b
  a="$(normalize_path "$1" | tr '[:upper:]' '[:lower:]')"
  b="$(normalize_path "$2" | tr '[:upper:]' '[:lower:]')"
  [[ -n "$a" && "$a" == "$b" ]]
}

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

check_path() {
  local label=$1 got=$2 want=$3
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label file is missing"
  elif paths_equal "$got" "$want"; then
    ok "$label"
  else
    fail "$label is $want; the Investigation says $got"
  fi
}

# Investigation asks for a PID; verify that pid is the live Master/Worker on the host.
check_process_pid() {
  local label=$1 got=$2 pod=$3 class_needle=$4
  local pid
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
    return
  fi
  pid="$(printf '%s' "$got" | tr -d '[:space:]')"
  if ! [[ "$pid" =~ ^[0-9]+$ ]]; then
    fail "$label should be a numeric PID (got: $got)"
    return
  fi
  if in_pod "$pod" "ps -p $pid -o args= 2>/dev/null | grep -q '$class_needle'"; then
    ok "$label"
  else
    fail "$label $pid is not the live Spark process on $pod (expected $class_needle)"
  fi
}

# --- live cluster ---
alive="$(alive_workers || true)"
_grade_miss=0
if [[ -n "$alive" && "$alive" -ge 2 ]]; then
  ok "master lists $alive ALIVE workers"
else
  fail "master should list at least 2 ALIVE workers (saw ${alive:-none})"
fi

_grade_miss=0
if in_pod ds-spark-01 'ps -eo args | grep -q "[o]rg.apache.spark.deploy.master.Master"'; then
  ok "Master process on ds-spark-01"
else
  fail "Master process is not running on ds-spark-01"
fi

for w in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if in_pod "$w" 'ps -eo args | grep -q "[o]rg.apache.spark.deploy.worker.Worker"'; then
    ok "Worker process on $w"
  else
    fail "Worker process is not running on $w"
  fi
done

# Discover expected on-disk layout (seeded by setup.sh).
want_conf=/opt/spark/conf
want_logs=/opt/spark/logs
want_work=/opt/spark/work

for pod in ds-spark-01 ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if in_pod "$pod" "test -d $want_conf && test -f $want_conf/spark-env.sh && test -f $want_conf/spark-defaults.conf"; then
    ok "$pod has conf/spark-env.sh and spark-defaults.conf"
  else
    fail "$pod is missing conf layout"
  fi
  _grade_miss=0
  if in_pod "$pod" "test -d $want_logs && test -d $want_work"; then
    ok "$pod has logs/ and work/"
  else
    fail "$pod is missing logs/ or work/"
  fi
done

# --- Investigation answers ---
check_process_pid "Master PID" "$(file_value masterPidHint)" ds-spark-01 'org.apache.spark.deploy.master.Master'
check_process_pid "ds-spark-02 Worker PID" "$(file_value worker0PidHint)" ds-spark-02 'org.apache.spark.deploy.worker.Worker'
check_process_pid "ds-spark-03 Worker PID" "$(file_value worker1PidHint)" ds-spark-03 'org.apache.spark.deploy.worker.Worker'

check_path "master log directory" "$(file_value masterLogs)" "$want_logs"
check_path "master work directory" "$(file_value masterWork)" "$want_work"
check_path "master conf directory" "$(file_value masterConf)" "$want_conf"
check_path "worker log directory" "$(file_value workerLogs)" "$want_logs"
check_path "worker work directory" "$(file_value workerWork)" "$want_work"

spark_env_role="$(file_value sparkEnvRole)"
_grade_miss=0
if [[ "$spark_env_role" == MISSING || -z "$spark_env_role" ]]; then
  fail "spark-env.sh role choice is missing"
elif [[ "$spark_env_role" == "daemon" ]]; then
  ok "spark-env.sh role"
else
  fail "spark-env.sh role is wrong (expected daemon/process settings)"
fi

spark_defaults_role="$(file_value sparkDefaultsRole)"
_grade_miss=0
if [[ "$spark_defaults_role" == MISSING || -z "$spark_defaults_role" ]]; then
  fail "spark-defaults.conf role choice is missing"
elif [[ "$spark_defaults_role" == "application" ]]; then
  ok "spark-defaults.conf role"
else
  fail "spark-defaults.conf role is wrong (expected application SparkConf)"
fi

start_loads_env="$(file_value startLoadsEnv)"
_grade_miss=0
if [[ "$start_loads_env" == MISSING || -z "$start_loads_env" ]]; then
  fail "start-script env load choice is missing"
elif [[ "$start_loads_env" == "spark-env" ]]; then
  ok "start-script loads spark-env.sh"
else
  fail "start-script env load is wrong (expected conf/spark-env.sh)"
fi

start_launches="$(file_value startLaunches)"
_grade_miss=0
if [[ "$start_launches" == MISSING || -z "$start_launches" ]]; then
  fail "start-script launch choice is missing"
elif [[ "$start_launches" == "java-daemon" ]]; then
  ok "start-script launches Java daemon"
else
  fail "start-script launch is wrong (expected Java Master/Worker via spark-daemon)"
fi

pass "cluster is up and Investigation matches on-disk layout"
