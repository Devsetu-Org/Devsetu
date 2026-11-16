#!/usr/bin/env bash
# Spark-10: YARN comes up with one NodeManager UNHEALTHY, and the morning probe
# job starved under it.
#
# Plant (ds-spark-03 only): the disk-health threshold in yarn-site.xml is 0.9
# instead of 99.0 (a percentage written as if it were a fraction). The NodeManager JVM starts and its UI answers, but it reports
# its local-dirs / log-dirs as over the limit, so the ResourceManager marks the
# node UNHEALTHY and stops placing containers on it.
#
# Symptom: store-rollup-probe is RUNNING on the RM with an ApplicationMaster on
# ds-spark-02 and no executors. One 1536 MB NodeManager holds the 1024 MB AM and
# has no room left for a 1024 MB executor.
#
# Lasting fix: restore a sane threshold on ds-spark-03 and restart that
# NodeManager. The probe then gets an executor and finishes on its own.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BAD_NM="ds-spark-03"
PROBE_NAME="store-rollup-probe"
THRESHOLD_KEY="yarn.nodemanager.disk-health-checker.max-disk-utilization-per-disk-percentage"

# RM REST helper: prints one "<host> <state>" line per node record.
rm_node_states() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - <<'PY'
import json, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/nodes", timeout=10))
for n in ((data.get("nodes") or {}).get("node")) or []:
    print(n.get("nodeHostName"), n.get("state"))
PY
}

# RM REST helper: prints "<id> <state>" for every app with the given name.
rm_apps_named() {
  kubectl -n "$LEARNER_NS" exec -i "$YARN_RM_POD" -c "$YARN_RM_POD" -- python3 - "$1" <<'PY'
import json, sys, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
for a in ((data.get("apps") or {}).get("app")) or []:
    if a.get("name") == sys.argv[1]:
        print(a.get("id"), a.get("state"))
PY
}

yarn_seed_all

echo "==> plant a tight disk-health threshold on $BAD_NM"
in_pod "$BAD_NM" "
  set -euo pipefail
  conf=/opt/hadoop/etc/hadoop/yarn-site.xml
  sed -i '/${THRESHOLD_KEY}/{n;s|<value>.*</value>|<value>0.9</value>|}' \"\$conf\"
  grep -A1 '${THRESHOLD_KEY}' \"\$conf\" | grep -q '<value>0.9</value>'
  echo 'threshold planted at 0.9'
" || { echo "failed to plant the threshold on $BAD_NM" >&2; exit 1; }

echo "==> start HDFS (NameNode + DataNode on ds-spark-01)"
yarn_start_hdfs || { echo "start HDFS failed" >&2; exit 1; }
yarn_seed_spark_hdfs || { echo "seed HDFS spark paths failed" >&2; exit 1; }

boot_phase "Starting the ResourceManager"
echo "==> start ResourceManager on ds-spark-01"
yarn_start_rm || { echo "start ResourceManager failed" >&2; exit 1; }
wait_yarn_rm || { echo "ResourceManager did not become ready" >&2; exit 1; }

boot_phase "Starting the NodeManagers"
echo "==> start NodeManagers on ds-spark-02 and ds-spark-03"
yarn_start_nm ds-spark-02 || { echo "start NodeManager failed on ds-spark-02" >&2; exit 1; }
yarn_start_nm "$BAD_NM" || { echo "start NodeManager failed on $BAD_NM" >&2; exit 1; }

boot_phase "Preparing the lab"
echo "==> wait for the RM to show ds-spark-02 RUNNING and $BAD_NM UNHEALTHY"
planted=0
for i in $(seq 1 60); do
  states="$(rm_node_states 2>/dev/null || true)"
  if grep -qx "ds-spark-02 RUNNING" <<<"$states" && grep -qx "$BAD_NM UNHEALTHY" <<<"$states"; then
    planted=1
    break
  fi
  sleep 2
done
if [[ "$planted" -ne 1 ]]; then
  echo "RM never showed ds-spark-02 RUNNING + $BAD_NM UNHEALTHY; last reading:" >&2
  echo "${states:-none}" >&2
  exit 1
fi
echo "$states"

yarn_seed_shell_helpers

echo "==> start the morning probe ($PROBE_NAME) from the shell"
in_shell '
  set -euo pipefail
  mkdir -p "$HOME/lab"
  cat > "$HOME/lab/submit-probe.sh" <<EOF
#!/usr/bin/env bash
# Morning store-rollup probe. Same shape the platform team runs every day.
exec spark-submit \\
  --master yarn \\
  --deploy-mode client \\
  --name store-rollup-probe \\
  --num-executors 2 \\
  --executor-cores 1 \\
  --executor-memory 512m \\
  /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-probe.sh"
  nohup setsid "$HOME/lab/submit-probe.sh" > "$HOME/lab/probe.out" 2>&1 < /dev/null &
  echo $! > "$HOME/lab/probe.pid"
  echo "probe driver pid $(cat "$HOME/lab/probe.pid")"
' || { echo "could not start the probe" >&2; exit 1; }

echo "==> wait for the probe to be RUNNING on the RM"
APP_ID=""
for i in $(seq 1 60); do
  APP_ID="$(rm_apps_named "$PROBE_NAME" 2>/dev/null | awk '$2 == "RUNNING" { print $1; exit }' || true)"
  [[ -n "$APP_ID" ]] && break
  sleep 2
done
if [[ -z "$APP_ID" ]]; then
  echo "probe never reached RUNNING on the RM" >&2
  rm_apps_named "$PROBE_NAME" >&2 || true
  in_shell 'tail -n 40 "$HOME/lab/probe.out"' >&2 || true
  exit 1
fi
echo "probe application id: $APP_ID"

# Grader state lives on the RM host, not in the learner's home.
in_pod ds-spark-01 "mkdir -p /opt/lab/state && printf '%s\\n' '$APP_ID' > /opt/lab/state/probe_app_id && printf '%s\\n' '$BAD_NM' > /opt/lab/state/unhealthy_nm"

in_shell '
  cat > "$HOME/lab/notes.txt" <<EOF
Chapter 2.2 - morning probe is RUNNING but produces nothing
Probe name:     store-rollup-probe
Driver output:  ~/lab/probe.out   (client mode, driver is on this shell)
Resubmit only if you lost the driver:  ~/lab/submit-probe.sh
EOF
'

ok "YARN up; $BAD_NM UNHEALTHY; probe $APP_ID RUNNING with no executors"
