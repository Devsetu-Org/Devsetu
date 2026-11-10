#!/usr/bin/env bash
# Spark-10: YARN healthy; probe app finished; Investigation matches RM/NM truth.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

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

check_nonempty() {
  local label=$1 got=$2
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
  else
    ok "$label"
  fi
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

probe_id="$(in_pod ds-spark-01 'tr -d "\r\n" < /opt/lab/state/probe_app_id 2>/dev/null || echo MISSING' | tr -d '\r\n')"
_grade_miss=0
if [[ "$probe_id" == MISSING || -z "$probe_id" ]]; then
  fail "setup probe application id is missing"
else
  ok "probe application recorded ($probe_id)"
fi

# --- Investigation ---
check_choice "Active NodeManagers from the RM" "$(file_value activeNodes)" "2"

avail_mb="$(file_value availableMb)"
cluster_mb="$(yarn_cluster_metrics_field availableMB || true)"
_grade_miss=0
if [[ "$avail_mb" == MISSING || -z "$avail_mb" ]]; then
  fail "Available MB from the RM is missing"
elif [[ -n "$cluster_mb" && "$avail_mb" =~ ^[0-9]+$ && "$avail_mb" -eq "$cluster_mb" ]]; then
  ok "Available MB matches the RM ($avail_mb)"
elif [[ "$avail_mb" =~ ^[0-9]+$ && -n "$cluster_mb" ]]; then
  # Allow a small drift if something else is allocating.
  delta=$(( avail_mb > cluster_mb ? avail_mb - cluster_mb : cluster_mb - avail_mb ))
  if [[ "$delta" -le 512 ]]; then
    ok "Available MB is close to the RM ($avail_mb ≈ $cluster_mb)"
  else
    fail "Available MB should match the RM cluster metrics (got $avail_mb, RM $cluster_mb)"
  fi
else
  fail "Available MB should be a number from the RM (got $avail_mb)"
fi

got_app="$(file_value probeAppId)"
_grade_miss=0
if [[ "$got_app" == MISSING || -z "$got_app" ]]; then
  fail "Probe application id is missing"
elif [[ "$got_app" == "$probe_id" ]]; then
  ok "Probe application id"
else
  fail "Probe application id is wrong (got $got_app, expected $probe_id)"
fi

check_choice "Probe application final state" "$(file_value probeAppState)" "FINISHED"

nm_host="$(file_value containerNmHost)"
_grade_miss=0
if [[ "$nm_host" == "ds-spark-02" || "$nm_host" == "ds-spark-03" ]]; then
  ok "Container NodeManager host"
elif [[ "$nm_host" == MISSING || -z "$nm_host" ]]; then
  fail "Container NodeManager host is missing"
else
  fail "Container NodeManager host should be ds-spark-02 or ds-spark-03 (got $nm_host)"
fi

check_choice "Cross-check method" "$(file_value crossCheck)" "yarn-logs-or-nm-local"
check_choice "UI vs node truth" "$(file_value uiIsClaim)" "verify-on-node"

pass "RM / NM instruments read and cross-checked"
