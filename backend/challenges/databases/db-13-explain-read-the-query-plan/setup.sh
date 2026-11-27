#!/usr/bin/env bash
# One slow "recent pending orders for a customer" query. Learner reads EXPLAIN ANALYZE,
# finds Seq Scan + Sort, adds the right index and saves the new plan.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_CUSTOMERS=2500 SEED_ORDERS=300000 SEED_DAYS=120 SEED_ITEMS=0 SEED_ORPHANS=0 seed_core

CUSTOMER="$(rand_between 1 2500)"
write_seed params "$CUSTOMER"

write_ticket <<TICKET
# Ticket: Read the plan, fix the plan

The "latest pending orders" panel for customer **$CUSTOMER** is slow. Its query is:

    SELECT id, status, total, created_at
    FROM orders
    WHERE customer_id = $CUSTOMER AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 20;

## Task

1. Run it under \`EXPLAIN (ANALYZE)\` and read the plan. Look for:
   - the scan type (\`Seq Scan\` vs \`Index Scan\` / \`Bitmap Index Scan\`)
   - a separate \`Sort\` node
   - \`Rows Removed by Filter\`
   - \`Execution Time\`
2. Create whatever index makes Postgres **find the customer's rows and return them already
   in \`created_at\` order**, so the plan has **no \`Seq Scan\` on orders and no \`Sort\` node**.
3. Re-run the query under \`EXPLAIN (ANALYZE)\` and save the **new** plan to:

       ~/answers/plan.txt

   for example:

       psql -c "EXPLAIN (ANALYZE) SELECT id, status, total, created_at FROM orders WHERE customer_id = $CUSTOMER AND status = 'pending' ORDER BY created_at DESC LIMIT 20;" > ~/answers/plan.txt

Do not change any data. The grader checks your \`plan.txt\` **and** runs its own \`EXPLAIN\`
against the live database.
TICKET

ok "orders table seeded (customer $CUSTOMER, no useful index)"
