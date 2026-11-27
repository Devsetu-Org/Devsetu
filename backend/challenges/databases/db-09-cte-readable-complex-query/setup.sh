#!/usr/bin/env bash
# Settlement-style per-customer summary that needs three derived tables; learner writes it
# with WITH clauses.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
FROM_DATE="$(in_box "date -u -d '$BIZ_DATE -$(rand_between 5 9) days' +%F")"
write_seed biz-date "$BIZ_DATE"
write_seed from-date "$FROM_DATE"
SEED_ORDERS=360 SEED_DAYS=16 seed_core

write_ticket <<TICKET
# Ticket: Settlement summary, readable this time

The old settlement query is one 60-line nest of subqueries nobody dares touch. Rewrite it
the readable way, with \`WITH\` (common table expressions).

## Task

For orders created from **$FROM_DATE** through **$BIZ_DATE** (inclusive) that are
**delivered** (\`status = 'delivered'\`) and not soft-deleted (\`deleted_at IS NULL\`),
produce one row per customer:

| column | meaning |
| --- | --- |
| \`customer_id\` | \`customers.id\` |
| \`name\` | \`customers.name\` |
| \`delivered_orders\` | number of those orders |
| \`item_units\` | total \`qty\` across the items of those orders |
| \`gross\` | sum of \`orders.total\` for those orders |

Sort by \`gross\` descending, then \`customer_id\` ascending.

Rules:

- Build it from **at least two named CTEs** (\`WITH a AS (...), b AS (...) SELECT ...\`),
  for example delivered orders, units per order, and the per-customer rollup.
- Customers only: orders pointing at a missing customer are not part of the report.
- Careful: joining \`orders\` to \`order_items\` **before** summing multiplies each order's
  \`total\` by its item count. Aggregate items per order first.
- Do not change any data.

Save the SQL to:

    ~/answers/query.sql
TICKET

ok "QuickBite seeded (window $FROM_DATE .. $BIZ_DATE)"
