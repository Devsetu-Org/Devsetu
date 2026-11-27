# Solution — Capstone: Settlement Report

## 1. The shape of the problem

The report is **one row per day**, but the source data is one row per order, several rows per order in `order_items`, and one or two rows per order in `payments`. Joining those straight onto orders **multiplies** each order's `total` (once per item, once per payment attempt). The fix is to collapse each child table to **one row per order** first.

## 2. Build it in steps with CTEs

Use the dates from **your** ticket:

```sql
WITH in_scope AS (
  SELECT o.id, o.created_at::date AS day, o.customer_id, o.total
  FROM orders o
  JOIN customers c ON c.id = o.customer_id          -- drops orphan orders
  WHERE o.status = 'delivered'
    AND o.deleted_at IS NULL
    AND o.created_at >= DATE '2026-11-02'
    AND o.created_at <  DATE '2026-11-10' + 1
),
units AS (                                           -- one row per order
  SELECT order_id, SUM(qty) AS units
  FROM order_items
  GROUP BY order_id
),
paid AS (                                            -- one row per order
  SELECT order_id,
         SUM(amount) FILTER (WHERE status = 'captured') AS captured
  FROM payments
  GROUP BY order_id
),
daily AS (
  SELECT s.day,
         COUNT(*)                     AS orders,
         COUNT(DISTINCT s.customer_id) AS customers,
         COALESCE(SUM(u.units), 0)    AS item_units,
         SUM(s.total)                 AS revenue,
         COALESCE(SUM(p.captured), 0) AS captured
  FROM in_scope s
  LEFT JOIN units u ON u.order_id = s.id
  LEFT JOIN paid  p ON p.order_id = s.id
  GROUP BY s.day
)
SELECT day, orders, customers, item_units, revenue, captured,
       SUM(revenue) OVER (ORDER BY day)       AS running_revenue,
       RANK()       OVER (ORDER BY revenue DESC) AS revenue_rank
FROM daily
ORDER BY day;
```

## 3. Why each decision

- **Per-order CTEs (`units`, `paid`)** prevent fan-out. Summing `orders.total` after a raw join to items would overcount.
- **`LEFT JOIN`** to `units` and `paid`: a delivered order with no captured payment must still count in `orders` and `revenue`.
- **`FILTER (WHERE status = 'captured')`** ignores the failed attempt without losing the order row.
- **`COUNT(DISTINCT customer_id)`** gives unique customers per day.
- **Window functions run after `GROUP BY`**: `SUM(revenue) OVER (ORDER BY day)` is the running total across the daily rows, and `RANK() OVER (ORDER BY revenue DESC)` ranks the days.
- Pre-aggregating also makes the query fast: the database sums each child table once instead of building a huge join first.

## 4. Check it

```bash
nano ~/answers/report.sql
time psql -f ~/answers/report.sql
```

Sanity check: `revenue` for a day should equal `SELECT SUM(total) FROM orders WHERE ...` for the same filters. If yours is larger, you have a fan-out.

Then **Submit**.
