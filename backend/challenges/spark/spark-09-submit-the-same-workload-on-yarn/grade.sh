#!/usr/bin/env bash
# Spark-09: YARN healthy; Investigation records both client and cluster submits.
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

check_app_id() {
  local label=$1 got=$2
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
  elif [[ "$got" =~ ^application_[0-9]+_[0-9]+$ ]]; then
    ok "$label"
  else
    fail "$label should look like application_… (got $got)"
  fi
}

# --- cluster must still be up ---
# jps only — pgrep -f matches the kubectl/bash -c cmdline that embeds the class name.
_grade_miss=0
if yarn_rm_running; then
  ok "ResourceManager on ds-spark-01"
else
  fail "ResourceManager is not running on ds-spark-01"
fi

for nm in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if in_pod "$nm" 'jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.nodemanager.NodeManager >/dev/null'; then
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

# --- Investigation: client run ---
check_app_id "Client application id" "$(file_value clientAppId)"
check_choice "Client driver host" "$(file_value clientDriverHost)" "shell"
check_nonempty "Client container hosts" "$(file_value clientContainerHosts)"
check_nonempty "Client allocated memory note" "$(file_value clientAllocMemory)"
check_choice "Client RM panel" "$(file_value clientRmPanel)" "applications"
check_choice "Client NM panel" "$(file_value clientNmPanel)" "containers"

# --- Investigation: cluster run ---
check_app_id "Cluster application id" "$(file_value clusterAppId)"
cluster_driver="$(file_value clusterDriverHost)"
_grade_miss=0
if [[ "$cluster_driver" == "ds-spark-02" || "$cluster_driver" == "ds-spark-03" ]]; then
  ok "Cluster driver host is a NodeManager"
elif [[ "$cluster_driver" == "shell" ]]; then
  fail "Cluster driver host must not be shell — use --deploy-mode cluster"
elif [[ "$cluster_driver" == MISSING || -z "$cluster_driver" ]]; then
  fail "Cluster driver host is missing"
else
  fail "Cluster driver host should be ds-spark-02 or ds-spark-03 (got $cluster_driver)"
fi

client_app="$(file_value clientAppId)"
cluster_app="$(file_value clusterAppId)"
_grade_miss=0
if [[ "$client_app" != MISSING && "$cluster_app" != MISSING && "$client_app" == "$cluster_app" ]]; then
  fail "Client and cluster application ids must be different runs"
else
  ok "Client and cluster application ids differ"
fi

check_nonempty "Cluster container hosts" "$(file_value clusterContainerHosts)"
check_nonempty "Cluster allocated memory note" "$(file_value clusterAllocMemory)"
check_choice "What changed between modes" "$(file_value deployModeDelta)" "driver-host"

pass "client and cluster YARN submits recorded"
