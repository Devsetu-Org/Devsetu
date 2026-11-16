#!/usr/bin/env bash
# Docker e2e for Lab 6 heterogeneous swap. Not the platform grader.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/spark-06-val-$$"
mkdir -p "$WORK"
trap 'docker rm -f s6v-m s6v-a s6v-b s6v-x >/dev/null 2>&1 || true; docker network rm s6vn >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

python3 - <<'PY' "$ROOT/setup.sh" "$WORK"
import re, sys
from pathlib import Path
src = Path(sys.argv[1]).read_text()
work = Path(sys.argv[2])
for name in ("team_b_debug_hold.py", "store_rollup_mem.py"):
    m = re.search(rf"cat > /opt/spark/lab/jobs/{re.escape(name)} <<'EOF'\n(.*?)\nEOF\n", src, re.S)
    assert m and "cat >" not in m.group(1), name
    (work / name).write_text(m.group(1))
    print("extracted", name)
PY

docker network create s6vn >/dev/null
docker run -d --name s6v-m --hostname ds-spark-01 --network s6vn --memory=1g -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  /opt/spark/bin/spark-class org.apache.spark.deploy.master.Master --host ds-spark-01 --port 7077 --webui-port 8080 >/dev/null
sleep 3
docker run -d --name s6v-a --hostname ds-spark-02 --network s6vn --memory=1280m -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker spark://ds-spark-01:7077 --cores 1 --memory 768m --webui-port 8081 >/dev/null
docker run -d --name s6v-b --hostname ds-spark-03 --network s6vn --memory=1200m --memory-swap=1200m -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker spark://ds-spark-01:7077 --cores 2 --memory 2048m --webui-port 8082 >/dev/null
for i in $(seq 1 40); do
  a=$(docker exec s6v-m curl -sf http://127.0.0.1:8080/json/ | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for w in d.get("workers",[]) if w.get("state")=="ALIVE"))' 2>/dev/null||echo 0)
  [[ "$a" == 2 ]] && break
  sleep 1
done

submit() {
  local name=$1 mem=$2 script=$3
  docker run --rm --network s6vn --memory=1g -v "$WORK:/lab" -w /lab apache/spark:3.5.3 \
    /opt/spark/bin/spark-submit --master spark://ds-spark-01:7077 --deploy-mode client \
    --name "$name" --total-executor-cores 1 --executor-memory "$mem" \
    --conf spark.executor.memoryOverhead=128m "/lab/$script"
}

docker run -d --name s6v-x --network s6vn --memory=1g -v "$WORK:/lab" -w /lab apache/spark:3.5.3 \
  /opt/spark/bin/spark-submit --master spark://ds-spark-01:7077 --deploy-mode client \
  --name team-b-debug-hold --total-executor-cores 1 --executor-memory 1024m \
  --conf spark.executor.memoryOverhead=128m /lab/team_b_debug_hold.py >/dev/null
for i in $(seq 1 90); do docker logs s6v-x 2>&1 | grep -q X_HOLDING && break; sleep 1; done

echo '=== BROKEN ==='
set +e
submit store-rollup-mem 1024m store_rollup_mem.py >"$WORK/b.out" 2>"$WORK/b.err"
set -e
grep -q Y_FAIL "$WORK/b.out" || grep -qi 'Lost task\|Python worker' "$WORK/b.err"
echo broken_ok

docker rm -f s6v-x >/dev/null
docker stop s6v-b >/dev/null
sleep 3
docker run -d --name s6v-x --network s6vn --memory=1g -v "$WORK:/lab" -w /lab apache/spark:3.5.3 \
  /opt/spark/bin/spark-submit --master spark://ds-spark-01:7077 --deploy-mode client \
  --name team-b-debug-hold --total-executor-cores 1 --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m /lab/team_b_debug_hold.py >/dev/null
for i in $(seq 1 90); do docker logs s6v-x 2>&1 | grep -q X_HOLDING && break; sleep 1; done
docker start s6v-b >/dev/null
for i in $(seq 1 40); do
  a=$(docker exec s6v-m curl -sf http://127.0.0.1:8080/json/ | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for w in d.get("workers",[]) if w.get("state")=="ALIVE"))' 2>/dev/null||echo 0)
  [[ "$a" == 2 ]] && break
  sleep 1
done
sleep 3

echo '=== FIXED ==='
set +e
submit store-rollup-mem 1024m store_rollup_mem.py >"$WORK/f.out" 2>"$WORK/f.err"
set -e
grep -q Y_OK "$WORK/f.out"
echo "SCENARIO_SIMULATABLE=yes"
