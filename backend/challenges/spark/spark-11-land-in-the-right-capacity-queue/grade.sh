#!/usr/bin/env bash
# Spark-11: successful app in production; default capacity not inflated.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

file_value() {
  local key=$1
  in_shell "if [[ -f \"\$HOME/answers/$key\" ]]; then tr -d '\\r' < \"\$HOME/answers/$key\"; else echo MISSING; fi" \
    | tr -d '\n'
}

check_choice() {
  local label=$1 got=$2 want=$3
  _grade_miss=0
  if [[ "$got" == MISSING || -z "$got" ]]; then
    fail "$label is missing"
  elif [[ "$got" == "$want" ]]; then
    ok "$label"
  else
    fail "$label is wrong (got $got)"
  fi
}

_grade_miss=0
if yarn_rm_running; then ok "ResourceManager up"; else fail "ResourceManager is down"; fi

active="$(yarn_active_nodes || true)"
_grade_miss=0
if [[ -n "$active" && "$active" -ge 2 ]]; then ok "2 NodeManagers"; else fail "need 2 active NMs"; fi

# Default queue must still be capped (learner must not "fix" by raising it).
def_cap="$(
  in_pod ds-spark-01 '
    awk -F"[<>]" "
      /yarn.scheduler.capacity.root.default.maximum-capacity/ { getline; print \$3; exit }
      /yarn.scheduler.capacity.root.default.capacity/ { getline; c=\$3 }
      END { if (c != \"\") print c }
    " /opt/hadoop/etc/hadoop/capacity-scheduler.xml
  ' | tr -d '\r\n' | awk 'NF{print; exit}'
)"
_grade_miss=0
if [[ -n "$def_cap" && "$def_cap" =~ ^[0-9]+$ && "$def_cap" -le 15 ]]; then
  ok "default queue capacity still tight ($def_cap)"
else
  fail "default queue capacity looks raised (saw ${def_cap:-none}) — use production instead"
fi

check_choice "Stuck submit state" "$(file_value stuckState)" "ACCEPTED"
check_choice "Stuck submit queue" "$(file_value wrongQueue)" "default"
check_choice "Fix queue" "$(file_value fixQueue)" "production"
check_choice "Placement lesson" "$(file_value placementRule)" "queue-placement"

fix_id="$(file_value fixAppId)"
_grade_miss=0
if [[ "$fix_id" == MISSING || -z "$fix_id" || ! "$fix_id" =~ ^application_ ]]; then
  fail "Successful application id is missing or malformed"
else
  # Confirm the app exists and used production (queue field in apps JSON).
  queue="$(
    yarn_apps_json | tr '{' '\n' | awk -v want="$fix_id" '
      BEGIN { id=""; q=""; state="" }
      /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
      /"queue"/ { gsub(/[",]/, "", $0); split($0, a, ":"); q=a[2] }
      /"state"/ {
        gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
        if (id == want) { print q "|" state; exit }
      }
    '
  )"
  q="${queue%%|*}"; st="${queue##*|}"
  if [[ "$q" == *production* ]] && [[ "$st" == "FINISHED" || "$st" == "RUNNING" || "$st" == "SUCCEEDED" ]]; then
    ok "Successful app $fix_id in production ($st)"
  elif [[ "$q" == *production* ]]; then
    ok "Successful app $fix_id targeted production (state $st)"
  else
    fail "Successful app should be in production (got queue=${q:-none} state=${st:-none})"
  fi
fi

pass "landed in the production queue"
