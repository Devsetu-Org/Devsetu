#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

customer="$(seed_value params)"
[[ -n "$customer" ]] || fail "lab seed missing (params); reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

q() { sql_scalar <<<"$1"; }
QUERY="SELECT id, status, total, created_at FROM orders WHERE customer_id = $customer AND status = 'pending' ORDER BY created_at DESC LIMIT 20;"

# Live plan: what the database does right now.
q 'ANALYZE orders;' >/dev/null
live="$(plan_of "(COSTS OFF) $QUERY")" || live=""
if [[ "$live" == *"Seq Scan"* ]]; then
  fail "the live plan still has a Seq Scan on orders — add an index that starts with customer_id"
elif [[ "$live" != *"Index"* ]]; then
  fail "the live plan does not use an index: $(printf '%s' "$live" | tr '\n' ' ')"
elif [[ "$live" == *"Sort"* ]]; then
  fail "the live plan still has a Sort node — an index on (customer_id, created_at) lets Postgres read rows already ordered"
else
  ok "live plan: index scan, no Seq Scan, no Sort"
fi

# Saved evidence.
if ! box_ok "test -s $ANSWERS/plan.txt"; then
  fail "~/answers/plan.txt is missing or empty — save your EXPLAIN (ANALYZE) output there"
else
  has() { box_ok "grep -qF -- $(printf '%q' "$1") $ANSWERS/plan.txt"; }
  has 'Execution Time' || fail "plan.txt should come from EXPLAIN (ANALYZE) — it has no 'Execution Time' line"
  has "customer_id = $customer" || fail "plan.txt is not the plan for customer $customer's query (no 'customer_id = $customer')"
  has 'Index' || fail "plan.txt shows no index scan — save the plan from AFTER you created the index"
  if has 'Seq Scan'; then fail "plan.txt still shows a Seq Scan — save the plan from after the fix"; fi
  if has 'Sort'; then fail "plan.txt still shows a Sort node — save the plan from after the fix"; fi
  ok "plan.txt is the fixed plan"
fi

pass "slow query fixed and plan saved"
