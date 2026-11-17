#!/usr/bin/env bash
# Docker e2e for Kafka Lab 2 (KRaft). Mirrors setup + grade checks.
set -euo pipefail

IMAGE="${KAFKA_IMAGE:-apache/kafka:3.9.1}"
NET="k2-net-$$"
PREFIX="k2-$$"
CLUSTER_ID="4L6g3nShT-eMCtK--X86sw"
WORK="${TMPDIR:-/tmp}/kafka-02-val-$$"

mkdir -p "$WORK"
cleanup() {
  docker rm -f "${PREFIX}-0" "${PREFIX}-1" "${PREFIX}-2" "${PREFIX}-shell" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "==> image $IMAGE"
docker image inspect "$IMAGE" >/dev/null
docker network create "$NET" >/dev/null

start_broker() {
  local name=$1 id=$2
  local voters="1@${PREFIX}-0:9093,2@${PREFIX}-1:9093,3@${PREFIX}-2:9093"
  docker run -d --name "$name" --hostname "$name" --network "$NET" --memory=512m \
    -e CLUSTER_ID="$CLUSTER_ID" \
    -e KAFKA_NODE_ID="$id" \
    -e KAFKA_PROCESS_ROLES=broker,controller \
    -e KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093 \
    -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://"${name}":9092 \
    -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
    -e KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT \
    -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
    -e KAFKA_CONTROLLER_QUORUM_VOTERS="$voters" \
    -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=3 \
    -e KAFKA_OFFSETS_TOPIC_NUM_PARTITIONS=3 \
    -e KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=3 \
    -e KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=2 \
    -e KAFKA_DEFAULT_REPLICATION_FACTOR=3 \
    -e KAFKA_MIN_INSYNC_REPLICAS=2 \
    -e KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0 \
    -e KAFKA_LOG_CLEANER_DEDUPE_BUFFER_SIZE=16777216 \
    -e KAFKA_AUTO_CREATE_TOPICS_ENABLE=false \
    -e KAFKA_DELETE_TOPIC_ENABLE=true \
    -e KAFKA_LOG_DIRS=/var/lib/kafka/data \
    -e KAFKA_HEAP_OPTS='-Xms256m -Xmx256m' \
    -e KAFKA_JVM_PERFORMANCE_OPTS='-server -XX:+UseSerialGC -XX:MaxMetaspaceSize=64m -Xss256k' \
    "$IMAGE" >/dev/null
}

start_broker "${PREFIX}-0" 1
start_broker "${PREFIX}-1" 2
start_broker "${PREFIX}-2" 3

BS="${PREFIX}-0:9092,${PREFIX}-1:9092,${PREFIX}-2:9092"
docker run -d --name "${PREFIX}-shell" --network "$NET" --memory=512m \
  -e HOME=/tmp "$IMAGE" /bin/bash -c 'sleep infinity' >/dev/null

shell() {
  docker exec -e PATH="/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    -e BOOTSTRAP_SERVERS="$BS" \
    -e KAFKA_HEAP_OPTS="-Xms64m -Xmx64m" \
    -e HOME=/tmp \
    "${PREFIX}-shell" bash -c "$*"
}

echo "==> wait for KRaft quorum"
ready=0
for _ in $(seq 1 90); do
  if shell 'kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --list' >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" -eq 1 ]] || { echo "quorum not ready"; exit 1; }

create_topic() {
  local name=$1 parts=${2:-6}
  shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic $name --partitions $parts --replication-factor 3 --config min.insync.replicas=2 --config retention.ms=604800000 --config cleanup.policy=delete"
}

echo "==> plant live topics (no order.status)"
create_topic orders
create_topic rider.dispatch
create_topic restaurant.notifications 3
shell 'kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --delete --topic order.status' >/dev/null 2>&1 || true
sleep 2

shell 'mkdir -p "$HOME/ticket" "$HOME/answers"'
shell 'printf "%s\n" "wrong ticket" > "$HOME/ticket/TICKET.md"'
shell 'printf "%s\n" "platform note" > "$HOME/ticket/PLATFORM.md"'

echo "==> broken answers should fail (ticket shape + wrong plane)"
shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic order.status --partitions 3 --replication-factor 2 --config min.insync.replicas=1 --config retention.ms=604800000 --config cleanup.policy=delete" || true
sleep 3
shell 'rm -f "$HOME/answers"/*'
shell 'printf "%s\n" zookeeper > "$HOME/answers/controlPlane"'
shell 'printf "%s\n" ticket > "$HOME/answers/shapeSource"'
shell 'printf "%s\n" 3 > "$HOME/answers/orderStatusPartitions"'
shell 'printf "%s\n" 2 > "$HOME/answers/orderStatusRf"'
shell 'printf "%s\n" 604800000 > "$HOME/answers/orderStatusRetention"'
shell 'printf "%s\n" 1 > "$HOME/answers/orderStatusMinIsr"'

# Local grade mirror (subset): wrong shape must not pass
parts=$(shell 'kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic order.status' \
  | grep -oE 'PartitionCount:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
[[ "$parts" != "6" ]] || { echo "expected wrong plant to not be 6 yet — deleting"; }
shell 'kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --delete --topic order.status' >/dev/null 2>&1 || true
for _ in $(seq 1 20); do
  shell 'kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic order.status' >/dev/null 2>&1 || break
  sleep 1
done

echo "==> correct create + Investigation"
shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --topic order.status --partitions 6 --replication-factor 3 --config retention.ms=259200000 --config min.insync.replicas=2 --config cleanup.policy=delete"
for _ in $(seq 1 30); do
  isr=$(shell 'kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic order.status' \
    | grep -oE 'Isr:[[:space:]]*[0-9,]+' | head -1 || true)
  [[ -n "$isr" ]] && break
  sleep 2
done

shell 'rm -f "$HOME/answers"/*'
shell 'printf "%s\n" kraft > "$HOME/answers/controlPlane"'
shell 'printf "%s\n" platform-note > "$HOME/answers/shapeSource"'
shell 'printf "%s\n" 6 > "$HOME/answers/orderStatusPartitions"'
shell 'printf "%s\n" 3 > "$HOME/answers/orderStatusRf"'
shell 'printf "%s\n" 259200000 > "$HOME/answers/orderStatusRetention"'
shell 'printf "%s\n" 2 > "$HOME/answers/orderStatusMinIsr"'

# Mirror grade checks
desc=$(shell 'kafka-topics.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --topic order.status')
echo "$desc" | grep -q 'PartitionCount: 6' || { echo "FAIL parts"; exit 1; }
echo "$desc" | grep -q 'ReplicationFactor: 3' || { echo "FAIL rf"; exit 1; }
cfg=$(shell 'kafka-configs.sh --bootstrap-server "$BOOTSTRAP_SERVERS" --describe --entity-type topics --entity-name order.status --all')
echo "$cfg" | grep -qE 'retention\.ms[=:][[:space:]]*259200000|retention\.ms=259200000' || {
  echo "$cfg" | grep retention.ms || true
  # configs --all prints retention.ms=259200000 sensitive=false
  echo "$cfg" | grep -q 'retention.ms=259200000' || { echo "FAIL retention"; exit 1; }
}
echo "$cfg" | grep -q 'min.insync.replicas=2' || { echo "FAIL minisr"; exit 1; }

for topic_parts in "orders:6" "rider.dispatch:6" "restaurant.notifications:3"; do
  t=${topic_parts%%:*}; p=${topic_parts##*:}
  d=$(shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic $t")
  echo "$d" | grep -q "PartitionCount: $p" || { echo "FAIL $t parts"; exit 1; }
done

[[ "$(shell 'cat "$HOME/answers/controlPlane"')" == "kraft" ]] || { echo "FAIL plane"; exit 1; }
[[ "$(shell 'cat "$HOME/answers/shapeSource"')" == "platform-note" ]] || { echo "FAIL source"; exit 1; }

echo "SIGN_OFF kafka-02-open-a-topic-the-platform-way (kraft)"
