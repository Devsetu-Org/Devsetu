#!/usr/bin/env bash
# Healthy kafka-3. orders, rider.dispatch, and restaurant.notifications are
# in service. order.status is absent.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

create_topic() {
  local name=$1 parts=${2:-6} i
  for i in $(seq 1 30); do
    if in_shell "kafka-topics.sh --bootstrap-server $BOOTSTRAP_SERVERS --create --if-not-exists --topic $name --partitions $parts --replication-factor 3 --config min.insync.replicas=2"; then
      return 0
    fi
    sleep 2
  done
  echo "could not create $name" >&2
  return 1
}

# Quorum can answer the client port before the first topic create succeeds.
create_topic orders
create_topic rider.dispatch
create_topic restaurant.notifications 3

# A reset must not leave the learner's previous order.status topic in place.
in_shell "kafka-topics.sh --bootstrap-server $BOOTSTRAP_SERVERS --delete --topic order.status" >/dev/null 2>&1 || true
gone=0
for _ in $(seq 1 20); do
  if ! in_shell "kafka-topics.sh --bootstrap-server $BOOTSTRAP_SERVERS --describe --topic order.status" >/dev/null 2>&1; then
    gone=1
    break
  fi
  sleep 1
done
[[ "$gone" -eq 1 ]] || { echo "order.status is still present after setup" >&2; exit 1; }

ok "orders, rider.dispatch, and restaurant.notifications are ready"
