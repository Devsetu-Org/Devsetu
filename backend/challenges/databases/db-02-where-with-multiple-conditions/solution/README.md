# Solution — WHERE with Multiple Conditions

## 1. Read the threshold

```bash
cat ~/ticket/TASK.md
```

The rupee threshold is different every session (400–900).

## 2. Combine conditions with AND

```sql
SELECT id, customer_id, total, created_at
FROM orders
WHERE status = 'pending'
  AND total > 650
ORDER BY created_at DESC;
```

- `>` is **strictly** greater: an order of exactly 650.00 must not appear.
- `ORDER BY created_at DESC` puts the newest first. Without `ORDER BY`, Postgres returns rows in no promised order.
- Text values use single quotes: `'pending'`. Double quotes are for identifiers.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql
```

Then **Submit**.
