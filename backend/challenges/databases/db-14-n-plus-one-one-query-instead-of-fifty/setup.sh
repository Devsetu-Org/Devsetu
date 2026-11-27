#!/usr/bin/env bash
# Legacy order-history loader: 1 query for orders + 1 per order for items (N+1). Customer has
# exactly 50 orders, 3 of them with no items.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_CUSTOMERS=40 SEED_ORDERS=400 SEED_DAYS=20 seed_core

CUSTOMER="$(rand_between 1 40)"
sql_learner <<SQL
-- exactly 50 orders for this customer: move theirs away, then pull 50 random orders in
UPDATE orders SET customer_id = (customer_id % 40) + 1 WHERE customer_id = $CUSTOMER;
UPDATE orders SET customer_id = $CUSTOMER
WHERE id IN (SELECT id FROM orders WHERE customer_id BETWEEN 1 AND 40 ORDER BY random() LIMIT 50);
-- three of them have no items (bad checkouts): an inner join would drop them
DELETE FROM order_items
WHERE order_id IN (SELECT id FROM orders WHERE customer_id = $CUSTOMER ORDER BY random() LIMIT 3);
ANALYZE orders;
ANALYZE order_items;
SQL
write_seed params "$CUSTOMER"

box_write /home/learner/legacy/load_orders.sh 755 learner:learner <<'SH'
#!/usr/bin/env bash
# LEGACY order-history loader: the classic N+1.
#   1 query for the customer's orders + 1 query per order for its items.
# usage: ./load_orders.sh <customer_id>
cust=${1:?usage: load_orders.sh <customer_id>}
queries=0
ids=$(psql -X -At -c "SELECT id FROM orders WHERE customer_id = $cust ORDER BY id")
queries=$((queries + 1))
for id in $ids; do
  psql -X -At -F, -c "SELECT $id AS order_id, sku, qty, price FROM order_items WHERE order_id = $id"
  queries=$((queries + 1))
done
echo "queries issued: $queries" >&2
SH
in_box "chown -R learner:learner /home/learner/legacy"

write_ticket <<TICKET
# Ticket: The order-history page fires 51 queries

The "My orders" API for customer **$CUSTOMER** loads the customer's orders, then loops
over them and asks for each order's items — one query per order. Run it and see:

    ~/legacy/load_orders.sh $CUSTOMER      # last line: "queries issued: 51"

Customer $CUSTOMER has exactly 50 orders. 51 round-trips for one page is the **N+1
problem**. Replace it with **one** SQL statement.

## Task

Write a single query that returns, for customer **$CUSTOMER**, every order together with
its items (one row per order/item pair).

Output columns, in this order: \`order_id\`, \`status\`, \`sku\`, \`qty\`, \`price\`

Rules:

- **Exactly one SQL statement** in the file.
- Every one of the 50 orders must appear, **even orders that have no items** (their
  \`sku\`, \`qty\`, \`price\` come back empty/NULL).
- Do not change any data.

Save the SQL to:

    ~/answers/query.sql
TICKET

ok "QuickBite seeded (customer $CUSTOMER has 50 orders)"
