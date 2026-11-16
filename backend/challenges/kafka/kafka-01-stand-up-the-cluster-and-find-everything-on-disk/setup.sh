#!/usr/bin/env bash
# Kafka-01 (ZooKeeper era): ZK + 3 brokers already up. Plant live topics, decoy
# paths on ZK and brokers, and a wrong handoff. Learner finds processes + paths
# + controller via /controller znode.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BROKERS=(kafka-0 kafka-1 kafka-2)
DECOY_KAFKA=/opt/kafka/kafka-logs
DECOY_ZK=/opt/zookeeper/data
REAL_LOG_DIR=/var/lib/kafka/data
REAL_ZK_DATA=/data

boot_phase "Preparing the lab"

: "${ZOOKEEPER_CONNECT:?ZOOKEEPER_CONNECT is required for kafka-zk-3}"

create_topic() {
  local name=$1 parts=${2:-6} i
  for i in $(seq 1 40); do
    if in_shell "kafka-topics.sh --bootstrap-server \$BOOTSTRAP_SERVERS --create --if-not-exists --topic $name --partitions $parts --replication-factor 3 --config min.insync.replicas=2 --config retention.ms=604800000"; then
      return 0
    fi
    sleep 2
  done
  echo "could not create $name" >&2
  return 1
}

plant_kafka_decoy() {
  local pod=$1
  in_pod "$pod" "
set -euo pipefail
mkdir -p '$DECOY_KAFKA'
printf '%s\n' \
  'Previously used Kafka log directory (pre-migration).' \
  'Do not write here. The current log.dirs path is on the live broker process.' \
  > '$DECOY_KAFKA/README.txt'
printf '%s\n' 'version=1' 'broker.id=99' > '$DECOY_KAFKA/meta.properties'
chmod 644 '$DECOY_KAFKA/README.txt' '$DECOY_KAFKA/meta.properties'
"
}

plant_zk_decoy() {
  in_pod zookeeper "
set -euo pipefail
mkdir -p '$DECOY_ZK'
printf '%s\n' \
  'Stale ZooKeeper dataDir from an old host image.' \
  'The live ensemble does not use this path.' \
  > '$DECOY_ZK/README.txt'
printf '%s\n' '99' > '$DECOY_ZK/myid'
chmod 644 '$DECOY_ZK/README.txt' '$DECOY_ZK/myid'
"
}

echo "==> plant decoys"
plant_zk_decoy || { echo "could not plant ZK decoy" >&2; exit 1; }
in_pod zookeeper "test -d '$REAL_ZK_DATA'" \
  || { echo "zookeeper missing $REAL_ZK_DATA" >&2; exit 1; }

for pod in "${BROKERS[@]}"; do
  plant_kafka_decoy "$pod" || { echo "could not plant decoy on $pod" >&2; exit 1; }
  in_pod "$pod" "test -d '$REAL_LOG_DIR'" \
    || { echo "$pod missing $REAL_LOG_DIR" >&2; exit 1; }
done

create_topic orders
create_topic rider.dispatch
create_topic restaurant.notifications 3

in_shell 'mkdir -p "$HOME/ticket" "$HOME/answers" && rm -f "$HOME/answers"/*'
in_shell "
cat > \"\$HOME/ticket/HANDOFF.md\" <<'EOF'
# Handoff — Kafka POC (ZooKeeper era)

- ZooKeeper dataDir: \`/opt/zookeeper/data\`
- Broker log.dirs: \`/opt/kafka/kafka-logs\`

Topics already live: orders, rider.dispatch, restaurant.notifications.
Leave them alone unless a ticket says otherwise.

(Later we move this cluster to KRaft. For this shift, ZooKeeper is still the control plane.)
EOF
"

ok "ZK + brokers up; live topics planted; decoys + handoff ready"
