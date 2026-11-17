#!/usr/bin/env bash
# Kafka-03: Investigation matches the live map for ride-9917 on rider.dispatch.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

WANT_KEY=ride-9917
TOPIC=rider.dispatch

# --- live topic shape untouched ---
desc="$(in_shell "kafka-topics.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --describe --topic $TOPIC 2>/dev/null" || true)"
_grade_miss=0
if [[ -z "$desc" ]]; then
  fail "$TOPIC is missing"
else
  parts="$(printf '%s\n' "$desc" | grep -oE 'PartitionCount:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
  rf="$(printf '%s\n' "$desc" | grep -oE 'ReplicationFactor:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+')"
  [[ "$parts" == 6 && "$rf" == 3 ]] || fail "$TOPIC should still be 6 partitions / RF 3 (saw parts=$parts rf=$rf)"
  ok "$TOPIC shape"
fi

# Dump key → partition via console consumer (stable properties).
locate="$(in_shell "
set +e
kafka-console-consumer.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" \\
  --topic $TOPIC --from-beginning \\
  --property print.key=true \\
  --property print.partition=true \\
  --property print.offset=true \\
  --property print.value=false \\
  --timeout-ms 20000 2>/dev/null \\
  | grep -F '$WANT_KEY' | head -1
true
" || true)"
locate="$(printf '%s' "$locate" | tr -d '\r')"

_grade_miss=0
if [[ -z "$locate" ]]; then
  fail "could not find key $WANT_KEY in $TOPIC — produce it with acks=all first"
else
  ok "keyed record present"
fi

want_part="$(printf '%s' "$locate" | grep -oE 'Partition:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+' || true)"
if [[ -z "$want_part" ]]; then
  # Fallback: "Partition:N Offset:M key" without labels in odd builds — take first integer.
  want_part="$(printf '%s' "$locate" | grep -oE '[0-9]+' | head -1 || true)"
fi

_grade_miss=0
if [[ -z "$want_part" || ! "$want_part" =~ ^[0-9]+$ ]]; then
  fail "could not parse partition from consumer line: ${locate:-empty}"
else
  ok "parsed partition $want_part"
fi

want_leader="$(printf '%s\n' "$desc" | grep -E "Partition:[[:space:]]*${want_part}[[:space:]]" | head -1 \
  | grep -oE 'Leader:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+' || true)"
want_isr_raw="$(printf '%s\n' "$desc" | grep -E "Partition:[[:space:]]*${want_part}[[:space:]]" | head -1 \
  | grep -oE 'Isr:[[:space:]]*[0-9,]+' | head -1 | sed 's/Isr:[[:space:]]*//' || true)"
want_isr="$(printf '%s' "$want_isr_raw" | tr ',' '\n' | grep -E '^[0-9]+$' | sort -n | paste -sd, -)"

_grade_miss=0
if [[ -z "$want_leader" || -z "$want_isr" ]]; then
  fail "could not read leader/ISR for partition $want_part from describe"
else
  ok "live leader=$want_leader isr=$want_isr"
fi

# Topic names contain dots — do not split on the first ':'.
offsets="$(in_shell "kafka-get-offsets.sh --bootstrap-server \"\$BOOTSTRAP_SERVERS\" --topic $TOPIC --time -1 2>/dev/null" || true)"
end_line="$(printf '%s\n' "$offsets" | grep -E "^${TOPIC//./\\.}:${want_part}:" | head -n 1 | awk -F: '{print $NF}' | tr -d '[:space:]')"
_grade_miss=0
if [[ -z "$end_line" ]]; then
  fail "could not read log end for partition $want_part (offsets: ${offsets:-empty})"
else
  ok "live log-end=$end_line"
fi

# --- Investigation ---
src="$(file_value bootstrapSource)"
_grade_miss=0
if [[ "$src" == "env-bootstrap" ]]; then
  ok "bootstrap source"
else
  fail "bootstrap source is wrong (use \$BOOTSTRAP_SERVERS from the shell env)"
fi

got_key="$(file_value produceKey | tr -d '[:space:]')"
_grade_miss=0
if [[ "$got_key" == "$WANT_KEY" ]]; then
  ok "produce key"
else
  fail "produce key should be $WANT_KEY; got ${got_key:-missing}"
fi

got_part="$(file_value partition | tr -d '[:space:]')"
_grade_miss=0
if [[ "$got_part" == "$want_part" ]]; then
  ok "partition"
else
  fail "partition for $WANT_KEY is $want_part; Investigation says ${got_part:-missing}"
fi

got_leader="$(file_value leaderId | tr -d '[:space:]')"
_grade_miss=0
if [[ "$got_leader" == "$want_leader" ]]; then
  ok "leader"
else
  fail "leader for partition $want_part is $want_leader; Investigation says ${got_leader:-missing}"
fi

got_isr="$(file_value isr | tr -d '[:space:]')"
got_isr_sorted="$(printf '%s' "$got_isr" | tr ',' '\n' | grep -E '^[0-9]+$' | sort -n | paste -sd, -)"
_grade_miss=0
if [[ "$got_isr_sorted" == "$want_isr" ]]; then
  ok "ISR"
else
  fail "ISR for partition $want_part is $want_isr; Investigation says ${got_isr:-missing}"
fi

got_end="$(file_value logEndOffset | tr -d '[:space:]')"
_grade_miss=0
if [[ "$got_end" == "$end_line" ]]; then
  ok "log end offset"
else
  fail "log-end for partition $want_part is $end_line; Investigation says ${got_end:-missing}"
fi

pass "produce path matches the live partition map"
