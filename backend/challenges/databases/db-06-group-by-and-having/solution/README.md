# Solution — GROUP BY and HAVING

## 1. Read N from the ticket

```bash
cat ~/ticket/TASK.md
```

## 2. Aggregate, then filter the groups

```sql
SELECT c.id AS customer_id,
       c.name,
       COUNT(*) AS order_count
FROM orders o
JOIN customers c ON c.id = o.customer_id
GROUP BY c.id, c.name
HAVING COUNT(*) > 12
ORDER BY order_count DESC, c.id;
```

- `WHERE` runs before grouping and sees rows; `HAVING` runs after and sees aggregates. `WHERE COUNT(*) > 12` is an error.
- Every selected column must be in `GROUP BY` or inside an aggregate.
- The inner join to `customers` also drops the orphan orders from the earlier labs.
- "More than 12" means `> 12`, not `>=`.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql
```

Then **Submit**.
