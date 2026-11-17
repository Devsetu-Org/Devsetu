#!/usr/bin/env bash
# Spark-02: lasting Worker restore; Investigation matches.
# Fail messages stay generic. One lasting-health check — no duplicate spoilers.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

normalize_num() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]' \
    | sed -E 's/(cores?|mb|mib|gib|gb|gi|g)$//; s/\.0+$//'
}

nums_equal() {
  local a b
  a="$(normalize_num "$1")"
  b="$(normalize_num "$2")"
  [[ -n "$a" && "$a" == "$b" ]]
}

check_num() {
  local label=$1 got=$2 want=$3
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
  elif nums_equal "$got" "$want"; then
    ok "$label"
  else
    fail "$label does not match the cluster"
  fi
}

# --- daemons ---
_grade_miss=0
if in_pod ds-spark-01 'ps -eo args | grep -q "[o]rg.apache.spark.deploy.master.Master"'; then
  ok "Master process is running"
else
  fail "Master process is not running"
fi

for w in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if in_pod "$w" 'ps -eo args | grep -q "[o]rg.apache.spark.deploy.worker.Worker"'; then
    ok "Worker process on $w"
  else
    fail "Worker process is not running on $w"
  fi
done

workers_02="$(
  in_pod ds-spark-02 '
    ps -eo args | grep -F org.apache.spark.deploy.worker.Worker | grep -v grep | wc -l
  ' | tr -d "\r\n[:space:]"
)"
_grade_miss=0
if [[ -n "$workers_02" && "$workers_02" -eq 1 ]]; then
  ok "one Worker JVM on ds-spark-02"
elif [[ -n "$workers_02" && "$workers_02" -gt 1 ]]; then
  fail "ds-spark-02 has extra Worker processes"
else
  fail "could not verify Worker process on ds-spark-02"
fi

# --- lasting restore (conf + stays healthy) — single outcome ---
lasting=1
timeout_02="$(
  in_pod ds-spark-02 '
    awk "/^spark\\.worker\\.timeout[[:space:]]+/ { print \$2; exit }" /opt/spark/conf/spark-defaults.conf
  ' | tr -d "\r\n[:space:]"
)"
if [[ "$timeout_02" != "30" ]]; then
  lasting=0
fi

if [[ "$lasting" -eq 1 ]]; then
  echo "==> wait to confirm Workers stay ALIVE"
  for i in $(seq 1 8); do
    sleep 5
    got="$(alive_workers || true)"
    echo "ALIVE check $i: ${got:-none}"
    if [[ -z "$got" || "$got" -lt 2 ]]; then
      lasting=0
      break
    fi
  done
fi

_grade_miss=0
if [[ "$lasting" -eq 1 ]]; then
  ok "Lasting restore holds"
else
  fail "Lasting restore is incomplete — dig further on the Worker host"
fi

# UI snapshot numbers only when the cluster is actually healthy.
if [[ "$lasting" -eq 1 ]]; then
  alive="$(alive_workers || true)"
  check_num "Workers ALIVE" "$(file_value aliveWorkers)" "$alive"
  check_num "Total cores" "$(file_value coresTotal)" "2"
  check_num "Total memory (MB)" "$(file_value memoryTotal)" "1536"
  check_num "Running applications" "$(file_value runningApps)" "0"
  check_num "Running executors on a worker" "$(file_value workerExecutors)" "0"
fi

# Investigation: one ok if everything matches; otherwise only the wrong fields.
check_inv() {
  local label=$1 got=$2 want=$3
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
    return 1
  fi
  if [[ "$got" != "$want" ]]; then
    fail "$label is wrong"
    return 1
  fi
  return 0
}

inv_ok=1
check_inv "Master UI symptom" "$(file_value masterSymptom)" "not-two-alive" || inv_ok=0
check_inv "What DEAD means by itself" "$(file_value heartbeatMeaning)" "master-stopped-hearing" || inv_ok=0
check_inv "Which Worker host was out" "$(file_value downWorker)" "ds-spark-02" || inv_ok=0
check_inv "Why bring-up flopped" "$(file_value flapCause)" "timeout-too-large" || inv_ok=0
check_inv "Master RPC listen port" "$(file_value masterRpcPort)" "7077" || inv_ok=0
check_inv "How Worker stays ALIVE" "$(file_value heartbeatWho)" "worker-to-master" || inv_ok=0
check_inv "When signals stop arriving" "$(file_value missedHeartbeat)" "master-marks-dead" || inv_ok=0
check_inv "UIs as instruments" "$(file_value instrumentLesson)" "claim-then-verify" || inv_ok=0
check_inv "Lasting fix" "$(file_value lastingFix)" "timeout-30-restart" || inv_ok=0

_grade_miss=0
if [[ "$inv_ok" -eq 1 ]]; then
  ok "Investigation answers are correct"
fi

pass "Cluster restored; Investigation matches"
