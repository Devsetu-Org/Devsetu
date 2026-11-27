#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

custs="$(seed_value customers)"
[[ -n "$custs" ]] || fail "lab seed missing (customers); reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'over[[:space:]]*\(' "a window function (... OVER (...))" || true
  sql_mentions query.sql 'partition[[:space:]]+by' "PARTITION BY customer_id" || true
  grade_rows query.sql ordered "running total per customer ($custs)" <<SQL || true
SELECT customer_id, id AS order_id, total,
       sum(total) OVER (PARTITION BY customer_id ORDER BY created_at) AS running_total
FROM orders
WHERE status <> 'cancelled' AND customer_id IN ($custs)
ORDER BY customer_id, created_at;
SQL
fi

pass "window function running total"
