#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

n="$(seed_value orphans)"
[[ -n "$n" ]] || fail "lab seed missing (orphans); reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'left[[:space:]]+(outer[[:space:]]+)?join' "a LEFT JOIN" || true
  sql_mentions query.sql 'is[[:space:]]+null' "an IS NULL test on the customer side" || true
  grade_rows query.sql ordered "the $n orphan orders (id, customer_id, total)" <<SQL || true
SELECT o.id, o.customer_id, o.total
FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
WHERE c.id IS NULL
ORDER BY o.id;
SQL
fi

pass "orphan orders found with LEFT JOIN"
