#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

biz="$(seed_value biz-date)"
[[ -n "$biz" ]] || fail "lab seed missing (biz-date); reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'select' "a SELECT statement" || true
  sql_mentions query.sql 'from[[:space:]]+orders' "the orders table (FROM orders)" || true
  grade_rows query.sql ordered "orders for $biz (id, status, total)" <<SQL || true
SELECT id, status, total FROM orders
WHERE created_at >= date '$biz' AND created_at < date '$biz' + 1
ORDER BY id;
SQL
fi

pass "first SELECT returns the right orders"
