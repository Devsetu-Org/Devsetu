#!/usr/bin/env bash
# Spark-14: driver host sane, overhead restored, filler gone, STATUS=ok.
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

alive="$(alive_workers || true)"
_grade_miss=0
if [[ -n "$alive" && "$alive" -ge 2 ]]; then
  ok "Master lists 2 ALIVE workers"
else
  fail "Master should list 2 ALIVE workers (saw ${alive:-none})"
fi

# Driver host must not still be the planted invalid name on the shell defaults.
bad_host=0
if in_shell 'grep -E "^[[:space:]]*spark\\.driver\\.host[[:space:]]*=[[:space:]]*broken-host\\.quickbite\\.invalid" /opt/spark/conf/spark-defaults.conf >/dev/null 2>&1'; then
  bad_host=1
fi
_grade_miss=0
if [[ "$bad_host" -eq 0 ]]; then
  ok "Planted broken spark.driver.host is cleared on the shell"
else
  fail "Remove or fix spark.driver.host=broken-host.quickbite.invalid in shell spark-defaults.conf"
fi

# Overhead must be restored (not the planted 48m) on shell and/or workers.
# Accept any conf that no longer pins 48m as the effective default on the shell.
tiny_oh=0
if in_shell 'grep -E "^[[:space:]]*spark\\.executor\\.memoryOverhead[[:space:]]*=[[:space:]]*48m" /opt/spark/conf/spark-defaults.conf >/dev/null 2>&1'; then
  tiny_oh=1
fi
_grade_miss=0
if [[ "$tiny_oh" -eq 0 ]]; then
  ok "Tiny spark.executor.memoryOverhead=48m is no longer the shell default"
else
  fail "Raise spark.executor.memoryOverhead (e.g. 128m) — 48m is too small for this job"
fi

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
  ok "store-rollup-triple finished successfully"
else
  fail "Re-run store-rollup-triple after fixing host, overhead, and disk so STATUS=ok"
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
check_inv "First layer" "$(file_value firstLayer)" "driver-host" || inv_ok=0
check_inv "Second layer" "$(file_value secondLayer)" "memory-overhead" || inv_ok=0
check_inv "Third layer" "$(file_value thirdLayer)" "local-disk-filler" || inv_ok=0
check_inv "Peel order" "$(file_value peelOrder)" "host-then-overhead-then-disk" || inv_ok=0
check_inv "Wrong fix" "$(file_value wrongFixLesson)" "bump-cores-only" || inv_ok=0

_grade_miss=0
if [[ "$inv_ok" -eq 1 ]]; then
  ok "Investigation answers are correct"
fi

pass "DNS + memory + disk triple cleared; probe survived"
