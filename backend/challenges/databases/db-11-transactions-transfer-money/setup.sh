#!/usr/bin/env bash
# Wallet transfer: grader runs ~/answers/transfer.sql twice — once with enough balance,
# once without — and checks that money is conserved both times.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_ORDERS=120 SEED_DAYS=8 seed_core

sql_learner <<'SQL'
CREATE TABLE wallets (
  id          serial PRIMARY KEY,
  customer_id integer NOT NULL UNIQUE,
  balance     numeric(12,2) NOT NULL,
  CONSTRAINT wallets_balance_nonneg CHECK (balance >= 0)
);
INSERT INTO wallets (customer_id, balance)
SELECT id, 500 + floor(random() * 2500) FROM customers;
SQL

FROM_W="$(rand_between 1 20)"
TO_W="$(rand_between 21 40)"
AMOUNT="$(rand_between 10 40)0"                      # 100..400
BAL_A="$(echo "SELECT balance FROM wallets WHERE id = $FROM_W;" | sql_scalar)"
BAL_B="$(echo "SELECT balance FROM wallets WHERE id = $TO_W;" | sql_scalar)"
OTHERS="$(sql_scalar <<SQL
SELECT md5(string_agg(id || ':' || balance, ',' ORDER BY id)) FROM wallets WHERE id NOT IN ($FROM_W, $TO_W);
SQL
)"
write_seed params "$FROM_W $TO_W $AMOUNT $BAL_A $BAL_B $OTHERS"

write_ticket <<TICKET
# Ticket: Move money between wallets — all or nothing

QuickBite wallets hold customer credit. Refund payouts and wallet-to-wallet gifts are a
transfer: **debit one wallet, credit another**. If anything fails halfway, money must not
appear or vanish.

\`\`\`
wallets(id, customer_id, balance)      -- CHECK (balance >= 0)
\`\`\`

## Task

Write a script that moves **₹$AMOUNT** from **wallet #$FROM_W** to **wallet #$TO_W**
**atomically**:

- the debit and the credit happen together, or not at all
- if the source wallet cannot cover the amount, **neither** wallet changes
- no other wallet may change

Use an explicit transaction (\`BEGIN\` ... \`COMMIT\`). The script must be written for
those two wallet ids and that amount.

Save it to:

    ~/answers/transfer.sql

## How it is graded

The grader runs your script with plain \`psql -f\` (it **keeps going** after an error, like
a terminal does). It runs it twice:

1. with both wallets as seeded: wallet #$FROM_W must lose $AMOUNT and wallet #$TO_W gain $AMOUNT;
2. with wallet #$FROM_W topped down to \`$AMOUNT - 1\`: the debit hits the \`CHECK\`
   constraint, and **both** wallets must stay exactly as they were.

Test it yourself first (then put the balances back with \`UPDATE\`, or just let the grader reset them).
TICKET

ok "wallets seeded (#$FROM_W -> #$TO_W, ₹$AMOUNT)"
