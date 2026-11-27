# Solution — Add an Index: Speed Up Search

## 1. See the problem

Use the customer id from your ticket:

```sql
EXPLAIN ANALYZE
SELECT id, status, total, created_at FROM orders WHERE customer_id = 1234;
```

```text
Seq Scan on orders  (cost=0.00..6197.00 rows=120 ...)
  Filter: (customer_id = 1234)
  Rows Removed by Filter: 299880
Execution Time: ~30 ms
```

`Seq Scan` means Postgres read every row. `Rows Removed by Filter` shows how much work was thrown away.

## 2. Create the index

```sql
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
```

Check it exists:

```sql
\d orders
```

## 3. See the fix

```sql
EXPLAIN ANALYZE
SELECT id, status, total, created_at FROM orders WHERE customer_id = 1234;
```

```text
Bitmap Heap Scan on orders ...
  ->  Bitmap Index Scan on idx_orders_customer_id
        Index Cond: (customer_id = 1234)
Execution Time: ~0.2 ms
```

If the planner still seq-scans (rare on a fresh table), run `ANALYZE orders;` so it has fresh statistics.

## Trade-offs

- Indexes speed up reads on that column and slow down writes slightly (each `INSERT`/`UPDATE` maintains them) and use disk.
- Index the columns you filter, join, or sort on a lot, not every column.

Then **Submit**.
