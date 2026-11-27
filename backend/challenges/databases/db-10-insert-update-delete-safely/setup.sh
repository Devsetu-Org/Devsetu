#!/usr/bin/env bash
# Three data changes with per-session values: insert + RETURNING id, a targeted UPDATE,
# and a soft delete of cancelled orders. Graded on database state.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_CUSTOMERS=40 SEED_ORDERS=220 SEED_DAYS=10 seed_core

CUSTOMER="$(rand_between 1 40)"
TOTAL="$(rand_between 25 95)0"          # 250..950
X_ORDER="$(sql_scalar <<'SQL'
SELECT id FROM orders WHERE status = 'pending' AND customer_id BETWEEN 1 AND 40 ORDER BY random() LIMIT 1;
SQL
)"
MAXID="$(echo 'SELECT max(id) FROM orders;' | sql_scalar)"
COUNT="$(echo 'SELECT count(*) FROM orders;' | sql_scalar)"
CANCELLED="$(echo "SELECT count(*) FROM orders WHERE status = 'cancelled';" | sql_scalar)"
BASE="$(sql_scalar <<SQL
SELECT md5(string_agg(id || '|' || coalesce(customer_id::text, '') || '|' || status || '|' || total || '|' || created_at, ',' ORDER BY id))
FROM orders WHERE id <> $X_ORDER;
SQL
)"
write_seed params "$CUSTOMER $TOTAL $X_ORDER $MAXID $COUNT $CANCELLED $BASE"

write_ticket <<TICKET
# Ticket: Three small changes, zero collateral damage

Ops has three data fixes for \`orders\`. Do them in \`psql\`, carefully: every statement
should touch **exactly** the rows it is meant to.

## 1. INSERT a new order

Customer **$CUSTOMER** placed a phone order: add a row to \`orders\` with

- \`customer_id = $CUSTOMER\`
- \`status = 'pending'\`
- \`total = $TOTAL\`

(\`created_at\` defaults to now.) Use \`INSERT ... RETURNING id\` and save the returned id,
just the number, to:

    ~/answers/new_order_id.txt

## 2. UPDATE one order

Order **#$X_ORDER** has been confirmed by the restaurant: set its \`status\` to
\`'confirmed'\`. Only that order.

## 3. Soft-delete cancelled orders

We never physically delete orders. Mark **every order with \`status = 'cancelled'\`** as
deleted by setting \`deleted_at = now()\`. Do not use \`DELETE\`.

## Stay safe

- Run a \`SELECT\` with the same \`WHERE\` first and look at the rows.
- \`BEGIN;\` ... check ... \`COMMIT;\` (or \`ROLLBACK;\`) is cheap insurance.
- An \`UPDATE\` without \`WHERE\` rewrites the whole table.

The grader checks the database, not a script.
TICKET

ok "QuickBite seeded (customer $CUSTOMER, order #$X_ORDER, $CANCELLED cancelled)"
