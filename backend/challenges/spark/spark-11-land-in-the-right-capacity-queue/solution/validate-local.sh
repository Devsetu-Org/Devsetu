#!/usr/bin/env bash
# Docker e2e for Spark-11 (A+C). Real setup.sh / grade.sh via kubectl→docker shim:
#   1. setup plants ACCEPTED store-rollup in default + broken wrapper
#   2. grade fails on the broken cluster
#   3. correct answers alone still fail
#   4. raising default capacity still fails
#   5. repair wrapper + run + answers → grade passes
set -euo pipefail

IMAGE="${SPARK_YARN_LAB_IMAGE:-devsetu/spark-yarn-lab:v0.1}"
PREFIX="s11v"
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
    printf 'ACCEPTED' > stuckState
    printf 'default' > stuckQueue
    printf 'ask-exceeds-default-share' > whyAccepted
    printf 'has-room' > productionSpare
    printf 'wrapper-queue-default' > wrongPath
    printf 'repair-wrapper-to-production' > lastingFix
    printf '%s' '$fix_id' > fixAppId
    printf 'platform-rule' > placementRule
  "
}

echo "=================== 1. setup.sh ==================="
bash "$LAB_DIR/setup.sh"

echo "=================== 2. broken-state evidence ==================="
sh_exec 'yarn application -list 2>/dev/null'
sh_exec 'yarn queue -status default 2>/dev/null | head -40 || true'
sh_exec 'yarn queue -status production 2>/dev/null | head -40 || true'
sh_exec 'grep -n queue "$HOME/lab/submit-store-rollup.sh"'
STUCK_ID="$(docker exec -u spark "$PREFIX-ds-spark-01" cat /opt/lab/state/stuck_app_id | tr -d '\r\n')"
echo "stuck id: $STUCK_ID"

echo "=================== 3. grade on the broken cluster (must fail) ==================="
if run_grade; then
  echo "UNEXPECTED: grade passed on the broken cluster" >&2
  exit 1
fi
echo "grade failed as expected"

echo "=================== 4. answers only, wrapper still wrong (must fail) ==================="
write_answers "$STUCK_ID"
expect_fail_with "Wrapper must use"

echo "=================== 5. shortcut: raise default capacity (must fail) ==================="
# Point the wrapper at production so the capacity check is the miss we assert on.
sh_exec 'sed -i "s/--queue default/--queue production/" "$HOME/lab/submit-store-rollup.sh"'
for host in ds-spark-01 ds-spark-02 ds-spark-03 shell; do
  docker exec -u spark "$PREFIX-$host" bash -lc '
    conf=/opt/hadoop/etc/hadoop/capacity-scheduler.xml
    python3 - <<'"'"'PY'"'"'
from pathlib import Path
p = Path("/opt/hadoop/etc/hadoop/capacity-scheduler.xml")
text = p.read_text()
text = text.replace(
    "<name>yarn.scheduler.capacity.root.default.capacity</name>\n    <value>10</value>",
    "<name>yarn.scheduler.capacity.root.default.capacity</name>\n    <value>70</value>",
)
text = text.replace(
    "<name>yarn.scheduler.capacity.root.default.maximum-capacity</name>\n    <value>10</value>",
    "<name>yarn.scheduler.capacity.root.default.maximum-capacity</name>\n    <value>70</value>",
)
p.write_text(text)
print("default capacity raised on", Path("/etc/hostname").read_text().strip() if Path("/etc/hostname").exists() else "?")
PY
  '
done
write_answers "application_0_0000"
expect_fail_with "default queue capacity looks raised"
# Restore tight default for the real fix path.
for host in ds-spark-01 ds-spark-02 ds-spark-03 shell; do
  docker exec -u spark "$PREFIX-$host" bash -lc '
    python3 - <<'"'"'PY'"'"'
from pathlib import Path
p = Path("/opt/hadoop/etc/hadoop/capacity-scheduler.xml")
text = p.read_text()
text = text.replace(
    "<name>yarn.scheduler.capacity.root.default.capacity</name>\n    <value>70</value>",
    "<name>yarn.scheduler.capacity.root.default.capacity</name>\n    <value>10</value>",
)
text = text.replace(
    "<name>yarn.scheduler.capacity.root.default.maximum-capacity</name>\n    <value>70</value>",
    "<name>yarn.scheduler.capacity.root.default.maximum-capacity</name>\n    <value>10</value>",
)
p.write_text(text)
PY
  '
done

echo "=================== 6. real fix: repair wrapper and run ==================="
sh_exec '
  set -euo pipefail
  cat > "$HOME/lab/submit-store-rollup.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
set -euo pipefail
exec spark-submit \
  --master yarn \
  --deploy-mode client \
  --queue production \
  --name store-rollup \
  --num-executors 2 \
  --executor-cores 1 \
  --executor-memory 512m \
  /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-store-rollup.sh"
  "$HOME/lab/submit-store-rollup.sh"
'

FIX_ID="$(
  docker exec -i -u spark "$PREFIX-ds-spark-01" python3 - <<'PY'
import json, urllib.request
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
apps = ((data.get("apps") or {}).get("app")) or []
best = None
for a in apps:
    if a.get("name") != "store-rollup":
        continue
    if "production" not in (a.get("queue") or ""):
        continue
    if a.get("state") == "FINISHED" and a.get("finalStatus") == "SUCCEEDED":
        best = a.get("id")
        break
    if best is None and a.get("state") in ("FINISHED", "RUNNING"):
        best = a.get("id")
print(best or "")
PY
)"
if [[ -z "$FIX_ID" || "$FIX_ID" == "$STUCK_ID" ]]; then
  echo "no successful production store-rollup found (fix=$FIX_ID stuck=$STUCK_ID)" >&2
  sh_exec 'yarn application -list -appStates ALL 2>/dev/null' >&2 || true
  exit 1
fi
echo "fix id: $FIX_ID"
write_answers "$FIX_ID"

echo "=================== 7. grade (must pass) ==================="
if ! run_grade; then
  echo "grade did not pass after the fix; last run:" >&2
  bash "$LAB_DIR/grade.sh" || true
  exit 1
fi
sh_exec 'yarn application -list -appStates ALL 2>/dev/null'
echo "SCENARIO_SIMULATABLE=yes"
