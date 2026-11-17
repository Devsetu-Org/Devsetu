#!/usr/bin/env bash
# Docker e2e for DNS + Memory + Disk Triple. Not the platform grader.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/spark-14-val-$$"
KEEP="${TMPDIR:-/tmp}/spark-14-val-last"
mkdir -p "$WORK" "$KEEP"
cleanup() {
  cp -f "$WORK"/b.out "$WORK"/b.err "$WORK"/f.out "$WORK"/f.err "$KEEP"/ 2>/dev/null || true
  docker rm -f s14v-m s14v-w1 s14v-w2 >/dev/null 2>&1 || true
  docker network rm s14vn >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Portable deadline (macOS has no GNU timeout).
run_deadline() {
  local secs=$1; shift
  "$@" &
  local pid=$!
  (
    sleep "$secs"
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  ) &
  local killer=$!
  wait "$pid"
  local rc=$?
  kill "$killer" 2>/dev/null || true
  wait "$killer" 2>/dev/null || true
  return $rc
}

python3 - <<'PY' "$ROOT/setup.sh" "$WORK"
import re, sys
from pathlib import Path
src = Path(sys.argv[1]).read_text()
work = Path(sys.argv[2])
m = re.search(r"cat > /opt/spark/lab/jobs/store_rollup_triple\.py <<'EOF'\n(.*?)\nEOF\n", src, re.S)
assert m and "cat >" not in m.group(1)
(work / "store_rollup_triple.py").write_text(m.group(1))
print("extracted store_rollup_triple.py")
PY

docker network rm s14vn >/dev/null 2>&1 || true
docker rm -f s14v-m s14v-w1 s14v-w2 >/dev/null 2>&1 || true
docker network create s14vn >/dev/null
docker run -d --name s14v-m --hostname ds-spark-01 --network s14vn --memory=1g -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  /opt/spark/bin/spark-class org.apache.spark.deploy.master.Master --host ds-spark-01 --port 7077 --webui-port 8080 >/dev/null
sleep 3

start_worker() {
  local name=$1 host=$2
  docker run -d --name "$name" --hostname "$host" --network s14vn --memory=1792m \
    -e SPARK_NO_DAEMONIZE=true -e SPARK_LOCAL_DIRS=/opt/spark/work/spark-local \
    apache/spark:3.5.3 bash -c '
      mkdir -p /opt/spark/work/spark-local
      dd if=/dev/zero of=/opt/spark/work/spark-local/DISK_FILLER bs=1M count=80 status=none
      exec /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker \
        spark://ds-spark-01:7077 --cores 2 --memory 1536m --webui-port 8081
    ' >/dev/null
}
start_worker s14v-w1 ds-spark-02
start_worker s14v-w2 ds-spark-03

for i in $(seq 1 60); do
  a=$(docker exec s14v-m curl -sf http://127.0.0.1:8080/json/ | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for w in d.get("workers",[]) if w.get("state")=="ALIVE"))' 2>/dev/null||echo 0)
  [[ "$a" == 2 ]] && break
  sleep 1
done
[[ "${a:-0}" == 2 ]] || { echo "workers not alive"; exit 1; }

echo '=== BROKEN (bad driver host) ==='
set +e
run_deadline 90 docker run --rm --hostname shell --network s14vn --memory=1536m -v "$WORK:/lab" -w /lab \
  apache/spark:3.5.3 \
  /opt/spark/bin/spark-submit --master spark://ds-spark-01:7077 --deploy-mode client \
  --name store-rollup-triple --total-executor-cores 2 --executor-memory 512m \
  --conf spark.driver.host=broken-host.quickbite.invalid \
  --conf spark.driver.bindAddress=0.0.0.0 \
  --conf spark.executor.memoryOverhead=48m \
  --conf spark.eventLog.enabled=false \
  --conf spark.task.maxFailures=1 \
  /lab/store_rollup_triple.py \
  >"$WORK/b.out" 2>"$WORK/b.err"
set -e
grep -q TRIPLE_FAIL "$WORK/b.out" \
  || grep -qiE 'UnknownHost|broken-host|ConnectException|TRIPLE_FAIL|Lost task|ExecutorLost|UnresolvedAddress|NoRouteToHost' "$WORK/b.err" "$WORK/b.out"
echo broken_ok

echo '=== FIXED (host + overhead + no filler) ==='
for w in s14v-w1 s14v-w2; do
  docker exec "$w" rm -f /opt/spark/work/spark-local/DISK_FILLER
done
set +e
run_deadline 180 docker run --rm --hostname shell --network s14vn --memory=1536m -v "$WORK:/lab" -w /lab \
  apache/spark:3.5.3 \
  /opt/spark/bin/spark-submit --master spark://ds-spark-01:7077 --deploy-mode client \
  --name store-rollup-triple --total-executor-cores 2 --executor-memory 512m \
  --conf spark.driver.host=shell \
  --conf spark.driver.bindAddress=0.0.0.0 \
  --conf spark.executor.memoryOverhead=128m \
  --conf spark.eventLog.enabled=false \
  /lab/store_rollup_triple.py \
  >"$WORK/f.out" 2>"$WORK/f.err"
rc=$?
set -e
if ! grep -q TRIPLE_OK "$WORK/f.out"; then
  echo "fixed submit rc=$rc"
  tail -n 60 "$WORK/f.out" || true
  tail -n 60 "$WORK/f.err" || true
  exit 1
fi
echo "SCENARIO_SIMULATABLE=yes"
