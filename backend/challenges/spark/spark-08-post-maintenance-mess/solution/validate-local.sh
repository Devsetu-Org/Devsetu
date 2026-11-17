#!/usr/bin/env bash
# Docker e2e for Post-Maintenance Mess. Not the platform grader.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/spark-08-val-$$"
mkdir -p "$WORK"
trap 'docker rm -f s8v-m s8v-w1 s8v-w2 >/dev/null 2>&1 || true; docker network rm s8vn >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

python3 - <<'PY' "$ROOT/setup.sh" "$WORK"
import re, sys
from pathlib import Path
src = Path(sys.argv[1]).read_text()
work = Path(sys.argv[2])
m = re.search(r"cat > /opt/spark/lab/jobs/store_rollup_probe\.py <<'EOF'\n(.*?)\nEOF\n", src, re.S)
assert m and "cat >" not in m.group(1)
(work / "store_rollup_probe.py").write_text(m.group(1))
print("extracted store_rollup_probe.py")
PY

docker network rm s8vn >/dev/null 2>&1 || true
docker rm -f s8v-m s8v-w1 s8v-w2 >/dev/null 2>&1 || true
docker network create s8vn >/dev/null
docker run -d --name s8v-m --hostname ds-spark-01 --network s8vn --memory=1g -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  bash -c 'mkdir -p /opt/spark/work && rm -rf /opt/spark/work/eventlogs && echo planted > /opt/spark/work/eventlogs && \
    exec /opt/spark/bin/spark-class org.apache.spark.deploy.master.Master --host ds-spark-01 --port 7077 --webui-port 8080' >/dev/null
sleep 3

start_broken_worker() {
  local name=$1 host=$2
  docker run -d --name "$name" --hostname "$host" --network s8vn --memory=1536m -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
    bash -c '
      mkdir -p /opt/spark/work
      rm -rf /opt/spark/work/eventlogs
      echo planted > /opt/spark/work/eventlogs
      chmod 000 /opt/spark/work
      # Stale master — will not register usefully
      exec /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker \
        spark://old-master.quickbite.internal:7077 --cores 2 --memory 1536m --webui-port 8081
    ' >/dev/null
}

start_broken_worker s8v-w1 ds-spark-02
start_broken_worker s8v-w2 ds-spark-03
sleep 5

echo '=== BROKEN ==='
# Prove the three plants without hanging on a resource wait.
alive=$(docker exec s8v-m curl -sf http://127.0.0.1:8080/json/ | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for w in d.get("workers",[]) if w.get("state")=="ALIVE"))' 2>/dev/null||echo 0)
[[ "$alive" == "0" ]] || { echo "expected 0 ALIVE workers, got $alive"; exit 1; }
docker exec s8v-w1 bash -c 'test ! -x /opt/spark/work || test ! -w /opt/spark/work'
docker exec s8v-m bash -c 'test -f /opt/spark/work/eventlogs && test ! -d /opt/spark/work/eventlogs'
echo broken_ok

echo '=== FIXED ==='
for w in s8v-w1 s8v-w2; do
  docker rm -f "$w" >/dev/null
done
# Fix eventlogs on master
docker exec s8v-m bash -c 'rm -f /opt/spark/work/eventlogs; mkdir -p /opt/spark/work/eventlogs'

docker run -d --name s8v-w1 --hostname ds-spark-02 --network s8vn --memory=1536m -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  bash -c 'mkdir -p /opt/spark/work/eventlogs && chmod 755 /opt/spark/work && \
    exec /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker spark://ds-spark-01:7077 --cores 2 --memory 1536m --webui-port 8081' >/dev/null
docker run -d --name s8v-w2 --hostname ds-spark-03 --network s8vn --memory=1536m -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  bash -c 'mkdir -p /opt/spark/work/eventlogs && chmod 755 /opt/spark/work && \
    exec /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker spark://ds-spark-01:7077 --cores 2 --memory 1536m --webui-port 8081' >/dev/null

for i in $(seq 1 40); do
  a=$(docker exec s8v-m curl -sf http://127.0.0.1:8080/json/ | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for w in d.get("workers",[]) if w.get("state")=="ALIVE"))' 2>/dev/null||echo 0)
  [[ "$a" == 2 ]] && break
  sleep 1
done

set +e
docker run --rm --network s8vn --memory=1g -v "$WORK:/lab" -w /lab apache/spark:3.5.3 \
  /opt/spark/bin/spark-submit --master spark://ds-spark-01:7077 --deploy-mode client \
  --name store-rollup-probe --total-executor-cores 2 --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  --conf spark.eventLog.enabled=false \
  /lab/store_rollup_probe.py \
  >"$WORK/f.out" 2>"$WORK/f.err"
set -e
grep -q PROBE_OK "$WORK/f.out"
echo "SCENARIO_SIMULATABLE=yes"
