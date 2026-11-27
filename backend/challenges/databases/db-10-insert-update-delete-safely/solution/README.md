# Solution — INSERT, UPDATE, DELETE Safely

Read your ticket for the customer, total, order number.

```bash
psql
```

## 1. INSERT ... RETURNING

```sql
INSERT INTO orders (customer_id, status, total)
VALUES (17, 'pending', 640)
RETURNING id;
```

`RETURNING` hands back the generated id without a second query. Save just the number:

```bash
echo 221 > ~/answers/new_order_id.txt
```

## 2. UPDATE exactly one row

Look first:

```sql
SELECT id, status FROM orders WHERE id = 57;
```

Then change it:

```sql
UPDATE orders SET status = 'confirmed' WHERE id = 57 RETURNING id, status;
```

You should see `UPDATE 1`. If you see anything else, `ROLLBACK` if you opened a transaction.

## 3. Soft delete

```sql
BEGIN;
SELECT count(*) FROM orders WHERE status = 'cancelled' AND deleted_at IS NULL;
UPDATE orders SET deleted_at = now()
WHERE status = 'cancelled' AND deleted_at IS NULL;
-- check the row count Postgres reports, then:
COMMIT;
```

A soft delete keeps the row (history, refunds, audits) and hides it from the app with a timestamp. `DELETE FROM orders ...` would lose that history.

## 4. Verify

```sql
SELECT count(*) FROM orders WHERE status = 'cancelled' AND deleted_at IS NULL;  -- 0
SELECT count(*) FROM orders WHERE status <> 'cancelled' AND deleted_at IS NOT NULL;  -- 0
```

Then **Submit**.
