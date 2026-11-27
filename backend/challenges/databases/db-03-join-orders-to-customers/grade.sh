#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

from="$(seed_value from-date)"; to="$(seed_value biz-date)"
[[ -n "$from" && -n "$to" ]] || fail "lab seed missing; reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'join' "a JOIN" || true
  grade_rows query.sql ordered "orders joined to customers ($from .. $to)" <<SQL || true
SELECT o.id, c.name, c.email
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE o.created_at >= date '$from' AND o.created_at < date '$to' + 1
ORDER BY o.id;
SQL
fi

pass "orders joined to customers"
