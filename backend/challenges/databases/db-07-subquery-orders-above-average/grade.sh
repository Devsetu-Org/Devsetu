#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

from="$(seed_value from-date)"; to="$(seed_value biz-date)"
[[ -n "$from" && -n "$to" ]] || fail "lab seed missing; reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'avg[[:space:]]*\(' "AVG(total)" || true
  sql_mentions query.sql '\([[:space:]]*select' "a subquery ( SELECT ... )" || true
  grade_rows query.sql ordered "orders above the window average" <<SQL || true
SELECT id, total FROM orders
WHERE status <> 'cancelled'
  AND created_at >= date '$from' AND created_at < date '$to' + 1
  AND total > (
    SELECT avg(total) FROM orders
    WHERE status <> 'cancelled'
      AND created_at >= date '$from' AND created_at < date '$to' + 1
  )
ORDER BY total DESC, id;
SQL
fi

pass "subquery against the average"
