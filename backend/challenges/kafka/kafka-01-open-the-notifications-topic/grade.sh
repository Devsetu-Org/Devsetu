#!/usr/bin/env bash
# alerts: 6 partitions, RF 3, retention.ms 259200000, min.insync.replicas 2,
# cleanup.policy delete, ISR 3 on every partition. trips and matches stay as setup left them.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

report="$(shell_script <<'EOF'
set -u
bs="${BOOTSTRAP_SERVERS:?BOOTSTRAP_SERVERS is required}"

cfg_value() {
  # First assignment on the matching config line is the effective value.
  # Dots in the key are literal (retention.ms, min.insync.replicas).
  awk -v key="$1" '
    BEGIN { k = key; gsub(/\./, "\\.", k); k = "^" k "=" }
    $1 ~ k { split($1, a, "="); print a[2]; exit }
  ' <<<"$2"
}

dump() {
  local topic=$1 desc cfg parts rf retention minisr cleanup isr
  local attempt
  for attempt in $(seq 1 15); do
    if ! desc=$(kafka-topics.sh --bootstrap-server "$bs" --describe --topic "$topic" 2>/dev/null); then
      if [[ "$attempt" -eq 3 ]]; then
        echo "MISSING $topic"
        return
      fi
      sleep 2
      continue
    fi
    cfg=$(kafka-configs.sh --bootstrap-server "$bs" --describe --entity-type topics --entity-name "$topic" --all 2>/dev/null || true)
    parts=$(awk -F'\t' 'NR==1 { for (i=1;i<=NF;i++) if ($i ~ /^PartitionCount: /) { sub(/^PartitionCount: /, "", $i); print $i; exit } }' <<<"$desc")
    rf=$(awk -F'\t' 'NR==1 { for (i=1;i<=NF;i++) if ($i ~ /^ReplicationFactor: /) { sub(/^ReplicationFactor: /, "", $i); print $i; exit } }' <<<"$desc")
    retention=$(cfg_value retention.ms "$cfg")
    minisr=$(cfg_value min.insync.replicas "$cfg")
    cleanup=$(cfg_value cleanup.policy "$cfg")
    isr=$(awk -F'\t' '
      /Partition: / {
        for (i = 1; i <= NF; i++) {
          if ($i ~ /^Isr: /) {
            v = $i
            sub(/^Isr: /, "", v)
            n = (v ~ /^[0-9]+(,[0-9]+)*$/) ? split(v, ids, ",") : 0
            out = out (out ? "," : "") n
          }
        }
      }
      END { print out }
    ' <<<"$desc")
    # A topic the learner just created may still be catching up. Keep the last reading.
    if [[ "$isr" == "3,3,3,3,3,3" || "$attempt" -eq 15 ]]; then
      break
    fi
    sleep 2
  done
  echo "TOPIC $topic parts=${parts:-} rf=${rf:-} retention=${retention:-} minisr=${minisr:-} cleanup=${cleanup:-} isr=${isr:-}"
}

dump alerts
dump trips
dump matches
EOF
)" || { echo "could not read the cluster" >&2; exit 1; }

line_for() {
  awk -v topic="$1" '$1 == "TOPIC" && $2 == topic { print; exit }' <<<"$report"
}

field() {
  # $1 line, $2 key. Values contain no spaces.
  awk -v key="$2" '{ for (i = 1; i <= NF; i++) if ($i ~ ("^" key "=")) { sub(/^[^=]+=/, "", $i); print $i; exit } }' <<<"$1"
}

missing() {
  awk -v topic="$1" '$1 == "MISSING" && $2 == topic { found = 1 } END { exit found ? 0 : 1 }' <<<"$report"
}

if missing alerts; then
  fail "alerts does not exist"
else
  n="$(line_for alerts)"
  [[ "$(field "$n" parts)" == 6 ]] || fail "alerts has $(field "$n" parts) partitions; spec is 6"
  ok "alerts partitions"
  [[ "$(field "$n" rf)" == 3 ]] || fail "alerts replication factor is $(field "$n" rf); spec is 3"
  ok "alerts replication factor"
  [[ "$(field "$n" retention)" == 259200000 ]] || fail "alerts retention.ms is $(field "$n" retention); spec is 259200000 (3 days)"
  ok "alerts retention"
  [[ "$(field "$n" minisr)" == 2 ]] || fail "alerts min.insync.replicas is $(field "$n" minisr); spec is 2"
  ok "alerts min.insync.replicas"
  [[ "$(field "$n" cleanup)" == delete ]] || fail "alerts cleanup.policy is $(field "$n" cleanup); spec is delete"
  ok "alerts cleanup policy"
  [[ "$(field "$n" isr)" == "3,3,3,3,3,3" ]] || fail "every alerts partition needs 3 in-sync replicas; got $(field "$n" isr)"
  ok "alerts in-sync replicas"
fi

check_untouched() {
  local topic=$1 line
  # A miss on alerts must not hide this topic's own ok line.
  _grade_miss=0
  if missing "$topic"; then
    fail "$topic is missing; do not delete it"
    return
  fi
  line="$(line_for "$topic")"
  [[ "$(field "$line" parts)" == 6 && "$(field "$line" rf)" == 3 \
    && "$(field "$line" retention)" == 604800000 && "$(field "$line" minisr)" == 2 \
    && "$(field "$line" cleanup)" == delete && "$(field "$line" isr)" == "3,3,3,3,3,3" ]] \
    || fail "$topic was changed (partitions $(field "$line" parts), replication factor $(field "$line" rf), retention.ms $(field "$line" retention), min.insync.replicas $(field "$line" minisr), cleanup.policy $(field "$line" cleanup), in-sync $(field "$line" isr))"
  ok "$topic unchanged"
}

check_untouched trips
check_untouched matches

pass "alerts matches the spec"
