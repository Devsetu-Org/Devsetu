#!/usr/bin/env bash
# Add orders.delivery_instructions as a re-runnable migration with a small backfill.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_ORDERS=180 SEED_DAYS=10 seed_core

PHRASES=("Leave at the gate" "Ring the bell twice" "Hand to security desk" "Call on arrival" "Leave with neighbour" "Do not ring, baby asleep")
PHRASE="${PHRASES[$((RANDOM % ${#PHRASES[@]}))]}"
ROWS="$(echo 'SELECT count(*) FROM orders;' | sql_scalar)"
BASE="$(sql_scalar <<'SQL'
SELECT md5(string_agg(id || '|' || coalesce(customer_id::text, '') || '|' || status || '|' || total || '|' || created_at, ',' ORDER BY id)) FROM orders;
SQL
)"
write_seed phrase "$PHRASE"
write_seed base "$ROWS $BASE"

write_ticket <<TICKET
# Ticket: Delivery instructions

Riders keep missing the "leave at the gate" notes customers type at checkout. Product has
approved a new field on every order.

## Task

Write a **migration** and run it against the \`quickbite\` database:

1. Add a column \`delivery_instructions\` of type \`TEXT\` to \`orders\` (nullable, no default).
2. Backfill: every order with \`status = 'pending'\` gets
   \`delivery_instructions = '$PHRASE'\`. All other orders stay \`NULL\`.
3. The migration must be **safe to run twice** (use \`IF NOT EXISTS\`): deploy scripts
   re-run migrations.

Put it in:

    ~/answers/migration.sql

then **apply** it:

    psql -f ~/answers/migration.sql

## How it is graded

The grader checks the column and the backfill, then **drops the column, re-runs your
\`migration.sql\` from scratch, and runs it a second time** — both runs must succeed. No
existing order data may change.
TICKET

ok "QuickBite seeded ($ROWS orders; backfill text '$PHRASE')"
