#!/usr/bin/env bash
# Kafka-01 (ZooKeeper): Investigation matches live ZK + broker processes, real
# dataDir / log.dirs, and controller from /controller — not KRaft quorum tools.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BROKERS=(kafka-0 kafka-1 kafka-2)
WANT_LOG_DIR=/var/lib/kafka/data
WANT_ZK_DATA=/data
DECOY_KAFKA=/opt/kafka/kafka-logs
DECOY_ZK=/opt/zookeeper/data

normalize_path() {
  local p=$1
  p="${p#"${p%%[![:space:]]*}"}"
  p="${p%"${p##*[![:space:]]}"}"
  p="${p%/}"
  printf '%s' "$p"
}

paths_equal() {
  local a b
  a="$(normalize_path "$1" | tr '[:upper:]' '[:lower:]')"
  b="$(normalize_path "$2" | tr '[:upper:]' '[:lower:]')"
  [[ -n "$a" && "$a" == "$b" ]]
}

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

check_process_pid() {
  local label=$1 got=$2 pod=$3 pattern=$4
  local pid
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
    return
  fi
  pid="$(printf '%s' "$got" | tr -d '[:space:]')"
  if ! [[ "$pid" =~ ^[0-9]+$ ]]; then
    fail "$label should be a numeric PID (got: $got)"
    return
  fi
  if in_pod "$pod" "ps -p $pid -o args= 2>/dev/null | grep -qiE '$pattern'"; then
    ok "$label"
  else
    fail "$label $pid is not the expected live process on $pod"
  fi
}

: "${ZOOKEEPER_CONNECT:?ZOOKEEPER_CONNECT is required}"

# --- live cluster ---
_grade_miss=0
if in_pod zookeeper "ps -eo args | grep -qiE '[q]uorumPeerMain|[o]rg\\.apache\\.zookeeper|[z]ookeeper'"; then
  ok "ZooKeeper process on zookeeper"
else
  fail "ZooKeeper process is not running on zookeeper"
fi

_grade_miss=0
if in_pod zookeeper "test -d $WANT_ZK_DATA && test -e $WANT_ZK_DATA/myid"; then
  ok "zookeeper has dataDir $WANT_ZK_DATA"
else
  fail "zookeeper is missing live dataDir $WANT_ZK_DATA"
fi

_grade_miss=0
if in_pod zookeeper "test -d $DECOY_ZK"; then
  ok "zookeeper still has the decoy dataDir"
else
  fail "zookeeper decoy was removed — leave the decoy; find the real path"
fi

for pod in "${BROKERS[@]}"; do
  _grade_miss=0
  if in_pod "$pod" "ps -eo args | grep -qiE '[k]afka\\.Kafka|[o]rg\\.apache\\.kafka|[k]afka-server-start'"; then
    ok "Kafka process on $pod"
  else
    fail "Kafka process is not running on $pod"
  fi
  _grade_miss=0
  if in_pod "$pod" "test -d $WANT_LOG_DIR"; then
    ok "$pod has log dir $WANT_LOG_DIR"
  else
    fail "$pod is missing $WANT_LOG_DIR"
  fi
  _grade_miss=0
  if in_pod "$pod" "test -d $DECOY_KAFKA"; then
    ok "$pod still has the decoy log directory"
  else
    fail "$pod decoy was removed — leave the decoy; find the real path"
  fi
done

# Controller from ZooKeeper /controller (not kafka-metadata-quorum).
want_controller="$(in_shell "
zookeeper-shell.sh \"\$ZOOKEEPER_CONNECT\" get /controller 2>/dev/null \
  | grep -oE '\"brokerid\"[[:space:]]*:[[:space:]]*[0-9]+' \
  | head -1 | grep -oE '[0-9]+'
" | tr -d '[:space:]')"
[[ -n "$want_controller" ]] || { echo "grader could not read /controller from ZooKeeper" >&2; exit 1; }

# Live topics untouched.
for topic_parts in "orders:6" "rider.dispatch:6" "restaurant.notifications:3"; do
  topic="${topic_parts%%:*}"
  want_parts="${topic_parts##*:}"
  _grade_miss=0
  got_parts="$(in_shell "kafka-topics.sh --bootstrap-server \$BOOTSTRAP_SERVERS --describe --topic $topic 2>/dev/null" \
    | grep -oE 'PartitionCount:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+' | tr -d '[:space:]')"
  if [[ "$got_parts" == "$want_parts" ]]; then
    ok "$topic still has $want_parts partitions"
  else
    fail "$topic should still have $want_parts partitions (saw ${got_parts:-none})"
  fi
done

# --- Investigation ---
check_process_pid "ZooKeeper PID" "$(file_value zkPid)" zookeeper 'zookeeper|QuorumPeer'
check_process_pid "kafka-0 PID" "$(file_value broker0Pid)" kafka-0 'kafka|org\\.apache\\.kafka'
check_process_pid "kafka-1 PID" "$(file_value broker1Pid)" kafka-1 'kafka|org\\.apache\\.kafka'
check_process_pid "kafka-2 PID" "$(file_value broker2Pid)" kafka-2 'kafka|org\\.apache\\.kafka'

got_zk="$(file_value zkDataDir)"
_grade_miss=0
if [[ "$got_zk" == MISSING || -z "$got_zk" ]]; then
  fail "ZooKeeper dataDir is missing"
elif paths_equal "$got_zk" "$DECOY_ZK"; then
  fail "ZooKeeper dataDir is the decoy/handoff path; find the live dataDir"
elif paths_equal "$got_zk" "$WANT_ZK_DATA"; then
  ok "ZooKeeper dataDir"
else
  fail "ZooKeeper dataDir is $WANT_ZK_DATA; the Investigation says $got_zk"
fi

got_log="$(file_value logDirs)"
_grade_miss=0
if [[ "$got_log" == MISSING || -z "$got_log" ]]; then
  fail "Kafka log directory is missing"
elif paths_equal "$got_log" "$DECOY_KAFKA"; then
  fail "Kafka log directory is the decoy/handoff path; find the path the live process uses"
elif paths_equal "$got_log" "$WANT_LOG_DIR"; then
  ok "Kafka log directory"
else
  fail "Kafka log directory is $WANT_LOG_DIR; the Investigation says $got_log"
fi

got_ctrl="$(file_value controller | tr -d '[:space:]')"
_grade_miss=0
if [[ "$got_ctrl" == MISSING || -z "$got_ctrl" ]]; then
  fail "controller is missing"
elif [[ "$got_ctrl" == "$want_controller" ]]; then
  ok "controller"
else
  fail "controller is $want_controller; the Investigation says $got_ctrl"
fi

log_source="$(file_value logDirsSource)"
_grade_miss=0
if [[ "$log_source" == MISSING || -z "$log_source" ]]; then
  fail "log-directory source choice is missing"
elif [[ "$log_source" == "process-env" ]]; then
  ok "log-directory source"
else
  fail "log-directory source is wrong (expected the live process environment)"
fi

plane="$(file_value controlPlane)"
_grade_miss=0
if [[ "$plane" == MISSING || -z "$plane" ]]; then
  fail "control-plane choice is missing"
elif [[ "$plane" == "zookeeper" ]]; then
  ok "control plane"
else
  fail "control-plane is wrong (this lab is ZooKeeper; KRaft starts in Lab 2)"
fi

pass "Investigation matches the live ZooKeeper-era Kafka layout"
