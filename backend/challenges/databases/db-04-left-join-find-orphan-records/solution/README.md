# Solution — LEFT JOIN: Find Orphan Records

## 1. Why an inner join can't find them

An inner join keeps only rows that match on both sides, so orders with no customer vanish. A `LEFT JOIN` keeps **every** order and fills the customer columns with `NULL` when nothing matches.

## 2. Anti-join pattern

```sql
SELECT o.id, o.customer_id, o.total
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
WHERE c.id IS NULL
ORDER BY o.id;
```

- Test the **right-hand** side (`c.id IS NULL`), not `o.customer_id IS NULL`. Orders whose `customer_id` is a dangling number (say `90042`) still have a non-null `customer_id`, but no customer row.
- `NOT EXISTS (SELECT 1 FROM customers ...)` is an equivalent anti-join; this lab asks for the LEFT JOIN form.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql
```

Then **Submit**.
