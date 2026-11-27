#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

code="$(seed_value code)"
a_kind="$(seed_value a-kind)"; b_kind="$(seed_value b-kind)"
a_kw="$(seed_value a-kw)"; b_kw="$(seed_value b-kw)"
[[ -n "$code" && -n "$a_kind" && -n "$b_kind" ]] || fail "lab seed missing; reset the lab"
bail_if_failed

if ! box_ok "test -s $ANSWERS/recommendation.md"; then
  fail "~/answers/recommendation.md does not exist (or is empty) — write your recommendation there"
  bail_if_failed
fi
file="$(in_box "cat $ANSWERS/recommendation.md" || true)"

# section <LABEL> — text after "LABEL:" up to the next label (markdown decoration ignored).
section() {
  printf '%s\n' "$file" | awk -v want="$1" '
    function norm(s) { s = toupper(s); gsub(/[*_`#>]/, "", s); sub(/^[ \t]*-[ \t]*/, "", s); sub(/^[ \t]+/, "", s); return s }
    { n = norm($0)
      if (n ~ /^(REVIEW CODE|PATTERN A|WHY A|PATTERN B|WHY B|TRADE-?OFFS?)[ \t]*:/) {
        on = (n ~ ("^" want "[ \t]*:"))
        if (on) { line = $0; sub(/^[^:]*:/, "", line); print line }
        next
      }
      if (on) print }'
}
# classify <text> — document | relational | both | none
classify() {
  local t d=0 r=0
  t="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$t" =~ (document|nosql|mongo|jsonb|json) ]] && d=1
  t="${t//nosql/}"
  [[ "$t" =~ (relational|sql|postgres|table) ]] && r=1
  if (( d && r )); then echo both; elif (( d )); then echo document; elif (( r )); then echo relational; else echo none; fi
}
lc() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
words() { printf '%s' "$1" | tr -s '[:space:]' ' ' | awk '{ print length($0) }'; }

got_code="$(section 'REVIEW CODE' | tr -d '[:space:]*`')"
[[ "$got_code" == "$code" ]] || fail "REVIEW CODE should be $code (found '${got_code:-none}')"
ok "review code"

check_pattern() {  # <A|B> <expected-kind> <keyword-ERE>
  local p=$1 want=$2 kw=$3 choice why
  choice="$(classify "$(section "PATTERN $p")")"
  if [[ "$choice" == none || "$choice" == both ]]; then
    fail "PATTERN $p: choose exactly one of 'relational' or 'document' (found '$(section "PATTERN $p" | tr -s '[:space:]' ' ')')"
    return 1
  fi
  if [[ "$choice" != "$want" ]]; then
    fail "PATTERN $p: you chose $choice — re-read the pattern; the other model fits it better"
    return 1
  fi
  why="$(lc "$(section "WHY $p")")"
  if [[ "$(words "$why")" -lt 40 ]]; then
    fail "WHY $p is too short — write at least a full sentence (40+ characters)"
    return 1
  fi
  if ! [[ "$why" =~ $kw ]]; then
    fail "WHY $p should use a concrete modelling term (e.g. $(printf '%s' "$kw" | tr '|' ' ' | cut -d' ' -f1-4 | tr ' ' ',') ...)"
    return 1
  fi
  ok "pattern $p -> $want, with a reason"
}
check_pattern A "$a_kind" "$a_kw" || true
check_pattern B "$b_kind" "$b_kw" || true

to="$(lc "$(section 'TRADE-?OFFS?')")"
if [[ "$(words "$to")" -lt 60 ]]; then
  fail "TRADE-OFFS should be at least 60 characters (name a cost of each approach)"
else
  hits=0
  for w in schema join transaction acid consisten index scale duplicate denormal; do
    [[ "$to" == *"$w"* ]] && hits=$((hits + 1))
  done
  if [[ "$hits" -ge 2 ]]; then
    ok "trade-offs discussed"
  else
    fail "TRADE-OFFS should use at least two of: schema, join, transaction, ACID, consistency, index, scale, duplicate, denormalised"
  fi
fi

pass "relational vs document recommendation"
