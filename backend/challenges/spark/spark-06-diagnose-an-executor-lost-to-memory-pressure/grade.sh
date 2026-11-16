#!/usr/bin/env bash
# Spark-06: hold relocated onto small Worker A; victim succeeds on big Worker B.
# Do not require an exact executor-memory value for the hold — only that it fits A.
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

alive="$(alive_workers || true)"
_grade_miss=0
if [[ -n "$alive" && "$alive" -ge 2 ]]; then
  ok "Master lists 2 ALIVE workers"
else
  fail "Master should list 2 ALIVE workers (saw ${alive:-none})"
fi

# Hold must still be running (workload kept — new app id OK).
_grade_miss=0
if master_json | tr '"' '\n' | grep -Fxq 'team-b-debug-hold'; then
  ok "team-b-debug-hold is still active"
else
  fail "Keep team-b-debug-hold running (right-size + resubmit is OK; deleting it is not)"
fi

# Hold executor memory used must be on small worker A (ds-spark-02), not only on B.
# Master JSON workers include host + memoryused.
_hold_on_a="$(
  master_json | python3 -c '
import json,sys
d=json.load(sys.stdin)
workers=d.get("workers",[])
on_a=False
on_b=False
for w in workers:
  host=(w.get("host") or "")
  mem=int(w.get("memoryused") or 0)
  cores=int(w.get("coresused") or 0)
  if mem<=0 and cores<=0:
    continue
  if "ds-spark-02" in host or host.endswith("-02") or "spark-02" in host:
    on_a=True
  if "ds-spark-03" in host or host.endswith("-03") or "spark-03" in host:
    on_b=True
if not on_a and not on_b:
  for w in workers:
    mem=int(w.get("memoryused") or 0)
    total=int(w.get("memory") or 0)
    if mem>0 and total<=768:
      on_a=True
    if mem>0 and total>=2048:
      on_b=True
print("A" if on_a and not on_b else ("B" if on_b and not on_a else ("BOTH" if on_a and on_b else "NONE")))
'
)"

_grade_miss=0
if [[ "$_hold_on_a" == "A" ]]; then
  ok "team-b-debug-hold is on the small Worker (ds-spark-02)"
elif [[ "$_hold_on_a" == "BOTH" ]]; then
  fail "Hold still occupies the big Worker — move it fully onto ds-spark-02"
elif [[ "$_hold_on_a" == "B" ]]; then
  fail "team-b-debug-hold is still on the big Worker — right-size so it can sit on ds-spark-02"
else
  fail "Could not locate team-b-debug-hold on a Worker"
fi

status="$(metric STATUS)"
_grade_miss=0
if [[ "$status" == "ok" ]]; then
  ok "store-rollup-mem finished successfully"
else
  fail "Re-run store-rollup-mem after relocating the hold so last_run.txt says STATUS=ok"
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
check_inv "Loss symptom" "$(file_value lossPattern)" "executor-lost-task" || inv_ok=0
check_inv "Why hold sat on B" "$(file_value holdWhyOnBig)" "request-exceeds-small" || inv_ok=0
check_inv "Hold usage clue" "$(file_value holdUsageClue)" "used-much-less" || inv_ok=0
check_inv "Why victim needs B" "$(file_value victimNeedsBig)" "victim-request-gt-small" || inv_ok=0
check_inv "Fix applied" "$(file_value fixApplied)" "rightsize-hold-to-small" || inv_ok=0
check_inv "Raise-only lesson" "$(file_value raiseOnlyLesson)" "raise-alone-fails" || inv_ok=0

_grade_miss=0
if [[ "$inv_ok" -eq 1 ]]; then
  ok "Investigation answers are correct"
fi

pass "Hold on small Worker; victim healthy on big Worker"
