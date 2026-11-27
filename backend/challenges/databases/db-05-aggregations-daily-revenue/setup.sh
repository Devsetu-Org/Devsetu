#!/usr/bin/env bash
# Daily revenue and order counts over a per-session date window, cancelled orders excluded.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 3 30)"
DAYS="$(rand_between 6 9)"
FROM_DATE="$(in_box "date -u -d '$BIZ_DATE -$((DAYS - 1)) days' +%F")"
write_seed biz-date "$BIZ_DATE"
write_seed from-date "$FROM_DATE"
SEED_ORDERS=360 SEED_DAYS=12 seed_core

write_ticket <<TICKET
# Ticket: Daily revenue

The CFO wants a one-line-per-day revenue view for **$FROM_DATE** through **$BIZ_DATE**
(inclusive).

## Task

For each calendar day in that range, return:

| column | meaning |
| --- | --- |
| \`day\` | the date of \`created_at\` (a \`date\`) |
| \`orders\` | number of orders that day |
| \`revenue\` | \`SUM(total)\` that day (do not round) |

Rules:

- **Exclude cancelled orders** (\`status = 'cancelled'\`).
- One row per day that has orders; sort by \`day\` ascending.
- Do not change any data.
- Alias columns with \`AS\` (for example \`created_at::date AS day\`).

Save the SQL to:

    ~/answers/query.sql
TICKET

ok "QuickBite seeded (window $FROM_DATE .. $BIZ_DATE)"
