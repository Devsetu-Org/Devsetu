#!/usr/bin/env bash
# 300k orders, no index on customer_id: lookups seq-scan. Learner adds the index and proves
# it with EXPLAIN. Graded on pg_index + a live plan.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_CUSTOMERS=2500 SEED_ORDERS=300000 SEED_DAYS=120 SEED_ITEMS=0 SEED_ORPHANS=0 seed_core

CUSTOMER="$(rand_between 1 2500)"
ROWS="$(echo 'SELECT count(*) FROM orders;' | sql_scalar)"
write_seed params "$CUSTOMER $ROWS"

write_ticket <<TICKET
# Ticket: "My orders" is slow

Support dashboards show a customer's order history by running

    SELECT id, status, total, created_at
    FROM orders
    WHERE customer_id = $CUSTOMER;

On production-sized data this takes far too long. \`orders\` has about $ROWS rows here and
**no index on \`customer_id\`**, so Postgres reads the whole table every time.

## Task

1. Look at the plan:

       psql -c "EXPLAIN ANALYZE SELECT id, status, total, created_at FROM orders WHERE customer_id = $CUSTOMER;"

   You should see a \`Seq Scan on orders\`. Note the \`Execution Time\`.

2. Add an index on \`orders (customer_id)\`. Name it anything sensible
   (convention: \`idx_orders_customer_id\`).
3. Run the same \`EXPLAIN ANALYZE\` again. The plan should use the index
   (\`Index Scan\` / \`Bitmap Index Scan\`) and be much faster.

Do not delete or change any data. The grader inspects the catalog and runs its own
\`EXPLAIN\` on the lookup above.
TICKET

ok "orders table seeded ($ROWS rows, no index on customer_id; customer $CUSTOMER)"
