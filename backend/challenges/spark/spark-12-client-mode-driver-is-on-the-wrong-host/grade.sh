#!/usr/bin/env bash
# Spark-12: cluster-mode success with AM on a NodeManager.
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

_grade_miss=0
if yarn_rm_running; then ok "ResourceManager up"; else fail "ResourceManager is down"; fi

failed_want="$(in_pod ds-spark-01 'tr -d "\r\n" < /opt/lab/state/failed_app_id 2>/dev/null || echo MISSING' | tr -d '\r\n')"
got_failed="$(file_value failedAppId)"
_grade_miss=0
if [[ "$got_failed" == MISSING || -z "$got_failed" ]]; then
  fail "Failed client-mode application id is missing"
elif [[ "$got_failed" == "$failed_want" ]]; then
  ok "Failed client-mode application id"
else
  fail "Failed client-mode application id is wrong (got $got_failed)"
fi

check_choice "Failure mode" "$(file_value failureMode)" "driver-on-edge"
check_choice "Production driver shape" "$(file_value productionShape)" "cluster-am"

cluster_id="$(file_value clusterAppId)"
_grade_miss=0
if [[ "$cluster_id" == MISSING || -z "$cluster_id" || ! "$cluster_id" =~ ^application_ ]]; then
  fail "Cluster-mode application id is missing or malformed"
elif [[ "$cluster_id" == "$failed_want" ]]; then
  fail "Cluster-mode application id must be a new run, not the failed client app"
else
  st="$(
    yarn_apps_json | tr '{' '\n' | awk -v want="$cluster_id" '
      BEGIN { id=""; state="" }
      /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
      /"state"/ {
        gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
        if (id == want) { print state; exit }
      }
    '
  )"
  if [[ "$st" == "FINISHED" || "$st" == "RUNNING" || "$st" == "SUCCEEDED" ]]; then
    ok "Cluster-mode app $cluster_id ($st)"
  else
    fail "Cluster-mode app should be RUNNING or FINISHED (saw ${st:-none})"
  fi
fi

driver="$(file_value clusterDriverHost)"
_grade_miss=0
if [[ "$driver" == "ds-spark-02" || "$driver" == "ds-spark-03" ]]; then
  ok "Cluster-mode driver host is a NodeManager"
elif [[ "$driver" == "shell" ]]; then
  fail "Cluster-mode driver must not be shell — use --deploy-mode cluster"
else
  fail "Cluster-mode driver host should be ds-spark-02 or ds-spark-03 (got ${driver:-none})"
fi

pass "cluster-mode driver is on a NodeManager"
