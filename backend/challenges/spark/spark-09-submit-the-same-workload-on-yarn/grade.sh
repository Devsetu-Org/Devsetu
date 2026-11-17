#!/usr/bin/env bash
# Spark-09: YARN healthy; both submits finished on the RM; Investigation matches.
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

check_app_finished() {
  local label=$1 app_id=$2 want_name=$3
  _grade_miss=0
  if [[ "$app_id" == MISSING || -z "$app_id" ]]; then
    fail "$label is missing"
    return 1
  fi
  if [[ ! "$app_id" =~ ^application_[0-9]+_[0-9]+$ ]]; then
    fail "$label should look like application_… (got $app_id)"
    return 1
  fi
  local state name
  state="$(yarn_app_state "$app_id" || true)"
  name="$(yarn_app_name "$app_id" || true)"
  if [[ -z "$state" ]]; then
    fail "$label is not on this ResourceManager — submit that run against this cluster"
    return 1
  fi
  if [[ "$state" != "FINISHED" ]]; then
    fail "$label should be FINISHED on the RM (saw $state)"
    return 1
  fi
  if [[ -n "$want_name" && "$name" != "$want_name" ]]; then
    fail "$label should be named $want_name (RM shows $name)"
    return 1
  fi
  ok "$label is FINISHED on the RM ($name)"
  return 0
}

# --- cluster must still be up ---
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

# --- migrated submit wrapper ---
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
  if ! grep -Eq -- '--deploy-mode[[:space:]]+["]?\$MODE["]?' <<<"$wrapper"; then
    fail "Wrapper must use its MODE argument for --deploy-mode"
    wrapper_ok=0
  fi
  if ! grep -Eq -- '--name[[:space:]]+["]?store-rollup-\$MODE["]?' <<<"$wrapper"; then
    fail "Wrapper must name runs store-rollup-client / store-rollup-cluster from MODE"
    wrapper_ok=0
  fi
  if ! grep -Eq -- '--num-executors[[:space:]]+2([[:space:]\\]|$)' <<<"$wrapper" \
      || ! grep -Eq -- '--executor-cores[[:space:]]+1([[:space:]\\]|$)' <<<"$wrapper" \
      || ! grep -Eq -- '--executor-memory[[:space:]]+512m([[:space:]\\]|$)' <<<"$wrapper"; then
    fail "Wrapper must request 2 executors × 1 core × 512m"
    wrapper_ok=0
  fi
  if grep -Eq -- '--total-executor-cores|SPARK_MASTER_URL' <<<"$wrapper"; then
    fail "Wrapper still contains the standalone master / total-core contract"
    wrapper_ok=0
  fi
  if [[ "$wrapper_ok" -eq 1 ]]; then
    ok "Standalone wrapper migrated to a YARN submit contract"
  fi
fi

# --- Investigation: migration / topology ---
check_choice "What runs on ds-spark-01" "$(file_value rmHostRole)" "resourcemanager"
check_choice "Standalone Master / Worker here?" "$(file_value noMaster)" "yarn-only"
check_choice "Active NodeManagers before submit" "$(file_value activeNodesExpect)" "2"
check_choice "Old wrapper fault" "$(file_value oldSubmitContract)" "standalone-contract"
check_choice "YARN resource translation" "$(file_value yarnResourceContract)" "instances-and-cores"

# --- Investigation: client run (must exist on RM) ---
client_app="$(file_value clientAppId)"
check_app_finished "Client application id" "$client_app" "store-rollup-client" || true
check_choice "Client driver host" "$(file_value clientDriverHost)" "shell"
check_choice "Client RM panel" "$(file_value clientRmPanel)" "applications"
check_choice "Client NM panel" "$(file_value clientNmPanel)" "containers"

# --- Investigation: cluster run ---
cluster_app="$(file_value clusterAppId)"
check_app_finished "Cluster application id" "$cluster_app" "store-rollup-cluster" || true

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

check_choice "Cluster driver is a YARN container" "$(file_value clusterAmIsContainer)" "am-container"

_grade_miss=0
if [[ "$client_app" != MISSING && "$cluster_app" != MISSING && "$client_app" == "$cluster_app" ]]; then
  fail "Client and cluster application ids must be different runs"
elif [[ "$client_app" == MISSING || "$cluster_app" == MISSING || -z "$client_app" || -z "$cluster_app" ]]; then
  fail "Need both client and cluster application ids"
else
  ok "Client and cluster application ids differ"
fi

# --- lesson ---
check_choice "What changed between modes" "$(file_value deployModeDelta)" "driver-host"
check_choice "Why run both modes" "$(file_value whyBothModes)" "driver-placement"

pass "client and cluster YARN submits recorded"
