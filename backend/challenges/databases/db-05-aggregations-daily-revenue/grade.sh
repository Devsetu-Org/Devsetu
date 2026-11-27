#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

from="$(seed_value from-date)"; to="$(seed_value biz-date)"
[[ -n "$from" && -n "$to" ]] || fail "lab seed missing; reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'group[[:space:]]+by' "GROUP BY" || true
  sql_mentions query.sql 'sum[[:space:]]*\(' "SUM(...)" || true
  grade_rows query.sql ordered "daily orders + revenue ($from .. $to)" <<SQL || true
SELECT created_at::date AS day, count(*) AS orders, sum(total) AS revenue
FROM orders
WHERE status <> 'cancelled'
  AND created_at >= date '$from' AND created_at < date '$to' + 1
GROUP BY created_at::date
ORDER BY day;
SQL
fi

pass "daily revenue aggregation"
