#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

from="$(seed_value from-date)"; to="$(seed_value biz-date)"
[[ -n "$from" && -n "$to" ]] || fail "lab seed missing; reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql query.sql; then
  t="$(sql_text query.sql)"
  [[ "$t" =~ ^[[:space:]]*with[[:space:]] ]] || fail "the query should start with WITH (common table expressions)"
  ctes="$(printf '%s' "$t" | awk '{ n += gsub(/[a-z_][a-z0-9_]*[[:space:]]+as[[:space:]]*(not[[:space:]]+materialized[[:space:]]*|materialized[[:space:]]*)?\(/, "&") } END { print n + 0 }')"
  [[ "$ctes" -ge 2 ]] || fail "use at least two named CTEs (name AS ( ... )); found $ctes"
  grade_rows query.sql ordered "per-customer settlement summary ($from .. $to)" <<SQL || true
WITH delivered AS (
  SELECT id, customer_id, total FROM orders
  WHERE status = 'delivered' AND deleted_at IS NULL
    AND created_at >= date '$from' AND created_at < date '$to' + 1
),
units AS (
  SELECT order_id, sum(qty) AS units FROM order_items GROUP BY order_id
),
per_customer AS (
  SELECT d.customer_id, count(*) AS delivered_orders,
         coalesce(sum(u.units), 0) AS item_units, sum(d.total) AS gross
  FROM delivered d LEFT JOIN units u ON u.order_id = d.id
  GROUP BY d.customer_id
)
SELECT c.id, c.name, p.delivered_orders, p.item_units, p.gross
FROM per_customer p JOIN customers c ON c.id = p.customer_id
ORDER BY p.gross DESC, c.id;
SQL
fi

pass "CTE settlement summary"
