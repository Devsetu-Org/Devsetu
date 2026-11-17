#!/usr/bin/env bash
# Spark-12: cluster-mode lasting path + shared-mount data; Investigation matches.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

SHARED="/mnt/lab-shared"

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

rm_app_row() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - "$1" <<'PY'
import json, sys, urllib.request
want = sys.argv[1]
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
for a in ((data.get("apps") or {}).get("app")) or []:
    if a.get("id") == want:
        print(a.get("id"), a.get("state"), a.get("finalStatus"), a.get("name"))
        break
PY
}

# Attempt AM host from RM app attempts API (best-effort).
rm_am_host() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - "$1" <<'PY'
import json, sys, urllib.request
app = sys.argv[1]
url = f"http://127.0.0.1:8088/ws/v1/cluster/apps/{app}/appattempts"
try:
    data = json.load(urllib.request.urlopen(url, timeout=10))
except Exception:
    print("")
    raise SystemExit(0)
attempts = ((data.get("appAttempts") or {}).get("appAttempt")) or []
if isinstance(attempts, dict):
    attempts = [attempts]
host = ""
for a in attempts:
    node = a.get("nodeHttpAddress") or a.get("nodeId") or ""
    # nodeHttpAddress like ds-spark-02:8042
    if "ds-spark-02" in node:
        host = "ds-spark-02"
    elif "ds-spark-03" in node:
        host = "ds-spark-03"
    elif "shell" in node:
        host = "shell"
print(host)
PY
}

_grade_miss=0
if yarn_rm_running; then ok "ResourceManager up"; else fail "ResourceManager is down"; fi

for nm in ds-spark-02 ds-spark-03; do
  _grade_miss=0
  if yarn_nm_running_on "$nm"; then ok "NodeManager on $nm"; else fail "NodeManager down on $nm"; fi
done

# --- lasting wrapper ---
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
  if ! grep -Eq -- '--deploy-mode[[:space:]]+cluster([[:space:]\\]|$)' <<<"$wrapper"; then
    fail "Wrapper must use --deploy-mode cluster (unattended jobs cannot park the driver on shell)"
    wrapper_ok=0
  fi
  if grep -Eq -- '--deploy-mode[[:space:]]+client([[:space:]\\]|$)' <<<"$wrapper"; then
    fail "Wrapper still uses --deploy-mode client"
    wrapper_ok=0
  fi
  if [[ "$wrapper_ok" -eq 1 ]]; then
    ok "Wrapper uses cluster deploy mode"
  fi
fi

# --- job must read shared mount, not shell edge-data ---
job="$(in_shell 'cat "$HOME/lab/store_rollup.py" 2>/dev/null || true')"
_grade_miss=0
if [[ -z "$job" ]]; then
  fail "~/lab/store_rollup.py is missing"
elif grep -Eq 'edge-data|/home/spark/lab/edge-data' <<<"$job"; then
  fail "store_rollup.py still reads shell-only edge-data paths — use $SHARED"
elif ! grep -Eq "$SHARED|/mnt/lab-shared" <<<"$job"; then
  fail "store_rollup.py must read CSVs from $SHARED (cluster-wide mount)"
else
  ok "store_rollup.py reads from the shared mount"
fi

# Shared data must actually be present (copy once, visible on an NM).
_grade_miss=0
if in_pod ds-spark-02 "test -f $SHARED/rollup/orders.csv && test -f $SHARED/rollup/stores.csv"; then
  ok "Shared rollup CSVs present on a NodeManager"
elif in_pod ds-spark-03 "test -f $SHARED/rollup/orders.csv && test -f $SHARED/rollup/stores.csv"; then
  ok "Shared rollup CSVs present on a NodeManager"
else
  fail "Copy orders.csv and stores.csv under $SHARED/rollup/ (visible on every host)"
fi

# --- failed overnight id ---
failed_want="$(in_pod ds-spark-01 'tr -d "\r\n" < /opt/lab/state/failed_app_id 2>/dev/null || echo MISSING' | tr -d '\r\n')"
got_failed="$(file_value failedAppId)"
_grade_miss=0
if [[ "$got_failed" == MISSING || -z "$got_failed" ]]; then
  fail "Failed overnight application id is missing"
elif [[ "$got_failed" == "$failed_want" ]]; then
  ok "Failed overnight application id"
else
  fail "Failed overnight application id is wrong (got $got_failed)"
fi

check_choice "Why the overnight app died" "$(file_value failureMode)" "driver-on-edge"
check_choice "What broke after switching to cluster alone" "$(file_value secondBreak)" "edge-path-on-nm"
check_choice "Where production data must live" "$(file_value dataPlacement)" "shared-mount"
check_choice "Production driver shape" "$(file_value productionShape)" "cluster-am"

# --- successful cluster run ---
cluster_id="$(file_value clusterAppId)"
_grade_miss=0
if [[ "$cluster_id" == MISSING || -z "$cluster_id" ]]; then
  fail "Successful cluster-mode application id is missing"
elif [[ ! "$cluster_id" =~ ^application_[0-9]+_[0-9]+$ ]]; then
  fail "Successful application id should look like application_… (got $cluster_id)"
elif [[ "$cluster_id" == "$failed_want" ]]; then
  fail "Successful id must be a new run — not the failed overnight app"
else
  row="$(rm_app_row "$cluster_id" 2>/dev/null || true)"
  if [[ -z "$row" ]]; then
    fail "Successful application id is not on this ResourceManager"
  else
    st="$(awk '{ print $2 }' <<<"$row")"
    fin="$(awk '{ print $3 }' <<<"$row")"
    if [[ "$st" == "FINISHED" && "$fin" == "SUCCEEDED" ]]; then
      ok "Cluster-mode app $cluster_id FINISHED / SUCCEEDED"
    elif [[ "$st" == "FINISHED" || "$st" == "RUNNING" ]]; then
      ok "Cluster-mode app $cluster_id ($st)"
    else
      fail "Cluster-mode app should be RUNNING or FINISHED (saw $st / $fin)"
    fi
  fi
fi

driver="$(file_value clusterDriverHost)"
_grade_miss=0
if [[ "$driver" == "ds-spark-02" || "$driver" == "ds-spark-03" ]]; then
  # Soft-check against RM attempts when available.
  am_host="$(rm_am_host "$cluster_id" 2>/dev/null || true)"
  if [[ -n "$am_host" && "$am_host" != "$driver" && "$am_host" != "shell" ]]; then
    fail "Cluster driver host answer ($driver) does not match AM host on RM ($am_host)"
  else
    ok "Cluster-mode driver host is a NodeManager"
  fi
elif [[ "$driver" == "shell" ]]; then
  fail "Cluster-mode driver must not be shell — use --deploy-mode cluster"
else
  fail "Cluster-mode driver host should be ds-spark-02 or ds-spark-03 (got ${driver:-none})"
fi

# B — after a FINISHED success, edge kill is moot; if still RUNNING, killing shell must not fail it.
if [[ -n "$cluster_id" && "$cluster_id" != MISSING ]]; then
  st_now="$(rm_app_row "$cluster_id" 2>/dev/null | awk '{ print $2 }' || true)"
  if [[ "$st_now" == "RUNNING" ]]; then
    in_shell 'pkill -f "org.apache.spark.deploy.SparkSubmit" 2>/dev/null || true; true' || true
    sleep 5
    st_after="$(rm_app_row "$cluster_id" 2>/dev/null | awk '{ print $2 }' || true)"
    _grade_miss=0
    if [[ "$st_after" == "FAILED" || "$st_after" == "KILLED" ]]; then
      fail "App died when shell processes were cleared — driver is still on the edge"
    else
      ok "App survived clearing SparkSubmit on shell ($st_after)"
    fi
  fi
fi

pass "cluster mode + shared-mount data; Investigation matches"
