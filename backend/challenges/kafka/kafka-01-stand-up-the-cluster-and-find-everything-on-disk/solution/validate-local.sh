#!/usr/bin/env bash
# Docker e2e for Kafka Lab 1 (ZooKeeper era). Mirrors setup + grade checks.
set -euo pipefail

IMAGE="${KAFKA_IMAGE:-apache/kafka:3.9.1}"
ZK_IMAGE="${ZK_IMAGE:-zookeeper:3.9}"
NET="k1zk-net-$$"
PREFIX="k1zk-$$"
WORK="${TMPDIR:-/tmp}/kafka-01-zk-val-$$"
REAL_LOG=/var/lib/kafka/data
DECOY_KAFKA=/opt/kafka/kafka-logs
REAL_ZK=/data
DECOY_ZK=/opt/zookeeper/data

mkdir -p "$WORK"
cleanup() {
  docker rm -f "${PREFIX}-zk" "${PREFIX}-0" "${PREFIX}-1" "${PREFIX}-2" "${PREFIX}-shell" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "==> images $IMAGE + $ZK_IMAGE"
docker image inspect "$IMAGE" >/dev/null
docker image inspect "$ZK_IMAGE" >/dev/null
docker network create "$NET" >/dev/null

echo "==> ZooKeeper"
docker run -d --name "${PREFIX}-zk" --hostname zookeeper --network "$NET" --memory=256m \
  -e ZOO_4LW_COMMANDS_WHITELIST='*' -e ZOO_DATA_DIR=/data "$ZK_IMAGE" >/dev/null

start_broker() {
  local name=$1 id=$2
  docker run -d --name "$name" --hostname "$name" --network "$NET" --memory=512m "$IMAGE" bash -c "
set -euo pipefail
mkdir -p $REAL_LOG
cat > /tmp/server.properties <<EOF
broker.id=$id
listeners=PLAINTEXT://0.0.0.0:9092
advertised.listeners=PLAINTEXT://${name}:9092
zookeeper.connect=zookeeper:2181
log.dirs=$REAL_LOG
num.network.threads=2
num.io.threads=2
offsets.topic.replication.factor=3
offsets.topic.num.partitions=3
transaction.state.log.replication.factor=3
transaction.state.log.min.isr=2
default.replication.factor=3
min.insync.replicas=2
group.initial.rebalance.delay.ms=0
auto.create.topics.enable=false
delete.topic.enable=true
log.cleaner.dedupe.buffer.size=16777216
EOF
export KAFKA_HEAP_OPTS='-Xms256m -Xmx256m'
export KAFKA_JVM_PERFORMANCE_OPTS='-server -XX:+UseSerialGC -XX:MaxMetaspaceSize=64m -Xss256k'
export KAFKA_LOG_DIRS=$REAL_LOG
export KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
exec /opt/kafka/bin/kafka-server-start.sh /tmp/server.properties
" >/dev/null
}

# Wait for ZK before brokers
for _ in $(seq 1 30); do
  if docker exec "${PREFIX}-zk" bash -c 'exec 3<>/dev/tcp/127.0.0.1/2181; printf ruok >&3; grep -q imok <&3' 2>/dev/null; then
    break
  fi
  sleep 1
done

start_broker "${PREFIX}-0" 1
start_broker "${PREFIX}-1" 2
start_broker "${PREFIX}-2" 3

BS="${PREFIX}-0:9092,${PREFIX}-1:9092,${PREFIX}-2:9092"
ZK="zookeeper:2181"
docker run -d --name "${PREFIX}-shell" --network "$NET" --memory=512m \
  -e HOME=/tmp "$IMAGE" /bin/bash -c 'sleep infinity' >/dev/null

shell() {
  docker exec -e PATH="/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    -e BOOTSTRAP_SERVERS="$BS" \
    -e ZOOKEEPER_CONNECT="$ZK" \
    -e KAFKA_HEAP_OPTS="-Xms64m -Xmx64m" \
    -e HOME=/tmp \
    "${PREFIX}-shell" bash -c "$*"
}

dexec() {
  local c=$1; shift
  docker exec "$c" bash -c "$*"
}

echo "==> wait for brokers + controller znode"
ready=0
for _ in $(seq 1 60); do
  if shell 'zookeeper-shell.sh "$ZOOKEEPER_CONNECT" get /controller 2>/dev/null' | grep -q brokerid; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" -eq 1 ]] || { echo "controller znode did not appear" >&2; exit 1; }

echo "==> plant decoys + topics"
dexec "${PREFIX}-zk" "
mkdir -p '$DECOY_ZK'
printf '%s\n' 'Stale ZooKeeper dataDir' > '$DECOY_ZK/README.txt'
printf '%s\n' '99' > '$DECOY_ZK/myid'
test -e '$REAL_ZK/myid'
"
for b in 0 1 2; do
  dexec "${PREFIX}-$b" "
mkdir -p '$DECOY_KAFKA'
printf '%s\n' 'Previously used Kafka log directory' > '$DECOY_KAFKA/README.txt'
test -d '$REAL_LOG'
"
done

create_topic() {
  local name=$1 parts=${2:-6}
  shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic $name --partitions $parts --replication-factor 3 --config min.insync.replicas=2 --config retention.ms=604800000"
}
create_topic orders
create_topic rider.dispatch
create_topic restaurant.notifications 3

shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
shell 'printf "%s\n" "ZK=/opt/zookeeper/data logs=/opt/kafka/kafka-logs" > "$HOME/ticket/HANDOFF.md"'

fail_count=0
fail() { echo "FAIL: $*"; fail_count=$((fail_count + 1)); }
ok() { echo "ok: $*"; }

echo "==> BROKEN: decoy answers"
shell 'mkdir -p "$HOME/answers"
printf "%s\n" "1" > "$HOME/answers/zkPid"
printf "%s\n" "1" > "$HOME/answers/broker0Pid"
printf "%s\n" "1" > "$HOME/answers/broker1Pid"
printf "%s\n" "1" > "$HOME/answers/broker2Pid"
printf "%s\n" "'"$DECOY_ZK"'" > "$HOME/answers/zkDataDir"
printf "%s\n" "'"$DECOY_KAFKA"'" > "$HOME/answers/logDirs"
printf "%s\n" "1" > "$HOME/answers/controller"
printf "%s\n" "handoff" > "$HOME/answers/logDirsSource"
printf "%s\n" "kraft" > "$HOME/answers/controlPlane"'

got_log="$(shell 'tr -d "[:space:]" < "$HOME/answers/logDirs"')"
[[ "$got_log" == "$DECOY_KAFKA" ]] && ok "broken kafka path is decoy" || fail "expected decoy kafka path"
got_plane="$(shell 'tr -d "[:space:]" < "$HOME/answers/controlPlane"')"
[[ "$got_plane" == "kraft" ]] && ok "broken control plane is kraft (would fail grade)" || fail "expected kraft wrong answer"
echo "broken_scenario_ok"

echo "==> FIXED: solve from live processes"
pid_of_zk() {
  dexec "${PREFIX}-zk" "ps -eo pid,args | awk '/[q]uorumPeerMain|[o]rg\\.apache\\.zookeeper/ { print \$1; exit }'"
}
pid_of() {
  dexec "$1" "ps -eo pid,args | awk '/[k]afka\\.Kafka|[o]rg\\.apache\\.kafka|[k]afka-server-start/ { print \$1; exit }'"
}
pzk="$(pid_of_zk)"
p0="$(pid_of "${PREFIX}-0")"
p1="$(pid_of "${PREFIX}-1")"
p2="$(pid_of "${PREFIX}-2")"
[[ -n "$pzk" && -n "$p0" && -n "$p1" && -n "$p2" ]] || { echo "missing PIDs" >&2; exit 1; }

ctrl="$(shell 'zookeeper-shell.sh "$ZOOKEEPER_CONNECT" get /controller 2>/dev/null' \
  | grep -oE '"brokerid"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+' | tr -d '[:space:]')"
[[ -n "$ctrl" ]] || { echo "missing controller" >&2; exit 1; }

env_log="$(dexec "${PREFIX}-0" "tr '\\0' '\\n' < /proc/$p0/environ" | awk -F= '/^KAFKA_LOG_DIRS=/ { print $2; exit }')"
[[ "$env_log" == "$REAL_LOG" ]] || { echo "process env log dir mismatch: $env_log" >&2; exit 1; }

shell 'mkdir -p "$HOME/answers"
printf "%s\n" "'"$pzk"'" > "$HOME/answers/zkPid"
printf "%s\n" "'"$p0"'" > "$HOME/answers/broker0Pid"
printf "%s\n" "'"$p1"'" > "$HOME/answers/broker1Pid"
printf "%s\n" "'"$p2"'" > "$HOME/answers/broker2Pid"
printf "%s\n" "'"$REAL_ZK"'" > "$HOME/answers/zkDataDir"
printf "%s\n" "'"$REAL_LOG"'" > "$HOME/answers/logDirs"
printf "%s\n" "'"$ctrl"'" > "$HOME/answers/controller"
printf "%s\n" "process-env" > "$HOME/answers/logDirsSource"
printf "%s\n" "zookeeper" > "$HOME/answers/controlPlane"'

dexec "${PREFIX}-zk" "ps -eo args | grep -qiE '[q]uorumPeerMain|[o]rg\\.apache\\.zookeeper'" && ok "ZK process" || fail "no ZK"
check_pid() {
  local label=$1 want=$2 host=$3
  if dexec "$host" "ps -p $want -o args= 2>/dev/null | grep -qiE 'kafka|zookeeper|QuorumPeer|org\\.apache'"; then
    ok "$label"
  else
    fail "$label $want not live on $host"
  fi
}
check_pid "ZooKeeper PID" "$pzk" "${PREFIX}-zk"
check_pid "kafka-0 PID" "$p0" "${PREFIX}-0"
check_pid "kafka-1 PID" "$p1" "${PREFIX}-1"
check_pid "kafka-2 PID" "$p2" "${PREFIX}-2"

got_zk="$(shell 'tr -d "[:space:]" < "$HOME/answers/zkDataDir"')"
[[ "$got_zk" == "$REAL_ZK" ]] && ok "ZK dataDir" || fail "ZK dataDir got $got_zk"
got_log="$(shell 'tr -d "[:space:]" < "$HOME/answers/logDirs"')"
[[ "$got_log" == "$REAL_LOG" ]] && ok "log directory" || fail "log directory got $got_log"
got_ctrl="$(shell 'tr -d "[:space:]" < "$HOME/answers/controller"')"
[[ "$got_ctrl" == "$ctrl" ]] && ok "controller" || fail "controller got $got_ctrl"
got_src="$(shell 'tr -d "[:space:]" < "$HOME/answers/logDirsSource"')"
[[ "$got_src" == "process-env" ]] && ok "log-directory source" || fail "source got $got_src"
got_plane="$(shell 'tr -d "[:space:]" < "$HOME/answers/controlPlane"')"
[[ "$got_plane" == "zookeeper" ]] && ok "control plane" || fail "control plane got $got_plane"

for topic_parts in "orders:6" "rider.dispatch:6" "restaurant.notifications:3"; do
  topic="${topic_parts%%:*}"
  want="${topic_parts##*:}"
  got="$(shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic $topic" \
    | grep -oE 'PartitionCount:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
  [[ "$got" == "$want" ]] && ok "$topic partitions" || fail "$topic partitions got ${got:-none}"
done

[[ "$fail_count" -eq 0 ]] || { echo "GRADE_FAILED failures=$fail_count" >&2; exit 1; }
echo "PASS: Investigation matches the live ZooKeeper-era Kafka layout"
echo "SCENARIO_SIMULATABLE=yes"
echo "SIGN_OFF=kafka-01-stand-up-the-cluster-and-find-everything-on-disk (zookeeper)"
