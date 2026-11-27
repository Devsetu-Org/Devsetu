#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

from="$(seed_value from-date)"; to="$(seed_value biz-date)"
[[ -n "$from" && -n "$to" ]] || fail "lab seed missing; reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

if need_sql report.sql; then
  for t in orders customers order_items payments; do
    sql_mentions report.sql "(^|[^a-z_])$t([^a-z_]|\$)" "the $t table (the report joins all four)" || true
  done
  sql_mentions report.sql 'over[[:space:]]*\(' "window functions (... OVER (...))" || true
  sql_mentions report.sql 'rank[[:space:]]*\(' "RANK() for revenue_rank" || true

  grade_rows report.sql ordered "daily settlement report ($from .. $to)" <<SQL || true
WITH o AS (
  SELECT o.id, o.created_at::date AS day, o.customer_id, o.total
  FROM orders o JOIN customers c ON c.id = o.customer_id
  WHERE o.status = 'delivered' AND o.deleted_at IS NULL
    AND o.created_at >= date '$from' AND o.created_at < date '$to' + 1
),
u AS (SELECT order_id, sum(qty) AS units FROM order_items GROUP BY order_id),
p AS (SELECT order_id, sum(amount) FILTER (WHERE status = 'captured') AS captured FROM payments GROUP BY order_id),
d AS (
  SELECT o.day, count(*) AS orders, count(DISTINCT o.customer_id) AS customers,
         coalesce(sum(u.units), 0) AS item_units, sum(o.total) AS revenue,
         coalesce(sum(p.captured), 0) AS captured
  FROM o LEFT JOIN u ON u.order_id = o.id LEFT JOIN p ON p.order_id = o.id
  GROUP BY o.day
)
SELECT day, orders, customers, item_units, revenue, captured,
       sum(revenue) OVER (ORDER BY day) AS running_revenue,
       rank() OVER (ORDER BY revenue DESC) AS revenue_rank
FROM d ORDER BY day;
SQL

  ms="$(answer_ms report.sql)"
  if [[ "$ms" -gt 2000 ]]; then
    fail "report.sql took ${ms} ms — it must finish in under 2 seconds (aggregate items and payments per order before joining)"
  else
    ok "report runs in ${ms} ms"
  fi
fi

pass "settlement report matches the reference"
