#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

params="$(seed_value params)"
[[ -n "$params" ]] || fail "lab seed missing (params); reset the lab"
bail_if_failed
read -r customer rows <<<"$params"

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

q() { sql_scalar <<<"$1"; }

n="$(q "SELECT count(*) FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
        WHERE t.relname = 'orders' AND a.attname = 'customer_id'
          AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL;")"
if [[ "$n" -ge 1 ]]; then
  ok "index on orders(customer_id) exists"
else
  fail "no valid index with customer_id as its first column on orders — try CREATE INDEX ... ON orders (customer_id)"
fi

now_rows="$(q 'SELECT count(*) FROM orders;')"
[[ "$now_rows" == "$rows" ]] || fail "orders has $now_rows rows, expected $rows — do not delete data"
bail_if_failed

q 'ANALYZE orders;' >/dev/null
plan="$(plan_of "(COSTS OFF) SELECT id, status, total, created_at FROM orders WHERE customer_id = $customer;")" || plan=""
if [[ "$plan" == *"Seq Scan on orders"* ]]; then
  fail "the lookup still does a Seq Scan on orders"
elif [[ "$plan" == *"Index Scan"* || "$plan" == *"Bitmap Index Scan"* || "$plan" == *"Index Only Scan"* ]]; then
  ok "EXPLAIN shows the lookup uses an index"
else
  fail "could not confirm an index scan for customer_id = $customer; plan was: $(printf '%s' "$plan" | tr '\n' ' ')"
fi

pass "customer_id lookup is indexed"
