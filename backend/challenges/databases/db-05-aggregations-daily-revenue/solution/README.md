# Solution — Aggregations: Daily Revenue

## 1. Read the window

```bash
cat ~/ticket/TASK.md
```

## 2. Bucket by day with GROUP BY

```sql
SELECT created_at::date AS day,
       COUNT(*)         AS orders,
       SUM(total)       AS revenue
FROM orders
WHERE status <> 'cancelled'
  AND created_at >= DATE '2026-11-01'
  AND created_at <  DATE '2026-11-07' + 1
GROUP BY created_at::date
ORDER BY day;
```

- `created_at::date` truncates the timestamp to a date; group by that same expression.
- `WHERE` filters rows **before** grouping, so cancelled orders never reach the aggregates.
- `COUNT(*)` counts rows per group, `SUM(total)` adds their totals.
- Don't `ROUND` the revenue unless you must: the grader compares exact sums.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql
```

Then **Submit**.
