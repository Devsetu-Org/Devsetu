# Solution — Transactions: Transfer Money

## 1. The problem

A transfer is two writes. If the debit succeeds and the credit never runs (crash, constraint, bug), money disappears. If the credit runs and the debit fails, money is created.

A **transaction** makes the writes one unit: `COMMIT` keeps both, and an error or `ROLLBACK` throws both away.

## 2. The script

Use the wallet ids and amount from **your** ticket:

```sql
BEGIN;

UPDATE wallets SET balance = balance - 250 WHERE id = 7;
UPDATE wallets SET balance = balance + 250 WHERE id = 31;

COMMIT;
```

## 3. Why the rollback case works

`wallets` has `CHECK (balance >= 0)`. If wallet 7 holds less than 250, the first `UPDATE` fails with a constraint violation. Postgres marks the whole transaction as aborted:

- the second `UPDATE` is rejected ("current transaction is aborted, commands ignored until end of transaction block")
- `COMMIT` on an aborted transaction performs a `ROLLBACK`
- both wallets keep their old balance

Without `BEGIN`, each statement commits on its own. The failed debit would be skipped but the credit would still run: money from nowhere. That is what the grader's second run checks.

## 4. Use relative updates

`SET balance = balance - 250` runs against the current value inside the transaction. Reading the balance first in your client and writing `SET balance = 1750` loses concurrent updates.

## 5. Test it

```bash
psql -c "SELECT id, balance FROM wallets WHERE id IN (7, 31);"
psql -f ~/answers/transfer.sql
psql -c "SELECT id, balance FROM wallets WHERE id IN (7, 31);"
```

The grader resets the balances itself. Then **Submit**.
