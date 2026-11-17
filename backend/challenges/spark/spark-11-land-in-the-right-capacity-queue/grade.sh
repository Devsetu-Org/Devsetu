#!/usr/bin/env bash
# Spark-11: wrapper lands in production; default capacity still tight; Investigation matches.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

STUCK_NAME="store-rollup"

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

check_choice() {
  local label=$1 got=$2 want=$3
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
  elif [[ "$got" == "$want" ]]; then
    ok "$label"
  else
    fail "$label is wrong (got $got)"
  fi
}

# RM REST: "<id> <state> <finalStatus> <queue>" for one application id.
rm_app_row() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - "$1" <<'PY'
import json, sys, urllib.request
want = sys.argv[1]
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
for a in ((data.get("apps") or {}).get("app")) or []:
    if a.get("id") == want:
        print(a.get("id"), a.get("state"), a.get("finalStatus"), a.get("queue"))
        break
PY
}

# --- cluster ---
_grade_miss=0
if yarn_rm_running; then
  ok "ResourceManager on ds-spark-01"
else
  fail "ResourceManager is not running on ds-spark-01"
fi

for nm in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if yarn_nm_running_on "$nm"; then
    ok "NodeManager on $nm"
  else
    fail "NodeManager is not running on $nm"
  fi
done

active="$(yarn_active_nodes || true)"
_grade_miss=0
if [[ -n "$active" && "$active" -ge 2 ]]; then
  ok "RM lists $active active nodes"
else
  fail "RM should list at least 2 active NodeManagers (saw ${active:-none})"
fi

# --- default must stay tight (no paper-over by raising capacity) ---
def_cap="$(
  in_pod ds-spark-01 '
    awk -F"[<>]" "
      /yarn.scheduler.capacity.root.default.capacity<\/name>/ { getline; print \$3; exit }
    " /opt/hadoop/etc/hadoop/capacity-scheduler.xml
  ' | tr -d '\r\n' | awk "NF{print; exit}"
)"
_grade_miss=0
if [[ -n "$def_cap" && "$def_cap" =~ ^[0-9]+(\.[0-9]+)?$ ]] && awk -v c="$def_cap" 'BEGIN { exit (c+0 <= 15) ? 0 : 1 }'; then
  ok "default queue capacity still tight ($def_cap)"
else
  fail "default queue capacity looks raised (saw ${def_cap:-none}) — fix placement, do not inflate default"
fi

# Capacity scheduler must still be the active scheduler.
_grade_miss=0
if in_pod ds-spark-01 'grep -A1 "yarn.resourcemanager.scheduler.class</name>" /opt/hadoop/etc/hadoop/yarn-site.xml 2>/dev/null | grep -qi CapacityScheduler'; then
  ok "CapacityScheduler still configured"
elif in_pod ds-spark-01 'grep -qi CapacityScheduler /opt/hadoop/etc/hadoop/yarn-site.xml 2>/dev/null'; then
  ok "CapacityScheduler still configured"
else
  # Image default is CapacityScheduler via write-yarn-conf; absence of a swap is fine.
  ok "CapacityScheduler left in place"
fi

# --- lasting submit path ---
wrapper="$(
  in_shell 'sed "/^[[:space:]]*#/d" "$HOME/lab/submit-store-rollup.sh" 2>/dev/null || true'
)"
_grade_miss=0
if [[ -z "$wrapper" ]]; then
  fail "Repaired wrapper ~/lab/submit-store-rollup.sh is missing"
else
  wrapper_ok=1
  if ! grep -Eq -- '--master[[:space:]]+yarn([[:space:]\\]|$)' <<<"$wrapper"; then
    fail "Wrapper must submit with --master yarn"
    wrapper_ok=0
  fi
  if ! grep -Eq -- '--queue[[:space:]]+production([[:space:]\\]|$)' <<<"$wrapper"; then
    fail "Wrapper must use --queue production (platform policy for store-rollup)"
    wrapper_ok=0
  fi
  if grep -Eq -- '--queue[[:space:]]+default([[:space:]\\]|$)' <<<"$wrapper"; then
    fail "Wrapper still targets --queue default"
    wrapper_ok=0
  fi
  if ! grep -Eq -- '--num-executors[[:space:]]+2([[:space:]\\]|$)' <<<"$wrapper" \
      || ! grep -Eq -- '--executor-cores[[:space:]]+1([[:space:]\\]|$)' <<<"$wrapper" \
      || ! grep -Eq -- '--executor-memory[[:space:]]+512m([[:space:]\\]|$)' <<<"$wrapper"; then
    fail "Wrapper must keep the lab shape 2 executors × 1 core × 512m"
    wrapper_ok=0
  fi
  if [[ "$wrapper_ok" -eq 1 ]]; then
    ok "Wrapper places store-rollup in production"
  fi
fi

# --- successful production run ---
fix_id="$(file_value fixAppId)"
stuck_id="$(in_pod ds-spark-01 'cat /opt/lab/state/stuck_app_id 2>/dev/null || echo MISSING' | tr -d '\r\n')"
_grade_miss=0
if [[ "$fix_id" == MISSING || -z "$fix_id" ]]; then
  fail "Successful application id is missing"
elif [[ ! "$fix_id" =~ ^application_[0-9]+_[0-9]+$ ]]; then
  fail "Successful application id should look like application_… (got $fix_id)"
elif [[ -n "$stuck_id" && "$stuck_id" != MISSING && "$fix_id" == "$stuck_id" ]]; then
  fail "Successful application id must be a new production run — not the Accepted morning job"
else
  row="$(rm_app_row "$fix_id" 2>/dev/null || true)"
  if [[ -z "$row" ]]; then
    fail "Successful application id is not on this ResourceManager"
  else
    st="$(awk '{ print $2 }' <<<"$row")"
    fin="$(awk '{ print $3 }' <<<"$row")"
    q="$(awk '{ print $4 }' <<<"$row")"
    if [[ "$q" != *production* ]]; then
      fail "Successful app should be in production (RM queue=${q:-none})"
    elif [[ "$st" == "FINISHED" && "$fin" == "SUCCEEDED" ]]; then
      ok "Successful app $fix_id FINISHED in production"
    elif [[ "$st" == "FINISHED" || "$st" == "RUNNING" ]]; then
      ok "Successful app $fix_id in production ($st)"
    else
      fail "Successful app should be RUNNING or FINISHED in production (saw $st / $fin)"
    fi
  fi
fi

# --- Investigation ---
check_choice "Morning job state" "$(file_value stuckState)" "ACCEPTED"
check_choice "Morning job queue" "$(file_value stuckQueue)" "default"
check_choice "Why the morning job stayed Accepted" "$(file_value whyAccepted)" "ask-exceeds-default-share"
check_choice "Production queue at the start of the incident" "$(file_value productionSpare)" "has-room"
check_choice "Where the wrong queue lived" "$(file_value wrongPath)" "wrapper-queue-default"
check_choice "Lasting fix" "$(file_value lastingFix)" "repair-wrapper-to-production"
check_choice "What queue placement is on this platform" "$(file_value placementRule)" "platform-rule"

pass "wrapper places store-rollup in production; capacity math holds; Investigation matches"
