#!/usr/bin/env bash
# Spark-07: janitor gone, local filler cleared, shuffle job STATUS=ok.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

metric() {
  local key=$1
  in_shell "
    f=/opt/spark/lab/last_run.txt
    if [[ -f \"\$f\" ]]; then
      awk -F= -v k=\"$key\" '\$1==k { print \$2; exit }' \"\$f\"
    fi
  " | tr -d '\n\r'
}

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

# Janitor must be stopped on both workers.
janitor_live=0
for w in ds-spark-02 ds-spark-03; do
  if in_pod "$w" 'ps -eo args | grep -F shuffle_janitor.sh | grep -vq grep'; then
    janitor_live=1
  fi
done
_grade_miss=0
if [[ "$janitor_live" -eq 0 ]]; then
  ok "Shuffle janitor is stopped on the Workers"
else
  fail "Stop the shuffle janitor on the Worker hosts (it wipes shuffle locals)"
fi

# Filler should be gone (or not blocking) on workers.
filler_live=0
for w in ds-spark-02 ds-spark-03; do
  if in_pod "$w" 'test -f /opt/spark/work/spark-local/DISK_FILLER'; then
    filler_live=1
  fi
done
_grade_miss=0
if [[ "$filler_live" -eq 0 ]]; then
  ok "DISK_FILLER removed from spark-local"
else
  fail "Remove /opt/spark/work/spark-local/DISK_FILLER on the Workers"
fi

status="$(metric STATUS)"
_grade_miss=0
if [[ "$status" == "ok" ]]; then
  ok "store-rollup-shuffle finished successfully"
else
  fail "Re-run store-rollup-shuffle after fixing local dirs so last_run.txt says STATUS=ok"
fi

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
check_inv "Healthy phase" "$(file_value whenHealthy)" "pre-shuffle" || inv_ok=0
check_inv "Slow phase" "$(file_value whenSlow)" "shuffle-retries" || inv_ok=0
check_inv "Death" "$(file_value whenDead)" "fetch-failed" || inv_ok=0
check_inv "Driver/UI signal" "$(file_value signalDriverUi)" "fetch-or-stage" || inv_ok=0
check_inv "Local disk signal" "$(file_value signalLocalDisk)" "local-full-or-missing" || inv_ok=0
check_inv "Worker log signal" "$(file_value signalWorkerLog)" "disk-or-io" || inv_ok=0
check_inv "Root cause" "$(file_value rootCause)" "shuffle-local-disk" || inv_ok=0
check_inv "Fix" "$(file_value fixApplied)" "protect-local-rerun" || inv_ok=0
check_inv "Wrong fix" "$(file_value wrongFixLesson)" "ignore-disk" || inv_ok=0

_grade_miss=0
if [[ "$inv_ok" -eq 1 ]]; then
  ok "Investigation answers are correct"
fi

pass "Shuffle locals protected; store-rollup-shuffle survived"
