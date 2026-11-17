#!/usr/bin/env bash
# Spark-13: analytics leaf designed + refreshed; probe succeeds in that queue.
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

# Parse "Capacity : 15.00%" (or "Capacity : 15%") from yarn queue -status.
queue_capacity_pct() {
  local q=$1
  local out
  out="$(in_shell "yarn queue -status '$q' 2>/dev/null" || true)"
  if [[ -z "$out" ]] || echo "$out" | grep -qi 'Cannot get queue'; then
    echo ""
    return 0
  fi
  echo "$out" | awk '
    /[Cc]apacity[[:space:]]*:/ && $0 !~ /[Cc]urrent/ && $0 !~ /[Mm]aximum/ {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /[0-9]+(\.[0-9]+)?%/) {
          gsub(/%/, "", $i)
          print $i + 0
          exit
        }
      }
    }
  '
}

_grade_miss=0
if yarn_rm_running; then ok "ResourceManager up"; else fail "ResourceManager is down"; fi

# --- Live scheduler shape ---
analytics_cap="$(queue_capacity_pct analytics)"
_grade_miss=0
if [[ -z "$analytics_cap" ]]; then
  fail "analytics queue is missing on the live scheduler — design and refreshQueues it"
else
  ok "analytics queue exists (capacity=${analytics_cap}%)"
fi

if [[ -n "$analytics_cap" ]]; then
  _grade_miss=0
  if awk -v c="$analytics_cap" 'BEGIN { exit !(c + 0 >= 20) }'; then
    ok "analytics capacity >= 20% (${analytics_cap}%)"
  else
    fail "analytics capacity must be >= 20% (got ${analytics_cap}%)"
  fi
fi

# user-limit-factor + maximum-capacity live in the RM's capacity-scheduler.xml
ulf="$(
  in_pod ds-spark-01 '
    python3 - <<'"'"'PY'"'"'
from pathlib import Path
import re
text = Path("/opt/hadoop/etc/hadoop/capacity-scheduler.xml").read_text()
# Prefer analytics-specific property; fall back to missing.
m = re.search(
    r"yarn\.scheduler\.capacity\.root\.analytics\.user-limit-factor</name>\s*<value>([^<]+)</value>",
    text,
)
print((m.group(1).strip() if m else ""), end="")
PY
  ' | tr -d '\r\n'
)"
_grade_miss=0
if [[ -z "$ulf" ]]; then
  fail "analytics user-limit-factor is missing — set it to at least 2 on the RM config"
elif awk -v u="$ulf" 'BEGIN { exit !(u + 0 >= 2) }'; then
  ok "analytics user-limit-factor >= 2 (${ulf})"
else
  fail "analytics user-limit-factor must be >= 2 (got ${ulf})"
fi

amax="$(
  in_pod ds-spark-01 '
    python3 - <<'"'"'PY'"'"'
from pathlib import Path
import re
text = Path("/opt/hadoop/etc/hadoop/capacity-scheduler.xml").read_text()
m = re.search(
    r"yarn\.scheduler\.capacity\.root\.analytics\.maximum-capacity</name>\s*<value>([^<]+)</value>",
    text,
)
print((m.group(1).strip() if m else ""), end="")
PY
  ' | tr -d '\r\n'
)"
_grade_miss=0
if [[ -z "$amax" ]]; then
  fail "analytics maximum-capacity is missing — set it to 100"
elif awk -v m="$amax" 'BEGIN { exit !(m + 0 >= 100) }'; then
  ok "analytics maximum-capacity is 100 (${amax})"
else
  fail "analytics maximum-capacity must be 100 (got ${amax})"
fi

prod_cap="$(queue_capacity_pct production)"
_grade_miss=0
if [[ -z "$prod_cap" ]]; then
  fail "production queue missing — do not delete sibling tenants to invent analytics"
elif awk -v c="$prod_cap" 'BEGIN { exit !(c + 0 >= 50) }'; then
  ok "production still usable (>= 50%, got ${prod_cap}%)"
else
  fail "production capacity gutted below 50% (got ${prod_cap}%) — rebalance without wrecking production"
fi

def_cap="$(queue_capacity_pct default)"
_grade_miss=0
if [[ -n "$def_cap" ]] && awk -v c="$def_cap" 'BEGIN { exit !(c + 0 > 15) }'; then
  fail "default queue capacity looks raised (${def_cap}%) — do not inflate default to paper over design"
else
  ok "default capacity still tight (${def_cap:-n/a}%)"
fi

adhoc_cap="$(queue_capacity_pct adhoc)"
sum="$(
  python3 - <<PY
vals = []
for v in ("${analytics_cap}", "${prod_cap}", "${def_cap}", "${adhoc_cap}"):
    v = (v or "").strip()
    if v:
        vals.append(float(v))
print(round(sum(vals), 2))
PY
)"
_grade_miss=0
if awk -v s="$sum" 'BEGIN { exit !(s + 0 >= 99.0 && s + 0 <= 101.0) }'; then
  ok "root leaf capacities sum to ~100 (got ${sum})"
else
  fail "root leaf capacities must sum to 100 (got ${sum})"
fi

# --- Wrapper still targets analytics ---
_grade_miss=0
wrapper="$(in_shell 'cat "$HOME/lab/submit-analytics-probe.sh" 2>/dev/null || true')"
if echo "$wrapper" | grep -qE -- '--queue[[:space:]]+analytics'; then
  if echo "$wrapper" | grep -qE -- '--queue[[:space:]]+(production|adhoc|default)'; then
    fail "Wrapper must target analytics — not production/adhoc/default"
  else
    ok "Wrapper still uses --queue analytics"
  fi
else
  fail "Wrapper must use --queue analytics (do not borrow another queue)"
fi

# --- Investigation ---
check_choice "First failure" "$(file_value firstFailure)" "queue-missing"
check_choice "Design action" "$(file_value designAction)" "add-analytics-rebalance"
check_choice "Capacity source" "$(file_value capacitySource)" "rebalance-siblings"
check_choice "Apply method" "$(file_value applyMethod)" "refresh-queues"

fix_id="$(file_value fixedAppId)"
_grade_miss=0
if [[ "$fix_id" == MISSING || -z "$fix_id" || ! "$fix_id" =~ ^application_ ]]; then
  fail "Successful application id is missing or malformed"
else
  # Prefer yarn application -status — REST /apps can omit recently FINISHED apps.
  report="$(in_shell "yarn application -status '$fix_id' 2>/dev/null" || true)"
  st="$(echo "$report" | awk -F' : ' '/^\tState / { gsub(/[ \t\r]/,"",$2); print $2; exit }')"
  q="$(echo "$report" | awk -F' : ' '/^\tQueue / { gsub(/[ \t\r]/,"",$2); print $2; exit }')"
  name="$(echo "$report" | awk -F' : ' '/^\tApplication-Name / { gsub(/^[ \t]+|[ \t\r]+$/,"",$2); print $2; exit }')"
  if [[ "$st" != "FINISHED" && "$st" != "RUNNING" && "$st" != "SUCCEEDED" ]]; then
    fail "Successful app should be RUNNING or FINISHED (saw ${st:-none})"
  elif [[ "$q" != *analytics* ]]; then
    fail "Successful app must land in analytics (got queue=${q:-none}) — borrowing production/adhoc fails"
  else
    ok "Successful app $fix_id ($st, queue=${q:-unknown}, name=${name:-unknown})"
  fi
fi

check_choice "Platform lesson" "$(file_value platformLesson)" "design-not-borrow"

pass "analytics queue designed, refreshed, and proven"
