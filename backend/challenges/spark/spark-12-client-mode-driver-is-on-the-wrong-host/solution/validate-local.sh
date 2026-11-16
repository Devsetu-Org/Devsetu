#!/usr/bin/env bash
# Docker e2e for Spark-12 stacked failure. Real setup.sh / grade.sh via kubectl shim.
# Shared mount: Docker volume -> /mnt/lab-shared on every host.
set -euo pipefail

IMAGE="${SPARK_YARN_LAB_IMAGE:-devsetu/spark-yarn-lab:v0.1}"
PREFIX="s12v"
NET="${PREFIX}n"
VOL="${PREFIX}-shared"
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
  docker volume rm "$VOL" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "missing image $IMAGE — build with: docker build -t $IMAGE images/spark-yarn-lab" >&2
  exit 1
fi

docker rm -f "$PREFIX-ds-spark-01" "$PREFIX-ds-spark-02" "$PREFIX-ds-spark-03" "$PREFIX-shell" >/dev/null 2>&1 || true
docker volume rm "$VOL" >/dev/null 2>&1 || true
docker network rm "$NET" >/dev/null 2>&1 || true
docker network create "$NET" >/dev/null
docker volume create "$VOL" >/dev/null

run_host() {
  local host=$1 mem=$2
  docker run -d --name "$PREFIX-$host" --hostname "$host" --network "$NET" --network-alias "$host" \
    --memory="$mem" --user spark --workdir /opt/spark \
    -e HOME=/home/spark \
    -e YARN_RM_HOST=ds-spark-01 \
    -e SPARK_LOCAL_HOSTNAME="$host" \
    -e NM_MEMORY_MB=1536 \
    -e NM_VCORES=2 \
    -v "$VOL:/mnt/lab-shared" \
    "$IMAGE" sleep infinity >/dev/null
}

run_host ds-spark-01 1536m
run_host ds-spark-02 2g
run_host ds-spark-03 2g
run_host shell 2g

# Volume is often root-owned; fix perms as root so user spark can write.
docker run --rm -u 0 -v "$VOL:/mnt/lab-shared" "$IMAGE" bash -lc 'mkdir -p /mnt/lab-shared && chmod 777 /mnt/lab-shared'

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
  local want=$1 out rc
  set +e
  out="$(bash "$LAB_DIR/grade.sh" 2>/dev/null)"
  rc=$?
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

write_partial_answers() {
  local failed=$1
  sh_exec "
    mkdir -p \"\$HOME/answers\"
    cd \"\$HOME/answers\"
    printf '%s' '$failed' > failedAppId
    printf 'driver-on-edge' > failureMode
    printf 'edge-path-on-nm' > secondBreak
    printf 'shared-mount' > dataPlacement
    printf 'cluster-am' > productionShape
  "
}

echo "=================== 1. setup.sh ==================="
bash "$LAB_DIR/setup.sh"

FAILED_ID="$(docker exec -u spark "$PREFIX-ds-spark-01" cat /opt/lab/state/failed_app_id | tr -d '\r\n')"
echo "failed id: $FAILED_ID"

echo "=================== 2. broken evidence ==================="
sh_exec 'yarn application -list -appStates ALL 2>/dev/null'
sh_exec 'grep -E "deploy-mode|edge-data|lab-shared" "$HOME/lab/submit-store-rollup.sh" "$HOME/lab/store_rollup.py" || true'
sh_exec 'ls -la "$HOME/lab/edge-data"; ls -la /mnt/lab-shared || true'

echo "=================== 3. grade broken (must fail) ==================="
if run_grade; then
  echo "UNEXPECTED: grade passed on broken cluster" >&2
  exit 1
fi
echo "grade failed as expected"

echo "=================== 4. cluster mode only (second break) ==================="
sh_exec '
  set -euo pipefail
  cat > "$HOME/lab/submit-store-rollup.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
set -euo pipefail
exec spark-submit \
  --master yarn \
  --deploy-mode cluster \
  --name store-rollup \
  --num-executors 2 \
  --executor-cores 1 \
  --executor-memory 512m \
  "$HOME/lab/store_rollup.py"
EOF
  chmod +x "$HOME/lab/submit-store-rollup.sh"
  set +e
  "$HOME/lab/submit-store-rollup.sh"
  rc=$?
  set -e
  echo "cluster-only submit exit=$rc (expect non-zero / failed app)"
'
write_partial_answers "$FAILED_ID"
# Still edge paths in the py file — grade must fail on edge-data.
expect_fail_with "edge-data"

echo "=================== 5. full fix: shared mount + job paths ==================="
sh_exec '
  set -euo pipefail
  mkdir -p /mnt/lab-shared/rollup
  cp -f "$HOME/lab/edge-data/orders.csv" "$HOME/lab/edge-data/stores.csv" /mnt/lab-shared/rollup/
  cat > "$HOME/lab/store_rollup.py" <<'"'"'PY'"'"'
from pyspark.sql import SparkSession
spark = SparkSession.builder.getOrCreate()
orders = spark.read.csv("file:///mnt/lab-shared/rollup/orders.csv", header=True, inferSchema=True)
stores = spark.read.csv("file:///mnt/lab-shared/rollup/stores.csv", header=True, inferSchema=True)
joined = orders.join(stores, "store_id")
rollup = joined.groupBy("region").sum("amount")
rollup.orderBy("region").show(truncate=False)
spark.stop()
PY
  "$HOME/lab/submit-store-rollup.sh"
'

# Wait for a FINISHED store-rollup that is not the overnight failure.
FIX_ID=""
DRIVER_HOST=""
for i in $(seq 1 60); do
  read -r FIX_ID DRIVER_HOST < <(
    docker exec -i -u spark "$PREFIX-ds-spark-01" python3 - "$FAILED_ID" <<'PY'
import json, sys, urllib.request
failed = sys.argv[1]
data = json.load(urllib.request.urlopen("http://127.0.0.1:8088/ws/v1/cluster/apps", timeout=10))
apps = ((data.get("apps") or {}).get("app")) or []
best = None
for a in apps:
    if a.get("name") != "store-rollup":
        continue
    if a.get("id") == failed:
        continue
    if a.get("state") == "FINISHED" and a.get("finalStatus") == "SUCCEEDED":
        best = a
        break
if not best:
    print("", "")
    raise SystemExit(0)
app = best["id"]
host = ""
try:
    att = json.load(urllib.request.urlopen(f"http://127.0.0.1:8088/ws/v1/cluster/apps/{app}/appattempts", timeout=10))
    attempts = ((att.get("appAttempts") or {}).get("appAttempt")) or []
    if isinstance(attempts, dict):
        attempts = [attempts]
    for a in attempts:
        node = a.get("nodeHttpAddress") or a.get("nodeId") or ""
        if "ds-spark-02" in node:
            host = "ds-spark-02"
        elif "ds-spark-03" in node:
            host = "ds-spark-03"
except Exception:
    pass
print(app, host)
PY
  )
  if [[ -n "$FIX_ID" ]]; then
    break
  fi
  sleep 3
done

if [[ -z "$FIX_ID" ]]; then
  echo "no successful store-rollup found" >&2
  sh_exec 'yarn application -list -appStates ALL 2>/dev/null' >&2 || true
  exit 1
fi
[[ -n "$DRIVER_HOST" ]] || DRIVER_HOST="ds-spark-02"
echo "fix id=$FIX_ID driver_host=$DRIVER_HOST"

sh_exec "
  mkdir -p \"\$HOME/answers\"
  cd \"\$HOME/answers\"
  printf '%s' '$FAILED_ID' > failedAppId
  printf 'driver-on-edge' > failureMode
  printf 'edge-path-on-nm' > secondBreak
  printf 'shared-mount' > dataPlacement
  printf '%s' '$FIX_ID' > clusterAppId
  printf '%s' '$DRIVER_HOST' > clusterDriverHost
  printf 'cluster-am' > productionShape
"

echo "=================== 6. grade (must pass) ==================="
if ! run_grade; then
  echo "grade did not pass after full fix:" >&2
  bash "$LAB_DIR/grade.sh" || true
  exit 1
fi
sh_exec 'yarn application -list -appStates ALL 2>/dev/null'
echo "SCENARIO_SIMULATABLE=yes"
