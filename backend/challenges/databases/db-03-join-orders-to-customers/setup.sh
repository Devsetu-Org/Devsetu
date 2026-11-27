#!/usr/bin/env bash
# Inner join orders -> customers. A few legacy orders point at missing customers; an
# inner join silently drops them (that is the point of the next lab).
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
FROM_DATE="$(in_box "date -u -d '$BIZ_DATE -3 days' +%F")"
write_seed from-date "$FROM_DATE"
write_seed biz-date "$BIZ_DATE"
SEED_ORDERS=260 SEED_DAYS=14 SEED_ORPHANS=8 seed_core

write_ticket <<TICKET
# Ticket: Who ordered what?

The receipts email job needs the customer's name and email next to each order.
Customer data lives in \`customers\`, orders in \`orders\` (\`orders.customer_id\` →
\`customers.id\`).

## Task

Return every order created from **$FROM_DATE** through **$BIZ_DATE** (inclusive, whole
days) together with the customer who placed it.

Output columns, in this order:

| column | meaning |
| --- | --- |
| \`order_id\` | \`orders.id\` |
| \`name\` | \`customers.name\` |
| \`email\` | \`customers.email\` |

Use an **inner join** on the customer id. Sort by \`order_id\` ascending. Do not change any data.

Save the SQL to:

    ~/answers/query.sql
TICKET

ok "QuickBite seeded (orders $FROM_DATE .. $BIZ_DATE)"
