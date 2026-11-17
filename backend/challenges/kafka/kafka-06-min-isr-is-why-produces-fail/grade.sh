#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

TOPIC=desk.alerts

for pod in kafka-0 kafka-1 kafka-2; do
  _grade_miss=0
  if in_pod "$pod" "bash -c 'echo >/dev/tcp/127.0.0.1/9092'"; then
    ok "$pod up"
  else
    fail "$pod is down"
  fi
done

desc="$(in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic $TOPIC 2>/dev/null" || true)"
_grade_miss=0
[[ -n "$desc" ]] || fail "$TOPIC is missing"
rf="$(printf '%s\n' "$desc" | grep -oE 'ReplicationFactor:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
[[ "$rf" == 3 ]] || fail "$TOPIC RF should be 3 (saw ${rf:-none})"
ok "RF=3"

cfg="$(in_shell "kafka-configs.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --entity-type topics --entity-name $TOPIC --all 2>/dev/null" || true)"
minisr="$(printf '%s\n' "$cfg" | grep -oE 'min\.insync\.replicas=[0-9]+' | head -1 | grep -oE '[0-9]+')"
_grade_miss=0
[[ "$minisr" == 2 ]] || fail "min.insync.replicas must be 2 (not 1); saw ${minisr:-none}"
ok "min.ISR=2"

isr="$(topic_isr_sizes "$TOPIC")"
_grade_miss=0
[[ "$isr" == "3,3,3" ]] || fail "every partition needs ISR size 3; got ${isr:-none}"
ok "full ISR"

_grade_miss=0
if produce_ok "$TOPIC"; then
  ok "produce succeeds"
else
  fail "produce to $TOPIC still fails"
fi

_grade_miss=0
if printf '%s\n' "$cfg" | grep -qE 'unclean\.leader\.election\.enable=true'; then
  fail "unclean election must stay off"
else
  ok "unclean off"
fi

fix="$(file_value howFixed)"
_grade_miss=0
[[ "$fix" == "restore-rf-and-broker" ]] || fail "Investigation: fix path is wrong"
ok "how fixed"

refuse="$(file_value refusedShortcut)"
_grade_miss=0
[[ "$refuse" == "left-minisr" ]] || fail "Investigation: you should have refused min.ISR=1"
ok "refused shortcut"

pass "durability restored without dropping min.ISR"
