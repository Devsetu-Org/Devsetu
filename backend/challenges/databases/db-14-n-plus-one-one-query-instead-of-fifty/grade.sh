#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

customer="$(seed_value params)"
[[ -n "$customer" ]] || fail "lab seed missing (params); reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  stmts="$(sql_stmt_count query.sql)"
  if [[ "$stmts" != 1 ]]; then
    fail "~/answers/query.sql must contain exactly ONE statement (found $stmts) — that is the point of the lab"
  else
    ok "a single statement"
  fi
  sql_mentions query.sql 'join|json_agg|array_agg|lateral' "a JOIN (orders + order_items in one statement)" || true
  grade_rows query.sql set "orders + items for customer $customer (50 orders, none dropped)" <<SQL || true
SELECT o.id AS order_id, o.status, i.sku, i.qty, i.price
FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
WHERE o.customer_id = $customer;
SQL
fi

pass "N+1 replaced by one query"
