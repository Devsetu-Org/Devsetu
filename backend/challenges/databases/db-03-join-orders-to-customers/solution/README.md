# Solution — JOIN Orders to Customers

## 1. Read the ticket

```bash
cat ~/ticket/TASK.md
```

You need the date range (inclusive) and the three output columns.

## 2. Inner join on the foreign key

```sql
SELECT o.id AS order_id, c.name, c.email
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.created_at >= DATE '2026-11-01'
  AND o.created_at <  DATE '2026-11-04' + 1
ORDER BY o.id;
```

- Alias the tables (`o`, `c`) so every column is unambiguous.
- `JOIN` means `INNER JOIN`: orders with no matching customer disappear from the result. That is exactly what the ticket asks for here, and why the next lab hunts for them.
- The end date is inclusive, so the upper bound is "end date + 1 day, exclusive".

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql | head
```

Then **Submit**.
