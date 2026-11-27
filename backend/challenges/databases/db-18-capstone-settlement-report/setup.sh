#!/usr/bin/env bash
# Capstone: a daily settlement report over orders + customers + order_items + payments, with
# fan-out traps (items, retried payments) and window functions.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 3 30)"
FROM_DATE="$(in_box "date -u -d '$BIZ_DATE -$(rand_between 7 11) days' +%F")"
write_seed biz-date "$BIZ_DATE"
write_seed from-date "$FROM_DATE"
SEED_CUSTOMERS=60 SEED_ORDERS=1600 SEED_DAYS=22 SEED_ORPHANS=14 seed_core

sql_learner <<'SQL'
CREATE TABLE payments (
  id       serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id),
  method   text NOT NULL,
  amount   numeric(10,2) NOT NULL,
  status   text NOT NULL,            -- 'captured' | 'failed'
  paid_at  timestamp NOT NULL
);
-- a quarter of orders had a failed first attempt
INSERT INTO payments (order_id, method, amount, status, paid_at)
SELECT id, (ARRAY['upi','card','wallet'])[1 + floor(random() * 3)::int], total, 'failed', created_at + interval '1 minute'
FROM orders WHERE status IN ('delivered', 'confirmed', 'pending') AND random() < 0.25;
-- most delivered orders were captured eventually (about 1 in 10 never were)
INSERT INTO payments (order_id, method, amount, status, paid_at)
SELECT id, (ARRAY['upi','card','wallet'])[1 + floor(random() * 3)::int], total, 'captured', created_at + interval '3 minutes'
FROM orders WHERE status = 'delivered' AND random() < 0.9;
CREATE INDEX payments_order_id_idx ON payments (order_id);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
ANALYZE payments;
ANALYZE order_items;
SQL

write_ticket <<TICKET
# Ticket (capstone): The daily settlement report

Finance closes the books on **$FROM_DATE** through **$BIZ_DATE** (inclusive). They need one
row per day with revenue, what was actually collected, and how each day compares with the
others. One query, four tables.

\`\`\`
customers(id, name, email)
orders(id, customer_id, status, total, created_at, deleted_at)
order_items(id, order_id, sku, qty, price)
payments(id, order_id, method, amount, status, paid_at)   -- status: 'captured' | 'failed'
\`\`\`

## In scope

- Orders created from **$FROM_DATE** through **$BIZ_DATE** (whole days)
- \`status = 'delivered'\` and \`deleted_at IS NULL\`
- Only orders whose customer exists in \`customers\` (orphans are excluded)

## Output (one row per day that has in-scope orders)

| column | meaning |
| --- | --- |
| \`day\` | the date of \`created_at\` |
| \`orders\` | number of in-scope orders that day |
| \`customers\` | number of **distinct** customers who ordered that day |
| \`item_units\` | total \`qty\` of the items on those orders |
| \`revenue\` | sum of \`orders.total\` for those orders |
| \`captured\` | sum of \`payments.amount\` where \`payments.status = 'captured'\` for those orders (0 if none) |
| \`running_revenue\` | cumulative \`revenue\` from the first day in the report through this day |
| \`revenue_rank\` | \`RANK()\` of the day by \`revenue\`, highest = 1 |

Sort by \`day\` ascending.

## Traps

- \`order_items\` has several rows per order and \`payments\` can have **two** rows (a
  failed attempt, then a captured one). Joining them straight onto orders multiplies
  \`orders.total\`. **Aggregate items and payments per order first** (CTEs), then join.
- Some delivered orders have **no captured payment**: they still count toward
  \`orders\` and \`revenue\`.
- Use window functions for \`running_revenue\` and \`revenue_rank\`.

The query must finish in **under 2 seconds**. Do not change any data. Alias output
columns with \`AS\` (for example \`o.created_at::date AS day\`).

Save it to:

    ~/answers/report.sql
TICKET

ok "capstone data seeded (window $FROM_DATE .. $BIZ_DATE)"
