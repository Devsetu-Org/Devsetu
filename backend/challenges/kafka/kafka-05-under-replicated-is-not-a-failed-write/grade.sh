#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

TOPIC=rider.dispatch

for pod in kafka-0 kafka-1 kafka-2; do
  _grade_miss=0
  if in_pod "$pod" "bash -c 'echo >/dev/tcp/127.0.0.1/9092'"; then
    ok "$pod up"
  else
    fail "$pod is still down — qb-broker start on that host"
  fi
done

_grade_miss=0
if produce_ok "$TOPIC"; then
  ok "produce succeeds"
else
  fail "produce to $TOPIC failed"
fi

isr="$(topic_isr_sizes "$TOPIC")"
_grade_miss=0
if [[ "$isr" == "3,3,3,3,3,3" ]]; then
  ok "full ISR"
else
  fail "every $TOPIC partition needs ISR size 3; got ${isr:-none}"
fi

cfg="$(in_shell "kafka-configs.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --entity-type topics --entity-name $TOPIC --all 2>/dev/null" || true)"
minisr="$(printf '%s\n' "$cfg" | grep -oE 'min\.insync\.replicas=[0-9]+' | head -1 | grep -oE '[0-9]+')"
_grade_miss=0
[[ "$minisr" == 2 ]] || fail "min.insync.replicas should still be 2 (saw ${minisr:-none})"
ok "min.ISR intact"

_grade_miss=0
if printf '%s\n' "$cfg" | grep -qE 'unclean\.leader\.election\.enable=true'; then
  fail "unclean.leader.election.enable must stay off"
else
  ok "unclean election off"
fi

fix="$(file_value howFixed)"
_grade_miss=0
[[ "$fix" == "start-broker-wait-isr" ]] || fail "Investigation: how you fixed it is wrong"
ok "how fixed"

refuse="$(file_value refusedShortcut)"
_grade_miss=0
[[ "$refuse" == "left-minisr" ]] || fail "Investigation: you should have left min.ISR alone"
ok "refused shortcut"

pass "URP cleared by restoring the broker; durability untouched"
