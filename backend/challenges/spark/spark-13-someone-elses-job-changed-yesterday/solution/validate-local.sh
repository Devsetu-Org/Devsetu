#!/usr/bin/env bash
# Docker e2e for Spark-13 (design analytics queue). Real setup.sh / grade.sh via
# kubectl→docker shim:
#   1. setup plants missing analytics + broken draft + probe wrapper
#   2. grade fails on the broken cluster
#   3. answers alone still fail
#   4. borrowing production still fails
#   5. broken draft refresh (sum 120) fails; real rebalance + refresh + run passes
set -euo pipefail

IMAGE="${SPARK_YARN_LAB_IMAGE:-devsetu/spark-yarn-lab:v0.1}"
PREFIX="s13v"
NET="${PREFIX}n"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAB_DIR="$(cd "$HERE/.." && pwd)"
KEEP="${KEEP:-0}"

SHIM_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$SHIM_DIR"
  if [[ "$KEEP" == "1" ]]; then
    echo "KEEP=1 — containers left running (prefix $PREFIX-)"
    return
  fi
  docker rm -f "$PREFIX-ds-spark-01" "$PREFIX-ds-spark-02" "$PREFIX-ds-spark-03" "$PREFIX-shell" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "missing image $IMAGE — build with: docker build -t $IMAGE images/spark-yarn-lab" >&2
  exit 1
fi

docker rm -f "$PREFIX-ds-spark-01" "$PREFIX-ds-spark-02" "$PREFIX-ds-spark-03" "$PREFIX-shell" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true
docker network create "$NET" >/dev/null

run_host() {
  local host=$1 mem=$2
  docker run -d --name "$PREFIX-$host" --hostname "$host" --network "$NET" --network-alias "$host" \
    --memory="$mem" --user spark --workdir /opt/spark \
    -e HOME=/home/spark \
    -e YARN_RM_HOST=ds-spark-01 \
    -e SPARK_LOCAL_HOSTNAME="$host" \
    -e NM_MEMORY_MB=1536 \
    -e NM_VCORES=2 \
    "$IMAGE" sleep infinity >/dev/null
}

run_host ds-spark-01 1536m
run_host ds-spark-02 2g
run_host ds-spark-03 2g
run_host shell 2g

cat > "$SHIM_DIR/kubectl" <<EOF
#!/usr/bin/env bash
set -euo pipefail
interactive=""
pod=""
while [[ \$# -gt 0 ]]; do
  case "\$1" in
    -n) shift 2 ;;
    exec) shift ;;
    -i) interactive="-i"; shift ;;
    -c) shift 2 ;;
    --) shift; break ;;
    *) pod="\$1"; shift ;;
  esac
done
[[ -n "\$pod" ]] || { echo "kubectl shim: no pod" >&2; exit 2; }
exec docker exec \$interactive -u spark "$PREFIX-\$pod" "\$@"
EOF
chmod +x "$SHIM_DIR/kubectl"

export PATH="$SHIM_DIR:$PATH"
export LEARNER_NS="local"
export SPARK_POD="shell" SHELL_CONTAINER="shell"
export SPARK_MASTER="spark://ds-spark-01:7077" SPARK_MASTER_UI="http://ds-spark-01:8080"
export SPARK_MASTER_POD="ds-spark-01" YARN_RM_HOST="ds-spark-01" YARN_RM_POD="ds-spark-01"
export YARN_RM_UI="http://ds-spark-01:8088"

sh_exec() { docker exec -u spark "$PREFIX-shell" bash -lc "$1"; }
rm_exec() { docker exec -u spark "$PREFIX-ds-spark-01" bash -lc "$1"; }

run_grade() {
  set +e
  bash "$LAB_DIR/grade.sh" 2>/dev/null
  local rc=$?
  set -e
  return "$rc"
}

expect_fail_with() {
  local want=$1 out
  set +e
  out="$(bash "$LAB_DIR/grade.sh" 2>/dev/null)"
  local rc=$?
  set -e
  echo "$out"
  if [[ "$rc" -eq 0 ]]; then
    echo "UNEXPECTED: grade passed" >&2
    exit 1
  fi
  if ! grep -qF -- "$want" <<<"$out"; then
    echo "UNEXPECTED: grade failed, but not with: $want" >&2
    exit 1
  fi
  echo "grade failed as expected"
}

write_answers() {
  local fix_id=$1
  sh_exec "
    mkdir -p \"\$HOME/answers\"
    cd \"\$HOME/answers\"
    printf 'queue-missing' > firstFailure
    printf 'add-analytics-rebalance' > designAction
    printf 'rebalance-siblings' > capacitySource
    printf 'refresh-queues' > applyMethod
    printf '%s' '$fix_id' > fixedAppId
    printf 'design-not-borrow' > platformLesson
  "
}

write_analytics_xml() {
  # Valid design: default 10 / production 55 / adhoc 10 / analytics 25
  # + user-limit-factor 3 + maximum-capacity 100 so AM+executor fit when idle.
  rm_exec '
    cat > /opt/hadoop/etc/hadoop/capacity-scheduler.xml <<'"'"'EOF'"'"'
<?xml version="1.0"?>
<configuration>
  <property>
    <name>yarn.scheduler.capacity.root.queues</name>
    <value>default,production,adhoc,analytics</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.capacity</name>
    <value>10</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.maximum-capacity</name>
    <value>10</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.production.capacity</name>
    <value>55</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.production.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.adhoc.capacity</name>
    <value>10</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.adhoc.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.analytics.capacity</name>
    <value>25</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.analytics.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.analytics.user-limit-factor</name>
    <value>3</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.maximum-am-resource-percent</name>
    <value>0.5</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.resource-calculator</name>
    <value>org.apache.hadoop.yarn.util.resource.DefaultResourceCalculator</value>
  </property>
</configuration>
EOF
    yarn rmadmin -refreshQueues
    yarn queue -status analytics | head -20
  '
}

echo "=================== 1. setup.sh ==================="
bash "$LAB_DIR/setup.sh"

echo "=================== 2. broken-state evidence ==================="
sh_exec 'yarn queue -status analytics 2>&1 | head -5 || true'
sh_exec 'grep -n queue "$HOME/lab/submit-analytics-probe.sh"'
sh_exec 'tail -n 30 "$HOME/lab/first_submit.out" || true'
sh_exec 'grep -E "queues|analytics.capacity|adhoc.capacity" "$HOME/lab/capacity-draft.xml" | head -20'

echo "=================== 3. grade on the broken cluster (must fail) ==================="
if run_grade; then
  echo "UNEXPECTED: grade passed on the broken cluster" >&2
  exit 1
fi
echo "grade failed as expected"

echo "=================== 4. answers only, scheduler still missing analytics (must fail) ==================="
write_answers "application_0_0000"
expect_fail_with "analytics queue is missing"

echo "=================== 5. shortcut: borrow production (must fail) ==================="
sh_exec '
  set -euo pipefail
  cat > "$HOME/lab/submit-analytics-probe.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
set -euo pipefail
exec spark-submit \
  --master yarn \
  --deploy-mode client \
  --queue production \
  --name analytics-probe \
  --num-executors 1 \
  --executor-cores 1 \
  --executor-memory 512m \
  /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-analytics-probe.sh"
  "$HOME/lab/submit-analytics-probe.sh"
'
BORROW_ID="$(
  docker exec -i -u spark "$PREFIX-ds-spark-01" python3 - <<'PY'
import json, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
apps = ((data.get("apps") or {}).get("app")) or []
best = None
for a in apps:
    if a.get("name") != "analytics-probe":
        continue
    if "production" not in (a.get("queue") or ""):
        continue
    if a.get("state") in ("FINISHED", "RUNNING", "SUCCEEDED"):
        best = a.get("id")
        break
print(best or "")
PY
)"
echo "borrowed production app: ${BORROW_ID:-none}"
write_answers "${BORROW_ID:-application_0_0000}"
expect_fail_with "analytics queue is missing"

# Restore wrapper to analytics before the real fix.
sh_exec '
  cat > "$HOME/lab/submit-analytics-probe.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
set -euo pipefail
exec spark-submit \
  --master yarn \
  --deploy-mode client \
  --queue analytics \
  --name analytics-probe \
  --num-executors 1 \
  --executor-cores 1 \
  --executor-memory 512m \
  /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-analytics-probe.sh"
'

echo "=================== 6. broken draft on RM (sum 120) — refresh must fail ==================="
docker exec -u spark "$PREFIX-shell" cat /home/spark/lab/capacity-draft.xml \
  | docker exec -i -u spark "$PREFIX-ds-spark-01" tee /opt/hadoop/etc/hadoop/capacity-scheduler.xml >/dev/null
set +e
bad_out="$(rm_exec 'yarn rmadmin -refreshQueues 2>&1')"
bad_rc=$?
set -e
echo "$bad_out" | tail -n 15
if [[ "$bad_rc" -eq 0 ]]; then
  echo "UNEXPECTED: refreshQueues accepted illegal capacity sum" >&2
  exit 1
fi
echo "$bad_out" | grep -qi 'Illegal capacity' \
  || { echo "UNEXPECTED: refresh failed for a different reason" >&2; exit 1; }
echo "broken draft rejected as expected"

echo "=================== 7. real fix: rebalance + refresh + run ==================="
write_analytics_xml
sh_exec '"$HOME/lab/submit-analytics-probe.sh"'

FIX_ID="$(
  docker exec -i -u spark "$PREFIX-ds-spark-01" python3 - <<'PY'
import json, urllib.request, time
best = None
for _ in range(30):
    data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
    apps = ((data.get("apps") or {}).get("app")) or []
    for a in apps:
        if a.get("name") != "analytics-probe":
            continue
        if "analytics" not in (a.get("queue") or ""):
            continue
        if a.get("state") == "FINISHED" and a.get("finalStatus") == "SUCCEEDED":
            print(a.get("id") or "")
            raise SystemExit
        if best is None and a.get("state") in ("FINISHED", "RUNNING"):
            best = a.get("id")
    time.sleep(2)
print(best or "")
PY
)"
if [[ -z "$FIX_ID" ]]; then
  echo "no successful analytics-probe in analytics queue" >&2
  sh_exec 'yarn application -list -appStates ALL 2>/dev/null' >&2 || true
  exit 1
fi
echo "fix id: $FIX_ID"
write_answers "$FIX_ID"

echo "=================== 8. grade (must pass) ==================="
if ! run_grade; then
  echo "grade did not pass after the fix; last run:" >&2
  bash "$LAB_DIR/grade.sh" || true
  exit 1
fi
sh_exec 'yarn application -list -appStates ALL 2>/dev/null'
sh_exec 'yarn queue -status analytics 2>/dev/null | head -15'
echo "SCENARIO_SIMULATABLE=yes"
