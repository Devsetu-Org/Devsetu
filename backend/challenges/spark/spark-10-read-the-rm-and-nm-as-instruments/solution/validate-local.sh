#!/usr/bin/env bash
# Docker e2e for Spark-10. Runs the real setup.sh and grade.sh against four
# containers through a kubectl shim (kubectl exec -> docker exec):
#   1. setup.sh plants the UNHEALTHY NodeManager and the starved probe
#   2. grade.sh must FAIL on the broken cluster
#   3. grade.sh must still FAIL with correct answers but no fix
#   4. two shortcut conf edits (checker off, threshold 100%) must FAIL
#      — conf only, no NM restart (restarting mid-flight kills the probe)
#   5. apply the real fix once, wait, grade.sh must PASS
# Not the platform (no EKS, no pod memory limits beyond docker --memory).
set -euo pipefail

IMAGE="${SPARK_YARN_LAB_IMAGE:-devsetu/spark-yarn-lab:v0.1}"
PREFIX="s10v"
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

# kubectl shim: only the form lab.sh uses — kubectl -n NS exec [-i] POD -c C -- cmd…
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
# \$interactive is intentionally unquoted: empty means no flag (bash 3.2 safe).
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
nm3_exec() { docker exec -u spark "$PREFIX-ds-spark-03" bash -lc "$1"; }

run_grade() {
  set +e
  bash "$LAB_DIR/grade.sh" 2>/dev/null
  local rc=$?
  set -e
  return "$rc"
}

# Runs grade, expects a failure whose output contains $1.
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
  if ! grep -qF "$want" <<<"$out"; then
    echo "UNEXPECTED: grade failed, but not with: $want" >&2
    exit 1
  fi
  echo "grade failed as expected"
}

CONF=/opt/hadoop/etc/hadoop/yarn-site.xml

echo "=================== 1. setup.sh ==================="
bash "$LAB_DIR/setup.sh"

echo "=================== 2. broken-state evidence ==================="
sh_exec 'yarn node -list -all 2>/dev/null'
sh_exec 'yarn application -list 2>/dev/null'
echo "--- health report for ds-spark-03 (RM) ---"
sh_exec 'for id in $(yarn node -list -all 2>/dev/null | awk "/^ds-spark-03.*UNHEALTHY/ {print \$1}"); do yarn node -status "$id" 2>/dev/null | grep -E "Node-State|Health-Report"; done'
echo "--- disk on ds-spark-03 ---"
nm3_exec 'df -h /var/hadoop/yarn/local | tail -1; jps -l | grep -i nodemanager'
echo "--- wait for the driver to complain (up to 60s) ---"
for i in $(seq 1 30); do
  if sh_exec 'grep -q "Initial job has not accepted any resources" "$HOME/lab/probe.out"'; then
    sh_exec 'grep -m1 "Initial job has not accepted any resources" "$HOME/lab/probe.out"'
    break
  fi
  sleep 2
done

echo "=================== 3. grade on the broken cluster (must fail) ==================="
if run_grade; then
  echo "UNEXPECTED: grade passed on the broken cluster" >&2
  exit 1
fi
echo "grade failed as expected"

echo "=================== 4. correct answers, no fix (must fail) ==================="
APP_ID="$(docker exec -u spark "$PREFIX-ds-spark-01" cat /opt/lab/state/probe_app_id | tr -d '\r\n')"
sh_exec "
  mkdir -p \"\$HOME/answers\"
  cd \"\$HOME/answers\"
  printf '1' > incidentActiveNodes
  printf 'ds-spark-03' > unhealthyHost
  printf 'UNHEALTHY' > nodeState
  printf '%s' '$APP_ID' > probeAppId
  printf 'RUNNING' > probeAppState
  printf 'am-only' > probeSymptom
  printf 'no-room-after-am' > whyNoExecutor
  printf 'alive-but-unhealthy' > nmJvm
  printf 'not-full' > diskTruth
  printf 'threshold-too-low' > rootCause
  printf 'restore-threshold-restart-nm' > lastingFix
  printf 'verify-on-node' > uiIsClaim
"
if run_grade; then
  echo "UNEXPECTED: grade passed with answers only and no fix" >&2
  exit 1
fi
echo "grade failed as expected"

# Shortcut checks edit conf only. Do NOT restart the NM here — that would let
# the starved probe allocate an executor, then a second restart kills it and
# leaves FAILED instead of the lasting-fix path (restore + one restart).
echo "=================== 5a. shortcut: switch the disk checker off (must fail) ==================="
nm3_exec "
  set -euo pipefail
  sed -i 's|</configuration>|  <property>\n    <name>yarn.nodemanager.disk-health-checker.enable</name>\n    <value>false</value>\n  </property>\n</configuration>|' $CONF
"
expect_fail_with "Disk health checker is disabled on ds-spark-03"

echo "=================== 5b. shortcut: threshold 100% (must fail) ==================="
nm3_exec "
  set -euo pipefail
  sed -i '/disk-health-checker.enable<\/name>/{n;s|false|true|}' $CONF
  sed -i '/max-disk-utilization-per-disk-percentage/{n;s|<value>.*</value>|<value>100.0</value>|}' $CONF
"
expect_fail_with "never flags a full disk"

echo "=================== 6. real fix on ds-spark-03 ==================="
nm3_exec "
  set -euo pipefail
  sed -i '/max-disk-utilization-per-disk-percentage/{n;s|<value>.*</value>|<value>90.0</value>|}' $CONF
  grep -A1 'max-disk-utilization-per-disk-percentage' $CONF
  yarn --daemon stop nodemanager
  yarn --daemon start nodemanager
"

echo "==> wait for ds-spark-03 RUNNING on the RM"
for i in $(seq 1 45); do
  if sh_exec 'yarn node -list 2>/dev/null' | grep -q '^ds-spark-03:.*RUNNING'; then
    break
  fi
  sleep 2
done
sh_exec 'yarn node -list 2>/dev/null' | grep -q '^ds-spark-03:.*RUNNING' \
  || { echo "ds-spark-03 never came back RUNNING" >&2; exit 1; }

echo "=================== 7. grade (must pass) ==================="
passed=0
for i in $(seq 1 36); do
  if run_grade; then
    passed=1
    break
  fi
  sleep 5
done
sh_exec 'yarn node -list -all 2>/dev/null; yarn application -list -appStates ALL 2>/dev/null'
if [[ "$passed" -ne 1 ]]; then
  echo "grade never passed after the fix; last run:" >&2
  bash "$LAB_DIR/grade.sh" || true
  sh_exec 'tail -n 40 "$HOME/lab/probe.out"' >&2 || true
  exit 1
fi
echo "SCENARIO_SIMULATABLE=yes"
