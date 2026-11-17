#!/usr/bin/env bash
# Docker e2e for Spark-09 — HDFS + YARN up, client + cluster store_join both FINISHED.
# Not the platform grader (no kubectl / LEARNER_NS).
set -euo pipefail

IMAGE="${SPARK_YARN_LAB_IMAGE:-devsetu/spark-yarn-lab:v0.1}"
NET="s9vn"
RM="s9v-rm"
NM1="s9v-nm1"
NM2="s9v-nm2"
SH="s9v-shell"

cleanup() {
  docker rm -f "$RM" "$NM1" "$NM2" "$SH" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "missing image $IMAGE — build with: docker build -t $IMAGE images/spark-yarn-lab" >&2
  exit 1
fi

cleanup
docker network create "$NET" >/dev/null
docker rm -f s9t-rm s9t-nm s9t-sh >/dev/null 2>&1 || true
docker network rm s9tn >/dev/null 2>&1 || true

run_host() {
  local name=$1 host=$2 mem=$3
  docker run -d --name "$name" --hostname "$host" --network "$NET" \
    --memory="$mem" --user spark \
    -e YARN_RM_HOST=ds-spark-01 \
    -e NM_MEMORY_MB=1536 \
    -e NM_VCORES=2 \
    -e YARN_MAX_ALLOC_MB=1024 \
    "$IMAGE" sleep infinity >/dev/null
}

run_host "$RM" ds-spark-01 1536m
run_host "$NM1" ds-spark-02 2g
run_host "$NM2" ds-spark-03 2g
run_host "$SH" shell 2g

seed() {
  local c=$1
  docker exec -u spark "$c" bash -lc '
    set -euo pipefail
    export YARN_RM_HOST=ds-spark-01 NM_MEMORY_MB=1536 NM_VCORES=2 YARN_MAX_ALLOC_MB=1024
    /opt/lab/bin/write-yarn-conf.sh
    mkdir -p /opt/spark/work/eventlogs /opt/spark/logs /opt/hadoop/logs
    cp -f /opt/lab/conf/spark-defaults.conf /opt/spark/conf/spark-defaults.conf
  '
}

echo "==> seed conf on every host"
for c in "$RM" "$NM1" "$NM2" "$SH"; do seed "$c"; done

echo "==> start HDFS on ds-spark-01"
docker exec -u spark "$RM" bash -lc '
  set -euo pipefail
  mkdir -p /var/hadoop/hdfs/namenode /var/hadoop/hdfs/datanode
  if [[ ! -d /var/hadoop/hdfs/namenode/current ]]; then
    hdfs namenode -format -force -nonInteractive >/opt/hadoop/logs/namenode-format.out 2>&1
  fi
  hdfs --daemon start namenode
  hdfs --daemon start datanode
  ready=0
  for i in $(seq 1 45); do
    hdfs dfsadmin -safemode leave >/dev/null 2>&1 || true
    if hdfs dfs -ls / >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 2
  done
  if [[ "$ready" -ne 1 ]]; then
    echo "HDFS not ready" >&2
    jps -l || true
    exit 1
  fi
  echo "HDFS writable"
  hdfs dfs -mkdir -p /spark/eventlogs /user/spark
  hdfs dfs -chmod -R 777 /spark /user || true
  echo "HDFS user dirs ready"
'

echo "==> start ResourceManager"
docker exec -u spark "$RM" bash -lc '
  export YARN_RESOURCEMANAGER_HEAPSIZE=384
  yarn --daemon start resourcemanager
'
for i in $(seq 1 45); do
  if docker exec -u spark "$RM" bash -lc 'jps -l 2>/dev/null | grep -F org.apache.hadoop.yarn.server.resourcemanager.ResourceManager >/dev/null'; then
    break
  fi
  sleep 2
done

start_nm() {
  docker exec -u spark "$1" bash -lc '
    export YARN_NODEMANAGER_HEAPSIZE=256
    yarn --daemon start nodemanager
  '
}

echo "==> start NodeManagers"
start_nm "$NM1"
start_nm "$NM2"

active=0
for i in $(seq 1 60); do
  active=$(docker exec -u spark "$RM" bash -lc '
    exec 3<>/dev/tcp/127.0.0.1/8088
    printf "GET /ws/v1/cluster/metrics HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3
    sed "1,/^\r\{0,1\}$/d" <&3
  ' 2>/dev/null | tr "," "\n" | awk -F: '/"activeNodes"/ { gsub(/[^0-9]/,"",$2); print $2+0; exit }' || true)
  if [[ -n "$active" && "$active" -ge 2 ]]; then
    echo "active nodes: $active"
    break
  fi
  sleep 2
done
[[ -n "$active" && "$active" -ge 2 ]] || { echo "expected 2 active NMs, got ${active:-none}" >&2; exit 1; }

echo "==> install repaired YARN wrapper"
docker exec -u spark "$SH" bash -lc '
  set -euo pipefail
  mkdir -p "$HOME/lab"
  cat > "$HOME/lab/submit-store-rollup.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-client}"
  spark-submit \
    --master yarn \
    --deploy-mode "$MODE" \
    --name "store-rollup-$MODE" \
    --num-executors 2 \
    --executor-cores 1 \
    --executor-memory 512m \
    /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-store-rollup.sh"
'

echo "==> client submit through repaired wrapper"
docker exec -u spark "$SH" bash -lc '"$HOME/lab/submit-store-rollup.sh" client'

echo "==> cluster submit"
docker exec -u spark "$SH" bash -lc '"$HOME/lab/submit-store-rollup.sh" cluster'

echo "==> assert both FINISHED"
apps=$(docker exec -u spark "$SH" bash -lc 'yarn application -list -appStates ALL 2>/dev/null' || true)
echo "$apps"
echo "$apps" | grep -q 'store-rollup-client' || { echo "missing client app" >&2; exit 1; }
echo "$apps" | grep -q 'store-rollup-cluster' || { echo "missing cluster app" >&2; exit 1; }

python3 - <<'PY'
import json, subprocess, sys
raw = subprocess.check_output([
  "docker","exec","-u","spark","s9v-rm","bash","-lc",
  r'''exec 3<>/dev/tcp/127.0.0.1/8088
printf "GET /ws/v1/cluster/apps HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3
sed "1,/^\r\{0,1\}$/d" <&3'''
], text=True)
i = raw.find("{")
j = raw.rfind("}")
data = json.loads(raw[i:j+1])
apps = (data.get("apps") or {}).get("app") or []
if isinstance(apps, dict):
  apps = [apps]
want = {"store-rollup-client": None, "store-rollup-cluster": None}
for a in apps:
  n = a.get("name")
  if n in want:
    want[n] = a.get("state")
print(want)
for n, st in want.items():
  if st != "FINISHED":
    print(f"FAIL: {n} state={st}", file=sys.stderr)
    sys.exit(1)
print("SCENARIO_SIMULATABLE=yes")
PY
