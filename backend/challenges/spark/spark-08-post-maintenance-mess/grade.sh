#!/usr/bin/env bash
# Spark-08: Workers ALIVE on the real Master, work dirs writable, eventlogs is a
# directory, probe STATUS=ok.
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
    fail "Worker process is not running on $w — start Workers against \$SPARK_MASTER_URL (not MAINTENANCE_MASTER)"
  fi
done

alive="$(alive_workers || true)"
_grade_miss=0
if [[ -n "$alive" && "$alive" -ge 2 ]]; then
  ok "Master lists 2 ALIVE workers"
else
  fail "Master should list 2 ALIVE workers (saw ${alive:-none}) — do not use the stale maintenance Master URL"
fi

# Work dirs must be traversable/writable again.
work_locked=0
for w in ds-spark-02 ds-spark-03; do
  if ! in_pod "$w" 'test -d /opt/spark/work && test -x /opt/spark/work && test -w /opt/spark/work'; then
    work_locked=1
  fi
done
_grade_miss=0
if [[ "$work_locked" -eq 0 ]]; then
  ok "Worker work directories are writable"
else
  fail "Unlock \$SPARK_HOME/work on the Workers (maintenance left chmod 000)"
fi

# eventlogs must be a directory (not a file) on daemon hosts.
event_bad=0
for w in ds-spark-01 ds-spark-02 ds-spark-03; do
  if ! in_pod "$w" 'test -d /opt/spark/work/eventlogs'; then
    event_bad=1
  fi
done
_grade_miss=0
if [[ "$event_bad" -eq 0 ]]; then
  ok "eventlogs path is a directory on Master and Workers"
else
  fail "Restore /opt/spark/work/eventlogs as a directory (maintenance left a file)"
fi

status="$(metric STATUS)"
_grade_miss=0
if [[ "$status" == "ok" ]]; then
  ok "store-rollup-probe finished successfully"
else
  fail "Re-run store-rollup-probe after fixing Master URL, work dirs, and eventlogs so STATUS=ok"
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
check_inv "Stale Master clue" "$(file_value staleMasterClue)" "maintenance-url-file" || inv_ok=0
check_inv "Work dir fault" "$(file_value workDirFault)" "chmod-locked" || inv_ok=0
check_inv "Event log fault" "$(file_value eventLogFault)" "file-not-dir" || inv_ok=0
check_inv "Fix order lesson" "$(file_value fixOrderLesson)" "url-then-perms-then-eventlogs" || inv_ok=0
check_inv "Wrong fix" "$(file_value wrongFixLesson)" "ignore-maintenance-notes" || inv_ok=0

_grade_miss=0
if [[ "$inv_ok" -eq 1 ]]; then
  ok "Investigation answers are correct"
fi

pass "Post-maintenance mess cleared; probe survived"
