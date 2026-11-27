#!/usr/bin/env bash
# Running spend per customer for three customers picked per session.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
C1="$(rand_between 1 13)"; C2="$(rand_between 14 26)"; C3="$(rand_between 27 40)"
write_seed customers "$C1,$C2,$C3"
SEED_CUSTOMERS=40 SEED_ORDERS=500 SEED_DAYS=20 seed_core

write_ticket <<TICKET
# Ticket: Customer lifetime spend, order by order

The loyalty team wants to see **how a customer's spend builds up over time** to decide
when to hand out tier upgrades.

## Task

For customers **$C1**, **$C2** and **$C3** only, list every non-cancelled order
(\`status <> 'cancelled'\`) with a **running total** of that customer's spend, oldest
order first.

Output columns, in this order:

| column | meaning |
| --- | --- |
| \`customer_id\` | the customer |
| \`order_id\` | \`orders.id\` |
| \`total\` | the order's total |
| \`running_total\` | sum of \`total\` for this customer's orders up to and including this one, ordered by \`created_at\` |

Sort by \`customer_id\`, then \`created_at\` ascending. Do not change any data.

Use a window function: \`SUM(total) OVER (PARTITION BY ... ORDER BY ...)\`. Collapsing
rows with \`GROUP BY\` would lose the per-order lines.

Save the SQL to:

    ~/answers/query.sql
TICKET

ok "QuickBite seeded (customers $C1, $C2, $C3)"
