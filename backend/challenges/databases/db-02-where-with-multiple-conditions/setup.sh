#!/usr/bin/env bash
# Pending orders above a per-session rupee threshold, newest first.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
THRESHOLD="$(rand_between 4 9)00"   # 400..900
write_seed threshold "$THRESHOLD"
SEED_ORDERS=320 SEED_DAYS=14 seed_core

write_ticket <<TICKET
# Ticket: Chase the big pending orders

Support is drowning in "where is my food?" messages. Before they page the kitchens
they want a worklist: **big orders that are still pending**.

## Task

Return every order that is **both**:

- \`status = 'pending'\`, and
- \`total\` **greater than ₹$THRESHOLD** (strictly greater)

Output columns, in this order: \`id\`, \`customer_id\`, \`total\`, \`created_at\`

Sort **newest first** (\`created_at\` descending). Do not change any data.

Save the SQL to:

    ~/answers/query.sql

Tip: \`psql\` connects to the \`quickbite\` database as \`learner\`. Try \`\\d orders\` first.
TICKET

ok "QuickBite seeded (threshold ₹$THRESHOLD)"
