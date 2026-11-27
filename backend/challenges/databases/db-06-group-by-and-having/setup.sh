#!/usr/bin/env bash
# Customers with more than N orders; N is derived from the seeded data so the answer is
# neither empty nor everybody.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_CUSTOMERS=40 SEED_ORDERS=400 SEED_DAYS=14 SEED_ORPHANS=8 seed_core

median="$(sql_scalar <<'SQL'
SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY n)
FROM (SELECT count(*) AS n FROM orders WHERE customer_id BETWEEN 1 AND 40 GROUP BY customer_id) t;
SQL
)"
N=$(( median + $(rand_between 0 2) ))
write_seed min-orders "$N"

write_ticket <<TICKET
# Ticket: Our regulars

Marketing wants to send a thank-you code to customers who order a lot.

## Task

Find every customer with **more than $N orders** (count all of their orders, any status).

Output columns, in this order: \`customer_id\`, \`name\`, \`order_count\`
Sort by \`order_count\` descending, then \`customer_id\` ascending.
Do not change any data.

Hints:

- Group the orders by customer, then filter the **groups** with \`HAVING\`.
- Join to \`customers\` for the name. Orders that point at a missing customer are not
  customers, so they must not appear.

Save the SQL to:

    ~/answers/query.sql
TICKET

ok "QuickBite seeded (threshold: more than $N orders)"
