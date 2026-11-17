#!/usr/bin/env bash
# Spark-03: three DAG shapes — narrow / one-shuffle / multi-shuffle.
# Investigation: one ok if all match; otherwise only the wrong fields.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

normalize_num() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]' \
    | sed -E 's/(stages?|tasks?|shuffles?)$//; s/\.0+$//'
}

master_knows_app() {
  local app_id=$1
  master_json | tr '"' '\n' | grep -Fxq "$app_id"
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

alive="$(alive_workers || true)"
_grade_miss=0
if [[ -n "$alive" && "$alive" -ge 2 ]]; then
  ok "Master lists 2 ALIVE workers"
else
  fail "Master should list 2 ALIVE workers (saw ${alive:-none})"
fi

check_app_on_master() {
  local label=$1 app_id=$2
  _grade_miss=0
  if [[ "$app_id" == MISSING || -z "$app_id" ]]; then
    fail "$label is missing"
    return 1
  fi
  if [[ ! "$app_id" =~ ^app-[0-9]+-[0-9]+$ ]]; then
    fail "$label should look like app-… (got $app_id)"
    return 1
  fi
  if master_knows_app "$app_id"; then
    ok "$label is known to the Master"
    return 0
  fi
  fail "$label is not on this Master — submit that part against this cluster"
  return 1
}

narrow_app="$(file_value narrowAppId)"
one_app="$(file_value oneShuffleAppId)"
multi_app="$(file_value multiAppId)"
check_app_on_master "Part 1 application id" "$narrow_app" || true
check_app_on_master "Part 2 application id" "$one_app" || true
check_app_on_master "Part 3 application id" "$multi_app" || true

_grade_miss=0
ids=()
[[ "$narrow_app" != MISSING && -n "$narrow_app" ]] && ids+=("$narrow_app")
[[ "$one_app" != MISSING && -n "$one_app" ]] && ids+=("$one_app")
[[ "$multi_app" != MISSING && -n "$multi_app" ]] && ids+=("$multi_app")
uniq_count="$(printf '%s\n' "${ids[@]}" | sort -u | grep -c . || true)"
if [[ "${#ids[@]}" -ge 3 && "$uniq_count" -eq 3 ]]; then
  ok "Part 1 / 2 / 3 are different applications"
else
  fail "Part 1, 2, and 3 must be three different application ids"
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

check_inv_nonempty() {
  local label=$1 got=$2
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
    return 1
  fi
  return 0
}

check_stage_count() {
  local label=$1 got=$2 mode=$3
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
    return 1
  fi
  local n
  n="$(normalize_num "$got")"
  if [[ ! "$n" =~ ^[0-9]+$ ]]; then
    fail "$label should be a number (got $got)"
    return 1
  fi
  case "$mode" in
    eq1)
      if [[ "$n" -eq 1 ]]; then return 0; fi
      fail "$label should be 1 for the narrow job (got $got)"
      return 1
      ;;
    eq2)
      if [[ "$n" -eq 2 ]]; then return 0; fi
      fail "$label should be 2 for the one-shuffle job (got $got)"
      return 1
      ;;
    ge3)
      if [[ "$n" -ge 3 ]]; then return 0; fi
      fail "$label should be at least 3 for the multi-shuffle job (got $got)"
      return 1
      ;;
  esac
  fail "$label has an unknown check mode"
  return 1
}

inv_ok=1

check_inv "Deploy mode" "$(file_value deployMode)" "client" || inv_ok=0
check_inv "Where the driver ran" "$(file_value driverWhere)" "shell" || inv_ok=0
check_inv "Where applications registered" "$(file_value whereRegistered)" "master-ui" || inv_ok=0
check_inv "Where stages and tasks showed" "$(file_value whereStages)" "app-ui" || inv_ok=0

check_stage_count "Part 1 stage count" "$(file_value narrowStageCount)" eq1 || inv_ok=0
check_inv "Part 1 shuffle count" "$(file_value narrowShuffles)" "0" || inv_ok=0

check_stage_count "Part 2 stage count" "$(file_value oneShuffleStageCount)" eq2 || inv_ok=0
check_inv "Part 2 shuffle count" "$(file_value oneShuffleCount)" "1" || inv_ok=0

check_stage_count "Part 3 stage count" "$(file_value multiStageCount)" ge3 || inv_ok=0
check_inv_nonempty "Part 3 task id" "$(file_value taskId)" || inv_ok=0
check_inv_nonempty "Part 3 executor id" "$(file_value executorId)" || inv_ok=0

worker_host="$(file_value workerHost)"
if [[ "$worker_host" == "ds-spark-02" || "$worker_host" == "ds-spark-03" ]]; then
  :
elif [[ "$worker_host" == MISSING || -z "$worker_host" ]]; then
  fail "Part 3 Worker host is missing"
  inv_ok=0
else
  fail "Part 3 Worker host should be ds-spark-02 or ds-spark-03"
  inv_ok=0
fi

check_inv "What the three jobs taught" "$(file_value dagLesson)" "shuffle-boundaries" || inv_ok=0
check_inv "End-to-end chain" "$(file_value chainLesson)" "submit-to-task" || inv_ok=0
check_inv "UIs as instruments" "$(file_value instrumentLesson)" "claim-then-verify" || inv_ok=0

_grade_miss=0
if [[ "$inv_ok" -eq 1 ]]; then
  ok "Investigation answers are correct"
fi

pass "All three traces recorded; Investigation matches"
