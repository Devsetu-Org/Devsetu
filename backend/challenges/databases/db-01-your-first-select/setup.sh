#!/usr/bin/env bash
# QuickBite Postgres with ~300 orders over 10 days. The ticket gives a per-session
# "business date"; the learner writes a SELECT for that day's orders.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 40)"
write_seed biz-date "$BIZ_DATE"
SEED_ORDERS=300 SEED_DAYS=10 seed_core

write_ticket <<TICKET
# Ticket: Your first SELECT

Ops is asking: "What did we take on **$BIZ_DATE**?" The numbers live in Postgres.

## Connect

You are the \`learner\` role. The database is \`quickbite\`:

    psql            # PGDATABASE is already set
    \\dt             # list tables
    \\d orders       # describe a table

## Task

Write a query that returns **every order created on $BIZ_DATE** (the whole calendar
day, 00:00 up to but not including the next midnight).

- Columns, in this order: \`id\`, \`status\`, \`total\`
- Sort by \`id\` ascending
- Do not change any data

Save the SQL to:

    ~/answers/query.sql

The grader runs your file and compares the rows with its own query.
TICKET

ok "QuickBite seeded (business date $BIZ_DATE)"
