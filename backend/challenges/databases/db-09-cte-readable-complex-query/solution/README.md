# Solution — CTE: Readable Complex Query

## 1. Name each step

A CTE is a named subquery you define up front with `WITH` and then use like a table. Break the report into steps:

1. `delivered` — the orders in scope
2. `units` — item quantity **per order**
3. `per_customer` — roll the orders up to one row per customer

## 2. Write it

```sql
WITH delivered AS (
  SELECT id, customer_id, total
  FROM orders
  WHERE status = 'delivered'
    AND deleted_at IS NULL
    AND created_at >= DATE '2026-11-01'
    AND created_at <  DATE '2026-11-09' + 1
),
units AS (
  SELECT order_id, SUM(qty) AS units
  FROM order_items
  GROUP BY order_id
),
per_customer AS (
  SELECT d.customer_id,
         COUNT(*)                  AS delivered_orders,
         COALESCE(SUM(u.units), 0) AS item_units,
         SUM(d.total)              AS gross
  FROM delivered d
  LEFT JOIN units u ON u.order_id = d.id
  GROUP BY d.customer_id
)
SELECT c.id AS customer_id, c.name,
       p.delivered_orders, p.item_units, p.gross
FROM per_customer p
JOIN customers c ON c.id = p.customer_id
ORDER BY p.gross DESC, c.id;
```

Why `units` is its own step: `order_items` has several rows per order. If you join items straight onto orders and then `SUM(total)`, each order's total is added once **per item**. Collapse items to one row per order first, then join.

The final inner join to `customers` drops orphan orders.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql | head
```

Then **Submit**.
