# Solution — EXPLAIN: Read the Query Plan

## 1. Read the "before" plan

```sql
EXPLAIN (ANALYZE)
SELECT id, status, total, created_at
FROM orders
WHERE customer_id = 1234 AND status = 'pending'
ORDER BY created_at DESC
LIMIT 20;
```

Typical output (read it from the **innermost / most indented** node outwards):

```text
Limit
  ->  Sort  (Sort Key: created_at DESC, Sort Method: top-N heapsort)
        ->  Seq Scan on orders
              Filter: ((customer_id = 1234) AND (status = 'pending'))
              Rows Removed by Filter: 299xxx
Execution Time: ~35 ms
```

Two problems:

1. **Seq Scan** — Postgres reads all 300,000 rows to keep ~35.
2. **Sort** — it then sorts those rows to answer `ORDER BY created_at DESC LIMIT 20`.

## 2. Make the index match the query

An index on `customer_id` alone fixes the scan but leaves the Sort. An index that includes the `ORDER BY` column returns rows already in order:

```sql
CREATE INDEX idx_orders_customer_created
  ON orders (customer_id, created_at DESC);
ANALYZE orders;
```

(`(customer_id, status, created_at DESC)` works too, and the `status = 'pending'` check can then be done inside the index.)

Rule of thumb: equality columns first, then the `ORDER BY` column.

## 3. Save the "after" plan

```bash
psql -c "EXPLAIN (ANALYZE) SELECT id, status, total, created_at FROM orders WHERE customer_id = 1234 AND status = 'pending' ORDER BY created_at DESC LIMIT 20;" > ~/answers/plan.txt
cat ~/answers/plan.txt
```

Now you should see:

```text
Limit
  ->  Index Scan using idx_orders_customer_created on orders
        Index Cond: (customer_id = 1234)
        Filter: (status = 'pending')
Execution Time: ~0.1 ms
```

No Seq Scan, no Sort. Use **your** customer id from the ticket, then **Submit**.
