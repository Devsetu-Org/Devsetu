#!/usr/bin/env bash
# Legacy import left orders with a NULL or dangling customer_id. Find them with LEFT JOIN.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
ORPHANS="$(rand_between 7 14)"
write_seed orphans "$ORPHANS"
SEED_ORDERS=280 SEED_DAYS=14 SEED_ORPHANS="$ORPHANS" seed_core

write_ticket <<TICKET
# Ticket: Orders with no customer

Finance can't reconcile: some rows in \`orders\` point at customers that do not exist
in \`customers\`. The old import tool left them behind — some have a \`NULL\`
\`customer_id\`, others reference an id that was never created.

## Task

List every **orphan order**: an order with no matching row in \`customers\`.

Output columns, in this order: \`id\`, \`customer_id\`, \`total\`
Sort by \`id\` ascending. Do not change any data.

Use a **LEFT JOIN** from \`orders\` to \`customers\` and keep the rows where the customer side
is missing (\`... IS NULL\`).

Save the SQL to:

    ~/answers/query.sql

(Hint: do not test \`o.customer_id IS NULL\` — that misses the dangling ids.)
TICKET

ok "QuickBite seeded ($ORPHANS orphan orders)"
