#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

_grade_miss=0
if in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic debug.dump" >/dev/null 2>&1; then
  fail "debug.dump still exists"
else
  ok "debug.dump gone"
fi

for pod in kafka-0 kafka-1 kafka-2; do
  _grade_miss=0
  if in_pod "$pod" "bash -c 'echo >/dev/tcp/127.0.0.1/9092'"; then
    ok "$pod up"
  else
    fail "$pod down"
  fi
done

_grade_miss=0
if produce_ok rider.dispatch; then
  ok "produce ok"
else
  fail "produce to rider.dispatch still failing"
fi

cfg="$(in_shell "kafka-configs.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --entity-type topics --entity-name rider.dispatch --all 2>/dev/null" || true)"
minisr="$(printf '%s\n' "$cfg" | grep -oE 'min\.insync\.replicas=[0-9]+' | head -1 | grep -oE '[0-9]+')"
_grade_miss=0
[[ "$minisr" == 2 ]] || fail "min.ISR should still be 2"
ok "min.ISR"

_grade_miss=0
if printf '%s\n' "$cfg" | grep -qE 'unclean\.leader\.election\.enable=true'; then
  fail "unclean election must stay off"
else
  ok "unclean off"
fi

# Lag for dispatch-desk
lag_out="$(in_shell "kafka-consumer-groups.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --group dispatch-desk 2>/dev/null" || true)"
# Sum LAG column if present
lag_sum="$(printf '%s\n' "$lag_out" | awk 'NR>1 && $5 ~ /^[0-9]+$/ { s+=$5 } END { print s+0 }')"
# Some CLI versions put LAG elsewhere — also try last numeric field
if [[ -z "$lag_sum" || "$lag_sum" == "0" ]]; then
  lag_sum="$(printf '%s\n' "$lag_out" | awk '/rider.dispatch/ { for(i=1;i<=NF;i++) if($i+0==$i) lag=$i } END { print lag+0 }')"
fi
_grade_miss=0
if [[ "$lag_sum" =~ ^[0-9]+$ ]] && [[ "$lag_sum" -le 2 ]]; then
  ok "dispatch-desk lag=$lag_sum"
else
  fail "dispatch-desk lag should be drained by reading (lag=${lag_sum:-unknown})"
fi

fix="$(file_value howFixed)"
_grade_miss=0
[[ "$fix" == "free-disk-read-forward" ]] || fail "Investigation: fix path is wrong"
ok "how fixed"

refuse="$(file_value refusedShortcut)"
_grade_miss=0
[[ "$refuse" == "no-reset-latest" ]] || fail "Investigation: you should have refused reset-to-latest"
ok "refused shortcut"

pass "capstone: disk freed, writes work, lag drained without shortcuts"
