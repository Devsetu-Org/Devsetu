# Solution — When SQL, When NoSQL

## 1. Decide per access pattern, not per religion

Ask what the query does most:

| The pattern is mostly... | Fits | Why |
| --- | --- | --- |
| ad-hoc questions, reports, **joins and aggregates** across entities | **relational** | SQL joins, `GROUP BY`, indexes on any column, questions you did not plan for |
| **multi-row updates that must be all-or-nothing**, balances, constraints | **relational** | ACID transactions, `CHECK`/`FOREIGN KEY` constraints enforced by the database |
| load **one aggregate** (an order with its items) in **one read** by key | **document** | nested data is stored together: one read, no joins |
| **varying / evolving shape** (menu attributes, webhook payloads) | **document** | flexible schema: new fields need no migration |

## 2. Example answer

If Pattern A were the wallet transfer and Pattern B the single-read order page (yours will differ; use **your** two patterns and your review code):

```markdown
REVIEW CODE: DB17-4821
PATTERN A: relational
WHY A: A transfer is two updates that must commit together; Postgres transactions and a CHECK constraint keep balances correct and never half-applied (ACID).
PATTERN B: document
WHY B: The order page always reads one order with its items by id, so a single nested document is one read with no joins and good locality.
TRADE-OFFS: Relational gives joins, constraints and transactions but needs a fixed schema and migrations; documents give a flexible schema and fast single reads but duplicate (denormalised) data, so cross-order reports and consistency are harder.
```

## 3. Try both in psql

```sql
SELECT o.id, o.total, i.sku, i.qty FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = 10;
SELECT doc FROM order_docs WHERE doc ->> 'order_id' = '10';
SELECT status, count(*), sum(total) FROM orders GROUP BY status;                 -- natural in SQL
SELECT doc ->> 'status', count(*), sum((doc ->> 'total')::numeric) FROM order_docs GROUP BY 1;  -- possible, clumsier
```

## 4. Rules of thumb

- Start relational: you get joins, constraints and transactions for free, and `jsonb` covers a surprising amount of "flexible" data.
- Choose documents when the shape varies or the data is always read and written as one aggregate.
- Many systems use both. Postgres already stores each pattern here.

Save the file to `~/answers/recommendation.md`, then **Submit**.
