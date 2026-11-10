#!/usr/bin/env bash
# Spark-13: successful run without killing the planted backfill AM.
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

blocker_want="$(in_pod ds-spark-01 'tr -d "\r\n" < /opt/lab/state/blocker_app_id 2>/dev/null || echo MISSING' | tr -d '\r\n')"
blocker_state="$(
  yarn_apps_json | tr '{' '\n' | awk -v want="$blocker_want" '
    BEGIN { id=""; state="" }
    /"id"/ { gsub(/[",]/, "", $0); split($0, a, ":"); id=a[2] }
    /"state"/ {
      gsub(/[",]/, "", $0); split($0, a, ":"); state=a[2]
      if (id == want) { print state; exit }
    }
  '
)"
_grade_miss=0
if [[ "$blocker_want" == MISSING || -z "$blocker_want" ]]; then
  fail "setup blocker app id missing"
elif [[ "$blocker_state" == "KILLED" || "$blocker_state" == "FAILED" ]]; then
  fail "backfill AM was killed/failed ($blocker_state) — ticket forbids unauthorized AM kill"
elif [[ "$blocker_state" == "RUNNING" || "$blocker_state" == "ACCEPTED" || "$blocker_state" == "FINISHED" ]]; then
  ok "backfill still present ($blocker_state)"
else
  fail "backfill state unexpected (${blocker_state:-none})"
fi

got_blocker="$(file_value blockerApp)"
_grade_miss=0
if [[ "$got_blocker" == "$blocker_want" ]]; then
  ok "Blocker application id"
else
  fail "Blocker application id is wrong (got ${got_blocker:-none})"
fi

check_choice "Stalled submit state" "$(file_value stuckState)" "ACCEPTED"
fix_path="$(file_value fixPath)"
_grade_miss=0
if [[ "$fix_path" == "other-queue" || "$fix_path" == "freed-capacity" ]]; then
  ok "Fix path"
elif [[ "$fix_path" == "killed-am" ]]; then
  fail "Killing the backfill AM is out of spec"
elif [[ "$fix_path" == "raised-cap" ]]; then
  fail "Raising queue capacity is out of spec"
else
  fail "Fix path is missing or wrong (got ${fix_path:-none})"
fi

check_choice "Yesterday lesson" "$(file_value yesterdayLesson)" "other-tenant"

fix_id="$(file_value fixedAppId)"
_grade_miss=0
if [[ "$fix_id" == MISSING || -z "$fix_id" || ! "$fix_id" =~ ^application_ ]]; then
  fail "Successful application id is missing or malformed"
elif [[ "$fix_id" == "$blocker_want" ]]; then
  fail "Successful application id must not be the backfill"
else
  info="$(
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
  q="${info%%|*}"; st="${info##*|}"
  if [[ "$st" != "FINISHED" && "$st" != "RUNNING" && "$st" != "SUCCEEDED" ]]; then
    fail "Successful app should be RUNNING or FINISHED (saw ${st:-none})"
  elif [[ "$fix_path" == "other-queue" && "$q" != *adhoc* && "$q" != *production* ]]; then
    # Prefer adhoc; allow production only if they freed capacity without kill.
    fail "Expected a spare-queue run (adhoc) for other-queue fix (got queue=${q:-none})"
  else
    ok "Successful app $fix_id ($st, queue=${q:-unknown})"
  fi
fi

pass "recovered without unauthorized backfill AM kill"
