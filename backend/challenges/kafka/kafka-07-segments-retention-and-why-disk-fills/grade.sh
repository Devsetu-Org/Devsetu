#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

# debug.dump gone
_grade_miss=0
if in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic debug.dump" >/dev/null 2>&1; then
  fail "debug.dump still exists — delete it"
else
  ok "debug.dump gone"
fi

# order.status finite retention
cfg="$(in_shell "kafka-configs.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --entity-type topics --entity-name order.status --all 2>/dev/null" || true)"
_grade_miss=0
[[ -n "$cfg" ]] || fail "order.status is missing"
ret="$(printf '%s\n' "$cfg" | grep -oE 'retention\.ms=[-0-9]+' | head -1 | cut -d= -f2)"
if [[ "$ret" == "-1" || -z "$ret" ]]; then
  fail "order.status retention.ms is still keep-forever (${ret:-missing})"
fi
# Accept 7d platform default
if [[ "$ret" == "604800000" ]] || [[ "$ret" -gt 0 ]]; then
  ok "order.status finite retention ($ret)"
else
  fail "order.status retention.ms looks wrong: $ret"
fi

# rider.dispatch untouched
rd="$(in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic rider.dispatch 2>/dev/null" || true)"
parts="$(printf '%s\n' "$rd" | grep -oE 'PartitionCount:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
rf="$(printf '%s\n' "$rd" | grep -oE 'ReplicationFactor:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
_grade_miss=0
[[ "$parts" == 6 && "$rf" == 3 ]] || fail "rider.dispatch was changed"
ok "rider.dispatch unchanged"

for pod in kafka-0 kafka-1 kafka-2; do
  _grade_miss=0
  if in_pod "$pod" "bash -c 'echo >/dev/tcp/127.0.0.1/9092'"; then
    ok "$pod up"
  else
    fail "$pod not accepting clients"
  fi
done

# Disk not critically full on kafka-1 (best-effort <90%)
usage="$(in_pod kafka-1 "df -P /var/lib/kafka/data | awk 'NR==2{gsub(/%/,\"\",\$5); print \$5}'" | tr -d '[:space:]')"
_grade_miss=0
if [[ "$usage" =~ ^[0-9]+$ ]] && [[ "$usage" -lt 90 ]]; then
  ok "kafka-1 disk usage ${usage}%"
else
  fail "kafka-1 disk still too full (usage=${usage:-unknown}%)"
fi

policy="$(file_value cleanupLesson)"
_grade_miss=0
[[ "$policy" == "delete-vs-compact" ]] || fail "Investigation: cleanup lesson choice is wrong"
ok "cleanup lesson"

pass "disk freed the platform way; hot path untouched"
