#!/usr/bin/env bash
# Answer files match the live cluster. rider.dispatch partition 3's recorded
# offset is the log end (--time -1), not the last stable offset.
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

dispatch="$(kafka-topics.sh --bootstrap-server "$bs" --describe --topic rider.dispatch 2>/dev/null || true)"
leader="$(leader_of "$dispatch" 3)"
end_line="$(kafka-get-offsets.sh --bootstrap-server "$bs" --topic rider.dispatch --partitions 3 --time -1 2>/dev/null || true)"
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
echo "FILE_LEADER $(file_value rider-dispatch-3-leader)"
echo "FILE_END $(file_value rider-dispatch-3-end)"
echo "SCRATCH $scratch"
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
check_file "rider.dispatch partition 3 leader" "$(row FILE_LEADER)" "$(row LEADER)"
check_file "rider.dispatch partition 3 end" "$(row FILE_END)" "$(row END)"

_grade_miss=0
if [[ "$(row SCRATCH)" == gone ]]; then
  ok "scratch deleted"
else
  fail "scratch still exists"
fi

pass "the handover matches the cluster"
