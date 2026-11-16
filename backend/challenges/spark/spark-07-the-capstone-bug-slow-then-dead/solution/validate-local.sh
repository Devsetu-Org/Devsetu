#!/usr/bin/env bash
# Docker e2e for Lab 7 FetchFailed + shuffle janitor. Not the platform grader.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/spark-07-val-$$"
KEEP="${TMPDIR:-/tmp}/spark-07-val-last"
mkdir -p "$WORK"
cleanup() {
  mkdir -p "$KEEP"
  cp -f "$WORK"/b.out "$WORK"/b.err "$WORK"/f.out "$WORK"/f.err "$KEEP"/ 2>/dev/null || true
  docker rm -f s7v-m s7v-w1 s7v-w2 >/dev/null 2>&1 || true
  docker network rm s7vn >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

python3 - <<'PY' "$ROOT/setup.sh" "$WORK"
import re, sys
from pathlib import Path
src = Path(sys.argv[1]).read_text()
work = Path(sys.argv[2])
m = re.search(r"cat > /opt/spark/lab/jobs/store_rollup_shuffle\.py <<'EOF'\n(.*?)\nEOF\n", src, re.S)
assert m and "cat >" not in m.group(1)
(work / "store_rollup_shuffle.py").write_text(m.group(1))
print("extracted store_rollup_shuffle.py")
PY

start_worker() {
  local name=$1 host=$2
  docker run -d --name "$name" --hostname "$host" --network s7vn --memory=1792m \
    -e SPARK_NO_DAEMONIZE=true -e SPARK_LOCAL_DIRS=/opt/spark/work/spark-local \
    apache/spark:3.5.3 bash -c '
      set -euo pipefail
      mkdir -p /opt/spark/work/spark-local /opt/spark/lab
      dd if=/dev/zero of=/opt/spark/work/spark-local/DISK_FILLER bs=1M count=80 status=none
      cat > /opt/spark/lab/shuffle_janitor.sh <<'"'"'JAN'"'"'
#!/usr/bin/env bash
WORK=/opt/spark/work
while true; do
  sleep 2
  find "$WORK" -type f \( -path "*/blockmgr-*/*" -o -name "shuffle_*" \) ! -name DISK_FILLER -delete 2>/dev/null || true
done
JAN
      chmod 755 /opt/spark/lab/shuffle_janitor.sh
      nohup /opt/spark/lab/shuffle_janitor.sh >/opt/spark/lab/janitor.log 2>&1 &
      echo $! > /opt/spark/lab/shuffle_janitor.pid
      exec /opt/spark/bin/spark-class org.apache.spark.deploy.worker.Worker spark://ds-spark-01:7077 --cores 2 --memory 1536m --webui-port 8081
    '
}

docker network create s7vn >/dev/null
docker run -d --name s7v-m --hostname ds-spark-01 --network s7vn --memory=1g -e SPARK_NO_DAEMONIZE=true apache/spark:3.5.3 \
  /opt/spark/bin/spark-class org.apache.spark.deploy.master.Master --host ds-spark-01 --port 7077 --webui-port 8080 >/dev/null
sleep 3
start_worker s7v-w1 ds-spark-02 >/dev/null
start_worker s7v-w2 ds-spark-03 >/dev/null

for i in $(seq 1 60); do
  a=$(docker exec s7v-m curl -sf http://127.0.0.1:8080/json/ | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(1 for w in d.get("workers",[]) if w.get("state")=="ALIVE"))' 2>/dev/null||echo 0)
  [[ "$a" == 2 ]] && break
  sleep 1
done
[[ "${a:-0}" == 2 ]] || { echo "workers not alive"; exit 1; }

submit() {
  docker run --rm --network s7vn --memory=1536m -v "$WORK:/lab" -w /lab apache/spark:3.5.3 \
    /opt/spark/bin/spark-submit --master spark://ds-spark-01:7077 --deploy-mode client \
    --name store-rollup-shuffle --total-executor-cores 2 --executor-memory 512m \
    --conf spark.executor.memoryOverhead=128m /lab/store_rollup_shuffle.py
}

echo '=== BROKEN ==='
set +e
submit >"$WORK/b.out" 2>"$WORK/b.err"
set -e
grep -q SHUFFLE_FAIL "$WORK/b.out" || grep -qi 'FetchFailed\|SHUFFLE_FAIL\|stage failure' "$WORK/b.err" "$WORK/b.out"
echo broken_ok

echo '=== FIXED ==='
for w in s7v-w1 s7v-w2; do
  docker exec "$w" bash -c '
    if [[ -f /opt/spark/lab/shuffle_janitor.pid ]]; then
      kill -9 "$(cat /opt/spark/lab/shuffle_janitor.pid)" 2>/dev/null || true
    fi
    # Also stop any leftover sleep/find children of the janitor by exact argv basename.
    ps -eo pid=,args= | awk "/[s]huffle_janitor\\.sh/ { print \$1 }" | while read -r pid; do
      kill -9 "$pid" 2>/dev/null || true
    done
    rm -f /opt/spark/work/spark-local/DISK_FILLER
    echo janitor_gone
  '
done
sleep 2
set +e
submit >"$WORK/f.out" 2>"$WORK/f.err"
rc=$?
set -e
if ! grep -q SHUFFLE_OK "$WORK/f.out"; then
  echo "fixed submit rc=$rc"
  tail -n 40 "$WORK/f.out" || true
  tail -n 40 "$WORK/f.err" || true
  exit 1
fi
echo "SCENARIO_SIMULATABLE=yes"
