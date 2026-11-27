# Solution — Your First SELECT

## 1. Read the ticket

```bash
cat ~/ticket/TASK.md
```

Note the business date. It is different in every session.

## 2. Look around

```bash
psql
```

```sql
\dt
\d orders
SELECT * FROM orders LIMIT 5;
```

`created_at` is a `timestamp`, so "the whole day" means from midnight up to (but not including) the next midnight.

## 3. Write the query

Replace the date with the one from your ticket:

```sql
SELECT id, status, total
FROM orders
WHERE created_at >= DATE '2026-11-03'
  AND created_at <  DATE '2026-11-03' + 1
ORDER BY id;
```

`created_at::date = '2026-11-03'` also returns the right rows. The range form is the habit to build: it lets Postgres use an index on `created_at` later.

## 4. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql
```

Then **Submit**.
