#!/usr/bin/env bash
# Healthy kafka-3. orders, rider.dispatch, and restaurant.notifications are
# in service. A few assignments are already on rider.dispatch partition 3,
# so its log end is not zero. scratch is a leftover topic to delete.
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

create_topic orders
create_topic rider.dispatch
create_topic restaurant.notifications 3

# A new producer sticks to one partition, so a short batch can miss partition 3.
# Round-robin across six records puts one assignment on every partition.
produced=0
for _ in $(seq 1 15); do
  if in_shell "printf '%s\n' order-1 order-2 order-3 order-4 order-5 order-6 | kafka-console-producer.sh --bootstrap-server $BOOTSTRAP_SERVERS --topic rider.dispatch --producer-property partitioner.class=org.apache.kafka.clients.producer.RoundRobinPartitioner"; then
    produced=1
    break
  fi
  sleep 2
done
[[ "$produced" -eq 1 ]] || { echo "could not write rider.dispatch partition 3" >&2; exit 1; }

end=""
for _ in $(seq 1 15); do
  end="$(in_shell "kafka-get-offsets.sh --bootstrap-server $BOOTSTRAP_SERVERS --topic rider.dispatch --partitions 3 --time -1" | awk -F: 'NF { print $NF; exit }')"
  [[ -n "$end" && "$end" != 0 ]] && break
  sleep 1
done
[[ -n "$end" && "$end" != 0 ]] || {
  echo "rider.dispatch partition 3 is still empty after setup" >&2
  in_shell "kafka-get-offsets.sh --bootstrap-server $BOOTSTRAP_SERVERS --topic rider.dispatch --time -1" >&2 || true
  exit 1
}

in_shell "kafka-topics.sh --bootstrap-server $BOOTSTRAP_SERVERS --create --if-not-exists --topic scratch --partitions 1 --replication-factor 1" \
  || { echo "could not create scratch" >&2; exit 1; }

# Fresh pod, but a re-run of setup on the same shell must not keep old answers.
in_shell 'mkdir -p "$HOME/answers" && rm -f "$HOME/answers/controller" "$HOME/answers/rider-dispatch-3-leader" "$HOME/answers/rider-dispatch-3-end"'

ok "orders, rider.dispatch, restaurant.notifications, and scratch are ready"
