# Shared helpers for Kafka-lab setup.sh / grade.sh. Sourced, not run.
#
# Scripts run on the backend host with controller kubectl (never inside the
# shell pod), so the learner cannot alter the grader. Kafka commands
# run in the shell pod, where BOOTSTRAP_SERVERS and PATH are set.
#
# Env from the backend: LEARNER_NS (kf-<user>), KAFKA_POD (the shell pod),
# SHELL_CONTAINER, BOOTSTRAP_SERVERS (broker DNS names), CHALLENGE_ID.
set -euo pipefail

: "${LEARNER_NS:?LEARNER_NS is required}"
KAFKA_POD="${KAFKA_POD:-shell}"
SHELL_CONTAINER="${SHELL_CONTAINER:-shell}"
: "${BOOTSTRAP_SERVERS:?BOOTSTRAP_SERVERS is required}"

# in_pod <pod> '<shell command>' — run inside that broker / ZK / shell pod.
in_pod() {
  local pod=$1
  shift
  local path="/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  if [[ "$pod" == "zookeeper" ]]; then
    path="/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/apache-zookeeper-3.9.7-bin/bin"
  fi
  kubectl -n "$LEARNER_NS" exec "$pod" -c "$pod" -- \
    env PATH="$path" \
        BOOTSTRAP_SERVERS="${BOOTSTRAP_SERVERS:-}" \
        ZOOKEEPER_CONNECT="${ZOOKEEPER_CONNECT:-}" \
        KAFKA_HEAP_OPTS="-Xms64m -Xmx64m" \
    bash -c "$1"
}

# in_shell '<shell command>' — run inside the shell container; prints its output.
in_shell() {
  in_pod "$KAFKA_POD" "$1"
}

# Emit a lab boot-stepper label. runChallengeScript watches stdout for this
# prefix and forwards it to the open-session phase UI.
boot_phase() {
  printf 'BOOT_PHASE:%s\n' "$1"
}

# shell_script <<'EOF' ... EOF — run stdin as bash inside the shell container.
shell_script() {
  kubectl -n "$LEARNER_NS" exec -i "$KAFKA_POD" -c "$SHELL_CONTAINER" -- \
    env PATH="/opt/kafka/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
        BOOTSTRAP_SERVERS="$BOOTSTRAP_SERVERS" \
        ZOOKEEPER_CONNECT="${ZOOKEEPER_CONNECT:-}" \
        KAFKA_HEAP_OPTS="-Xms64m -Xmx64m" \
    bash -s
}

# Keep going after a miss so the result can list every task, not only the first one.
_grade_failures=0
_grade_miss=0
fail() {
  echo "FAIL: $*" >&2
  echo "fail: $*"
  _grade_failures=$((_grade_failures + 1))
  _grade_miss=1
}
pass() {
  if [[ "${_grade_failures}" -gt 0 ]]; then
    exit 1
  fi
  echo "PASS: $*"
  exit 0
}
_grade_finish() {
  if [[ "${_grade_failures}" -gt 0 ]]; then
    exit 1
  fi
}
trap _grade_finish EXIT

ok() {
  if [[ "${_grade_miss}" -eq 0 ]]; then
    echo "ok: $*"
  fi
  _grade_miss=0
}

# --- shared topic helpers (QuickBite baseline) ---

# create_topic <name> [partitions=6] — RF=3, min.ISR=2, retention 7d, cleanup delete.
create_topic() {
  local name=$1 parts=${2:-6} i
  for i in $(seq 1 40); do
    if in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --create --if-not-exists --topic $name --partitions $parts --replication-factor 3 --config min.insync.replicas=2 --config retention.ms=604800000 --config cleanup.policy=delete"; then
      return 0
    fi
    sleep 2
  done
  echo "could not create $name" >&2
  return 1
}

# create_live_topics — orders (6), rider.dispatch (6), restaurant.notifications (3).
create_live_topics() {
  create_topic orders
  create_topic rider.dispatch
  create_topic restaurant.notifications 3
}

# delete_topic_if_exists <name>
delete_topic_if_exists() {
  local name=$1 gone=0
  in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --delete --topic $name" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    if ! in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic $name" >/dev/null 2>&1; then
      gone=1
      break
    fi
    sleep 1
  done
  [[ "$gone" -eq 1 ]] || { echo "$name is still present after delete" >&2; return 1; }
}

# file_value <key> — read ~/answers/<key> from the shell (MISSING if absent).
file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

# Broker stop/start via supervisor state file on that broker pod.
# Requires kraftBrokerPod wrapper (Lab 5+). State: run | stop
BROKER_STATE_FILE=/tmp/.lab-broker-wanted

stop_broker() {
  local pod=$1 i
  in_pod "$pod" "printf 'stop\\n' > '$BROKER_STATE_FILE' && command -v qb-broker >/dev/null && qb-broker stop || true"
  for i in $(seq 1 60); do
    if ! in_pod "$pod" "bash -c 'echo >/dev/tcp/127.0.0.1/9092'" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "broker $pod did not stop in time" >&2
  return 1
}

start_broker() {
  local pod=$1 i
  in_pod "$pod" "printf 'run\\n' > '$BROKER_STATE_FILE' && command -v qb-broker >/dev/null && qb-broker start || true"
  for i in $(seq 1 90); do
    if in_pod "$pod" "bash -c 'echo >/dev/tcp/127.0.0.1/9092'" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "broker $pod did not start in time" >&2
  return 1
}

# Produce one record; returns 0 on success.
produce_ok() {
  local topic=$1
  in_shell "printf 'k:v\\n' | kafka-console-producer.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --topic $topic --property parse.key=true --property key.separator=: --producer-property acks=all --producer-property request.timeout.ms=8000 --producer-property max.block.ms=8000" >/dev/null 2>&1
}

# ISR size CSV for a topic (e.g. 3,3,3,3,3,3).
topic_isr_sizes() {
  local topic=$1 line sizes="" isr n
  while IFS= read -r line; do
    [[ "$line" == *Partition:* ]] || continue
    isr="$(printf '%s' "$line" | grep -oE 'Isr:[[:space:]]*[0-9,]+' | head -1 | sed 's/Isr:[[:space:]]*//')"
    [[ -n "$isr" ]] || continue
    n="$(printf '%s' "$isr" | tr ',' '\n' | grep -cE '^[0-9]+$' || true)"
    sizes="${sizes:+$sizes,}$n"
  done < <(in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic $topic 2>/dev/null" || true)
  printf '%s' "$sizes"
}
