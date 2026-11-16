#!/usr/bin/env bash
# Spark-10: the unhealthy NodeManager is back, the starved probe finished, and
# the Investigation matches what the RM / NM and the node showed.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BAD_NM="ds-spark-03"
PROBE_NAME="store-rollup-probe"

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

# RM REST helper: prints one "<host> <state>" line per node record.
rm_node_states() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - <<'PY'
import json, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/nodes", timeout=10))
for n in ((data.get("nodes") or {}).get("node")) or []:
    print(n.get("nodeHostName"), n.get("state"))
PY
}

# RM REST helper: prints "<id> <state> <finalStatus>" for every app with the given name.
rm_apps_named() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - "$1" <<'PY'
import json, sys, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
for a in ((data.get("apps") or {}).get("app")) or []:
    if a.get("name") == sys.argv[1]:
        print(a.get("id"), a.get("state"), a.get("finalStatus"))
PY
}

# --- daemons ---
_grade_miss=0
if yarn_rm_running; then
  ok "ResourceManager on ds-spark-01"
else
  fail "ResourceManager is not running on ds-spark-01"
fi

for nm in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if yarn_nm_running_on "$nm"; then
    ok "NodeManager process on $nm"
  else
    fail "NodeManager is not running on $nm"
  fi
done

# --- the RM's view of its nodes ---
node_states="$(rm_node_states 2>/dev/null || true)"
for nm in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if grep -qx "$nm RUNNING" <<<"$node_states"; then
    ok "RM lists $nm as RUNNING"
  elif grep -qx "$nm UNHEALTHY" <<<"$node_states"; then
    fail "RM still marks $nm UNHEALTHY"
  else
    fail "RM does not list $nm as RUNNING"
  fi
done

# The health checker has to stay on and stay meaningful. Turning it off, or
# setting the limit to 100%, hides the next disk that really fills up.
for nm in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if in_pod "$nm" 'grep -A1 "disk-health-checker\.enable</name>" /opt/hadoop/etc/hadoop/yarn-site.xml 2>/dev/null | grep -qi "<value>[[:space:]]*false"'; then
    fail "Disk health checker is disabled on $nm — restore it"
    continue
  fi
  # Last definition wins in Hadoop conf; an absent property means the default (90).
  threshold="$(in_pod "$nm" 'grep -A1 "max-disk-utilization-per-disk-percentage</name>" /opt/hadoop/etc/hadoop/yarn-site.xml 2>/dev/null | sed -n "s|.*<value>[[:space:]]*\([0-9.]*\)[[:space:]]*</value>.*|\1|p" | tail -n 1' | tr -d '\r\n' || true)"
  if [[ -n "$threshold" ]] && awk -v t="$threshold" 'BEGIN { exit (t + 0 >= 100) ? 0 : 1 }'; then
    fail "Disk health threshold on $nm is $threshold% — that never flags a full disk"
  else
    ok "Disk health checker still enabled on $nm"
  fi
done

# --- the probe ---
probe_id="$(in_pod ds-spark-01 'cat /opt/lab/state/probe_app_id 2>/dev/null || echo MISSING' | tr -d '\r\n')"
probe_rows="$(rm_apps_named "$PROBE_NAME" 2>/dev/null || true)"

# If both nodes are back and the probe is still going, give it time to finish
# rather than failing a learner who submitted a few seconds early.
if grep -qx "ds-spark-02 RUNNING" <<<"$node_states" && grep -qx "$BAD_NM RUNNING" <<<"$node_states"; then
  for i in $(seq 1 30); do
    if awk '$2 == "FINISHED" && $3 == "SUCCEEDED" { found = 1 } END { exit found ? 0 : 1 }' <<<"$probe_rows"; then
      break
    fi
    if ! awk '$2 == "RUNNING" || $2 == "ACCEPTED" { found = 1 } END { exit found ? 0 : 1 }' <<<"$probe_rows"; then
      break
    fi
    sleep 5
    probe_rows="$(rm_apps_named "$PROBE_NAME" 2>/dev/null || true)"
  done
fi

_grade_miss=0
if awk '$2 == "FINISHED" && $3 == "SUCCEEDED" { found = 1 } END { exit found ? 0 : 1 }' <<<"$probe_rows"; then
  ok "$PROBE_NAME FINISHED / SUCCEEDED on the RM"
elif awk '$2 == "RUNNING" || $2 == "ACCEPTED" { found = 1 } END { exit found ? 0 : 1 }' <<<"$probe_rows"; then
  fail "$PROBE_NAME is still not finished — it has nowhere to run its executors"
else
  fail "No $PROBE_NAME application has FINISHED / SUCCEEDED on this RM"
fi

# --- Investigation: one ok if everything matches, otherwise only the misses ---
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

check_inv "Active NodeManagers at the start of the incident" "$(file_value incidentActiveNodes)" "1" || inv_ok=0
check_inv "Host the RM did not list as active" "$(file_value unhealthyHost)" "$BAD_NM" || inv_ok=0
check_inv "State the RM gave that node" "$(file_value nodeState)" "UNHEALTHY" || inv_ok=0

got_app="$(file_value probeAppId)"
if [[ "$got_app" == MISSING || -z "$got_app" ]]; then
  fail "Stuck probe application id is missing"
  inv_ok=0
elif [[ "$probe_id" == MISSING || -z "$probe_id" ]]; then
  fail "Setup did not record the probe application id — restart the lab"
  inv_ok=0
elif [[ "$got_app" != "$probe_id" ]]; then
  fail "Stuck probe application id is wrong — use the id of the probe that was RUNNING when you arrived"
  inv_ok=0
fi

check_inv "State of the stuck probe on the RM" "$(file_value probeAppState)" "RUNNING" || inv_ok=0
check_inv "What the stuck probe actually held" "$(file_value probeSymptom)" "am-only" || inv_ok=0
check_inv "Why the probe got no executor" "$(file_value whyNoExecutor)" "no-room-after-am" || inv_ok=0
check_inv "NodeManager process on the flagged host" "$(file_value nmJvm)" "alive-but-unhealthy" || inv_ok=0
check_inv "What the disk looked like on the node" "$(file_value diskTruth)" "not-full" || inv_ok=0
check_inv "Root cause" "$(file_value rootCause)" "threshold-too-low" || inv_ok=0
check_inv "Lasting fix" "$(file_value lastingFix)" "restore-threshold-restart-nm" || inv_ok=0
check_inv "What the RM / NM UI is until you check the node" "$(file_value uiIsClaim)" "verify-on-node" || inv_ok=0

_grade_miss=0
if [[ "$inv_ok" -eq 1 ]]; then
  ok "Investigation answers are correct"
fi

pass "NodeManager healthy again; probe finished; Investigation matches"
