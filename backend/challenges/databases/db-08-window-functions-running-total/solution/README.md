# Solution — Window Functions: Running Total

## 1. Why not GROUP BY?

`GROUP BY customer_id` gives one row per customer. A **window function** computes an aggregate over a set of related rows but **keeps every row**.

## 2. SUM() OVER (PARTITION BY ... ORDER BY ...)

```sql
SELECT customer_id,
       id AS order_id,
       total,
       SUM(total) OVER (
         PARTITION BY customer_id
         ORDER BY created_at
       ) AS running_total
FROM orders
WHERE status <> 'cancelled'
  AND customer_id IN (4, 17, 33)
ORDER BY customer_id, created_at;
```

- `PARTITION BY customer_id` restarts the running total for each customer.
- `ORDER BY created_at` inside `OVER` sets the accumulation order. With an `ORDER BY`, the default frame is "start of partition up to the current row".
- The `WHERE` clause filters rows **before** the window runs, so cancelled orders never count toward the total.
- The final `ORDER BY` is separate: it sorts the output.

Use the three customer ids from **your** ticket.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql | head -20
```

Then **Submit**.
