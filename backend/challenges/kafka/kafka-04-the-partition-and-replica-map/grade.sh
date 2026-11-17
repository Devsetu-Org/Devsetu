#!/usr/bin/env bash
# Kafka-04: Investigation matches live rider.dispatch map + durability predictions.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

TOPIC=rider.dispatch

desc="$(in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic $TOPIC 2>/dev/null" || true)"
cfg="$(in_shell "kafka-configs.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --entity-type topics --entity-name $TOPIC --all 2>/dev/null" || true)"

_grade_miss=0
[[ -n "$desc" ]] || fail "$TOPIC is missing"
parts="$(printf '%s\n' "$desc" | grep -oE 'PartitionCount:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
rf="$(printf '%s\n' "$desc" | grep -oE 'ReplicationFactor:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
[[ "$parts" == 6 && "$rf" == 3 ]] || fail "$TOPIC should be 6 / RF 3 (saw parts=$parts rf=$rf)"
ok "$TOPIC shape"

# Partition 0 map
p0="$(printf '%s\n' "$desc" | grep -E 'Partition:[[:space:]]*0[[:space:]]' | head -1)"
want_leader="$(printf '%s' "$p0" | grep -oE 'Leader:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
want_replicas="$(printf '%s' "$p0" | grep -oE 'Replicas:[[:space:]]*[0-9,]+' | head -1 | sed 's/Replicas:[[:space:]]*//')"
want_preferred="$(printf '%s' "$want_replicas" | cut -d, -f1 | tr -d '[:space:]')"
want_isr="$(printf '%s' "$p0" | grep -oE 'Isr:[[:space:]]*[0-9,]+' | head -1 | sed 's/Isr:[[:space:]]*//' \
  | tr ',' '\n' | grep -E '^[0-9]+$' | sort -n | paste -sd, -)"

want_minisr="$(printf '%s\n' "$cfg" | grep -oE 'min\.insync\.replicas=[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
# Default false when unset
want_unclean=false
if printf '%s\n' "$cfg" | grep -qE 'unclean\.leader\.election\.enable=true'; then
  want_unclean=true
fi

[[ -n "$want_leader" && -n "$want_preferred" && -n "$want_isr" && -n "$want_minisr" ]] || {
  echo "grader could not read partition-0 map" >&2
  exit 1
}

# Cluster must still be healthy (no broker stopped).
for pod in kafka-0 kafka-1 kafka-2; do
  _grade_miss=0
  if in_pod "$pod" "bash -c 'echo >/dev/tcp/127.0.0.1/9092'"; then
    ok "$pod accepting clients"
  else
    fail "$pod is not accepting clients — this lab is a worksheet; do not stop brokers"
  fi
done

check_eq() {
  local label=$1 want=$2 got=$3
  _grade_miss=0
  got="$(printf '%s' "$got" | tr -d '[:space:]')"
  if [[ "$got" == "$want" ]]; then
    ok "$label"
  else
    fail "$label should be $want; Investigation says ${got:-missing}"
  fi
}

check_eq "partitions" "6" "$(file_value partitions)"
check_eq "RF" "3" "$(file_value rf)"
check_eq "min.ISR" "$want_minisr" "$(file_value minIsr)"
check_eq "partition-0 leader" "$want_leader" "$(file_value p0Leader)"
check_eq "partition-0 preferred" "$want_preferred" "$(file_value p0Preferred)"

got_isr="$(file_value p0Isr | tr -d '[:space:]')"
got_isr_sorted="$(printf '%s' "$got_isr" | tr ',' '\n' | grep -E '^[0-9]+$' | sort -n | paste -sd, -)"
check_eq "partition-0 ISR" "$want_isr" "$got_isr_sorted"

unclean="$(file_value uncleanElection)"
_grade_miss=0
if [[ "$unclean" == "false" && "$want_unclean" == "false" ]]; then
  ok "unclean election"
elif [[ "$unclean" == "$want_unclean" ]]; then
  ok "unclean election"
else
  fail "unclean.leader.election.enable should be false on this lab"
fi

# Predictions
pred_a="$(file_value predictRf3Min2)"
pred_b="$(file_value predictRf3Min3)"
pred_c="$(file_value predictRf2Min2)"
_grade_miss=0
[[ "$pred_a" == "still-ok" ]] || fail "RF3/minISR2 with one broker down: produces should still succeed"
ok "prediction A"
_grade_miss=0
[[ "$pred_b" == "produces-fail" ]] || fail "RF3/minISR3 with one broker down: produces should fail"
ok "prediction B"
_grade_miss=0
[[ "$pred_c" == "produces-fail" ]] || fail "RF2/minISR2 with one broker down: produces should fail"
ok "prediction C"

pass "replica map and durability predictions match"
