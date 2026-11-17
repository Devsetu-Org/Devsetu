#!/usr/bin/env bash
# Kafka-02: order.status matches PLATFORM.md; live topics untouched; Investigation.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

report="$(shell_script <<'EOF'
set -u
bs="${BOOTSTRAP_SERVERS:?BOOTSTRAP_SERVERS is required}"

cfg_value() {
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
    if [[ "$isr" =~ ^(3,)*3$ || "$attempt" -eq 15 ]]; then
      break
    fi
    sleep 2
  done
  echo "TOPIC $topic parts=${parts:-} rf=${rf:-} retention=${retention:-} minisr=${minisr:-} cleanup=${cleanup:-} isr=${isr:-}"
}

dump order.status
dump orders
dump rider.dispatch
dump restaurant.notifications
EOF
)" || { echo "could not read the cluster" >&2; exit 1; }

line_for() {
  awk -v topic="$1" '$1 == "TOPIC" && $2 == topic { print; exit }' <<<"$report"
}

field() {
  awk -v key="$2" '{ for (i = 1; i <= NF; i++) if ($i ~ ("^" key "=")) { sub(/^[^=]+=/, "", $i); print $i; exit } }' <<<"$1"
}

missing() {
  awk -v topic="$1" '$1 == "MISSING" && $2 == topic { found = 1 } END { exit found ? 0 : 1 }' <<<"$report"
}

if missing order.status; then
  fail "order.status does not exist"
else
  n="$(line_for order.status)"
  [[ "$(field "$n" parts)" == 6 ]] || fail "order.status has $(field "$n" parts) partitions; platform spec is 6 (not the ticket's 3)"
  ok "order.status partitions"
  [[ "$(field "$n" rf)" == 3 ]] || fail "order.status replication factor is $(field "$n" rf); platform spec is 3 (not the ticket's 2)"
  ok "order.status replication factor"
  [[ "$(field "$n" retention)" == 259200000 ]] || fail "order.status retention.ms is $(field "$n" retention); platform spec is 259200000 (3 days)"
  ok "order.status retention"
  [[ "$(field "$n" minisr)" == 2 ]] || fail "order.status min.insync.replicas is $(field "$n" minisr); platform spec is 2 (not the ticket's 1)"
  ok "order.status min.insync.replicas"
  [[ "$(field "$n" cleanup)" == delete ]] || fail "order.status cleanup.policy is $(field "$n" cleanup); spec is delete"
  ok "order.status cleanup policy"
  [[ "$(field "$n" isr)" == "3,3,3,3,3,3" ]] || fail "every order.status partition needs 3 in-sync replicas; got $(field "$n" isr)"
  ok "order.status in-sync replicas"
fi

check_untouched() {
  local topic=$1 parts=$2 isr=$3 line
  _grade_miss=0
  if missing "$topic"; then
    fail "$topic is missing; do not delete it"
    return
  fi
  line="$(line_for "$topic")"
  [[ "$(field "$line" parts)" == "$parts" && "$(field "$line" rf)" == 3 \
    && "$(field "$line" retention)" == 604800000 && "$(field "$line" minisr)" == 2 \
    && "$(field "$line" cleanup)" == delete && "$(field "$line" isr)" == "$isr" ]] \
    || fail "$topic was changed (partitions $(field "$line" parts), RF $(field "$line" rf), retention.ms $(field "$line" retention), min.ISR $(field "$line" minisr), cleanup $(field "$line" cleanup), ISR $(field "$line" isr))"
  ok "$topic unchanged"
}

check_untouched orders 6 3,3,3,3,3,3
check_untouched rider.dispatch 6 3,3,3,3,3,3
check_untouched restaurant.notifications 3 3,3,3

# --- Investigation ---
plane="$(file_value controlPlane)"
_grade_miss=0
if [[ "$plane" == MISSING || -z "$plane" ]]; then
  fail "control-plane choice is missing"
elif [[ "$plane" == "kraft" ]]; then
  ok "control plane"
else
  fail "control-plane is wrong (this lab is KRaft — no ZooKeeper)"
fi

src="$(file_value shapeSource)"
_grade_miss=0
if [[ "$src" == MISSING || -z "$src" ]]; then
  fail "shape-source choice is missing"
elif [[ "$src" == "platform-note" ]]; then
  ok "shape source"
else
  fail "shape source is wrong (use ~/ticket/PLATFORM.md, not the ticket template)"
fi

parts_ans="$(file_value orderStatusPartitions | tr -d '[:space:]')"
_grade_miss=0
if [[ "$parts_ans" == "6" ]]; then
  ok "Investigation partitions"
else
  fail "Investigation partitions should be 6 (platform note); got ${parts_ans:-missing}"
fi

rf_ans="$(file_value orderStatusRf | tr -d '[:space:]')"
_grade_miss=0
if [[ "$rf_ans" == "3" ]]; then
  ok "Investigation RF"
else
  fail "Investigation RF should be 3; got ${rf_ans:-missing}"
fi

ret_ans="$(file_value orderStatusRetention | tr -d '[:space:]')"
_grade_miss=0
if [[ "$ret_ans" == "259200000" ]]; then
  ok "Investigation retention"
else
  fail "Investigation retention.ms should be 259200000; got ${ret_ans:-missing}"
fi

min_ans="$(file_value orderStatusMinIsr | tr -d '[:space:]')"
_grade_miss=0
if [[ "$min_ans" == "2" ]]; then
  ok "Investigation min.ISR"
else
  fail "Investigation min.insync.replicas should be 2; got ${min_ans:-missing}"
fi

pass "order.status matches the platform shape; Investigation agrees"
