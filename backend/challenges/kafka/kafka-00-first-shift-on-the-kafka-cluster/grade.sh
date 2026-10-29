#!/usr/bin/env bash
# Answer files match the live cluster. matches partition 3's recorded offset
# is the log end (--time -1), not the last stable offset. scratch is gone.
# trips and matches still have 6 partitions and replication factor 3.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

report="$(shell_script <<'EOF'
set -u
bs="${BOOTSTRAP_SERVERS:?BOOTSTRAP_SERVERS is required}"

file_value() {
  local f="$HOME/answers/$1"
  if [[ ! -f "$f" ]]; then
    echo MISSING
    return
  fi
  tr -d '[:space:]' < "$f"
}

field() {
  # $1 describe output, $2 key such as PartitionCount or ReplicationFactor. First line only.
  awk -F'\t' -v key="$2" 'NR==1 { for (i = 1; i <= NF; i++) if ($i ~ ("^" key ": ")) { sub("^" key ": ", "", $i); print $i; exit } }' <<<"$1"
}

leader_of() {
  # Partition line is tab-separated: "Partition: 3" "Leader: 1"
  awk -F'\t' -v want="$2" '
    {
      part = ""
      leader = ""
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^Partition: /) { sub(/^Partition: /, "", $i); part = $i }
        else if ($i ~ /^Leader: /) { sub(/^Leader: /, "", $i); leader = $i }
      }
      if (part == want) { print leader; exit }
    }
  ' <<<"$1"
}

quorum="$(kafka-metadata-quorum.sh --bootstrap-server "$bs" describe --status)"
controller="$(awk '/^LeaderId:/ { print $2; exit }' <<<"$quorum")"
[[ -n "$controller" ]] || { echo "grader could not read the controller" >&2; exit 1; }

matches="$(kafka-topics.sh --bootstrap-server "$bs" --describe --topic matches 2>/dev/null || true)"
trips="$(kafka-topics.sh --bootstrap-server "$bs" --describe --topic trips 2>/dev/null || true)"
leader="$(leader_of "$matches" 3)"
end_line="$(kafka-get-offsets.sh --bootstrap-server "$bs" --topic matches --partitions 3 --time -1 2>/dev/null || true)"
end="${end_line##*:}"

if kafka-topics.sh --bootstrap-server "$bs" --describe --topic scratch >/dev/null 2>&1; then
  scratch=present
else
  scratch=gone
fi

echo "CONTROLLER $controller"
echo "LEADER $leader"
echo "END $end"
echo "FILE_CONTROLLER $(file_value controller)"
echo "FILE_LEADER $(file_value matches-3-leader)"
echo "FILE_END $(file_value matches-3-end)"
echo "SCRATCH $scratch"
echo "TRIPS $(field "$trips" PartitionCount) $(field "$trips" ReplicationFactor)"
echo "MATCHES $(field "$matches" PartitionCount) $(field "$matches" ReplicationFactor)"
EOF
)"

row() {
  awk -v key="$1" '$1 == key { $1 = ""; sub(/^ /, ""); print; exit }' <<<"$report"
}

[[ -n "$(row CONTROLLER)" && -n "$(row LEADER)" && -n "$(row END)" ]] \
  || { echo "grader could not read the cluster" >&2; exit 1; }

check_file() {
  local label=$1 got=$2 want=$3
  # A miss on the previous file must not hide this file's own ok line.
  _grade_miss=0
  if [[ "$got" == MISSING ]]; then
    fail "$label file is missing"
  elif [[ "$got" != "$want" ]]; then
    fail "$label is $want; the file says $got"
  else
    ok "$label"
  fi
}

check_file "controller" "$(row FILE_CONTROLLER)" "$(row CONTROLLER)"
check_file "matches partition 3 leader" "$(row FILE_LEADER)" "$(row LEADER)"
check_file "matches partition 3 log end offset" "$(row FILE_END)" "$(row END)"

_grade_miss=0
if [[ "$(row SCRATCH)" == gone ]]; then
  ok "scratch deleted"
else
  fail "scratch still exists"
fi

check_shape() {
  local topic=$1 name=$2 got parts rf
  _grade_miss=0
  got="$(row "$topic")"
  parts="${got%% *}"
  rf="${got##* }"
  if [[ -z "$parts" || "$parts" == "$got" && -z "$rf" ]]; then
    fail "$name is missing; do not delete it"
    return
  fi
  [[ "$parts" == 6 && "$rf" == 3 ]] || fail "$name was changed (partitions $parts, replication factor $rf)"
  ok "$name unchanged"
}

check_shape TRIPS trips
check_shape MATCHES matches

pass "the handover matches the cluster"
