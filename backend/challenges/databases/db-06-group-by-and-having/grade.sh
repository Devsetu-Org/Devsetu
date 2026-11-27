#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

n="$(seed_value min-orders)"
[[ -n "$n" ]] || fail "lab seed missing (min-orders); reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'group[[:space:]]+by' "GROUP BY" || true
  sql_mentions query.sql 'having' "HAVING (filter groups, not rows)" || true
  grade_rows query.sql ordered "customers with more than $n orders" <<SQL || true
SELECT c.id AS customer_id, c.name, count(*) AS order_count
FROM orders o JOIN customers c ON c.id = o.customer_id
GROUP BY c.id, c.name
HAVING count(*) > $n
ORDER BY order_count DESC, c.id;
SQL
fi

pass "GROUP BY + HAVING"
