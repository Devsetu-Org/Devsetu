# Solution — Schema Migration: Add a Column

## 1. What a migration is

A migration is a **script under version control** that moves the schema from one state to the next, so every environment (your laptop, staging, prod) gets the same change in the same order. You never hand-edit production in a psql prompt and forget what you did.

## 2. Write it re-runnable

Use the backfill text from your ticket:

```sql
-- 2026-11: add delivery instructions
BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

UPDATE orders
SET delivery_instructions = 'Leave at the gate'
WHERE status = 'pending';

COMMIT;
```

- `ADD COLUMN IF NOT EXISTS` makes the DDL a no-op on the second run.
- `TEXT`, nullable, no default: existing rows get `NULL` instantly, with no table rewrite.
- The `UPDATE` is idempotent: running it again writes the same value to the same rows.
- Wrapping it in `BEGIN`/`COMMIT` means a failure halfway does not leave a half-migrated table (Postgres DDL is transactional).

## 3. Apply and verify

```bash
nano ~/answers/migration.sql
psql -f ~/answers/migration.sql
psql -f ~/answers/migration.sql     # run it again: must not error
```

```sql
\d orders
SELECT status, count(*), count(delivery_instructions) FROM orders GROUP BY status;
```

Only the `pending` row counts should be non-zero in the last column. Then **Submit**.
