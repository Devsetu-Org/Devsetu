#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

thr="$(seed_value threshold)"
[[ -n "$thr" ]] || fail "lab seed missing (threshold); reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  sql_mentions query.sql 'where' "a WHERE clause" || true
  sql_mentions query.sql 'order[[:space:]]+by' "ORDER BY" || true
  grade_rows query.sql ordered "pending orders over $thr, newest first" <<SQL || true
SELECT id, customer_id, total, created_at FROM orders
WHERE status = 'pending' AND total > $thr
ORDER BY created_at DESC;
SQL
fi

pass "multi-condition WHERE with the right ordering"
