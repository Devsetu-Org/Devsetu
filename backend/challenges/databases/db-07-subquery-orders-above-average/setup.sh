#!/usr/bin/env bash
# Orders above the average order value (cancelled excluded from both sides).
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
FROM_DATE="$(in_box "date -u -d '$BIZ_DATE -$(rand_between 4 8) days' +%F")"
write_seed biz-date "$BIZ_DATE"
write_seed from-date "$FROM_DATE"
SEED_ORDERS=300 SEED_DAYS=14 seed_core

write_ticket <<TICKET
# Ticket: Above-average orders

Growth wants to study "big basket" orders — anything above what a typical order is worth.

## Task

Using only orders created from **$FROM_DATE** through **$BIZ_DATE** (inclusive) and
ignoring cancelled ones (\`status <> 'cancelled'\`):

Return every order whose \`total\` is **strictly greater than the average \`total\`** of
those same orders.

Output columns, in this order: \`id\`, \`total\`
Sort by \`total\` descending, then \`id\` ascending. Do not change any data.

Use a **subquery** for the average (don't paste the number in by hand — it changes with
the data).

Save the SQL to:

    ~/answers/query.sql
TICKET

ok "QuickBite seeded (window $FROM_DATE .. $BIZ_DATE)"
