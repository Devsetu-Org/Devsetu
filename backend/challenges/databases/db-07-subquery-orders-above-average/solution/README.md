# Solution — Subquery: Orders Above Average

## 1. Same filter on both sides

The ticket defines "typical" using the **same** rows you are filtering: orders in the date window, not cancelled. The average and the outer query must use the same filter or the comparison is meaningless.

## 2. A scalar subquery in WHERE

```sql
SELECT id, total
FROM orders
WHERE status <> 'cancelled'
  AND created_at >= DATE '2026-11-01'
  AND created_at <  DATE '2026-11-07' + 1
  AND total > (
    SELECT AVG(total)
    FROM orders
    WHERE status <> 'cancelled'
      AND created_at >= DATE '2026-11-01'
      AND created_at <  DATE '2026-11-07' + 1
  )
ORDER BY total DESC, id;
```

- The inner query returns a single value (the average), so it can sit on the right of `>`.
- Hard-coding the average would work today and break tomorrow.
- A CTE (`WITH avg_total AS (...)`) is a fine rewrite when the same subquery repeats.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql
```

Then **Submit**.
