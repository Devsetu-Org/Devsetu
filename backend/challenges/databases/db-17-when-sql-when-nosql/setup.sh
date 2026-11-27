#!/usr/bin/env bash
# Same orders as rows (orders/order_items) and as documents (order_docs). Two query
# patterns are picked per session — one that favours relational, one that favours documents —
# and the learner writes a recommendation. Graded on structure + required keywords.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

BIZ_DATE="$(pick_biz_date 2 30)"
SEED_ORDERS=150 SEED_DAYS=10 seed_core
sql_learner <<'SQL'
CREATE TABLE order_docs (
  id  serial PRIMARY KEY,
  doc jsonb NOT NULL
);
INSERT INTO order_docs (doc)
SELECT jsonb_build_object(
         'order_id', o.id, 'status', o.status, 'customer_id', o.customer_id, 'total', o.total,
         'items', coalesce((SELECT jsonb_agg(jsonb_build_object('sku', i.sku, 'qty', i.qty, 'price', i.price))
                            FROM order_items i WHERE i.order_id = o.id), '[]'::jsonb))
FROM orders o;
ANALYZE order_docs;
SQL

R_TEXT=(
  "Finance wants monthly revenue per customer segment, joining orders, customers and refunds. The questions change every quarter."
  "A wallet transfer must debit one account and credit another. It must never end up half-done, and balances may never go negative."
  "Support asks arbitrary questions: \"all pending orders over Rs 500 from customers who ordered biryani last month\"."
)
R_KW=(
  'join|aggregat|group by|sum|report|ad-hoc|ad hoc|analytic'
  'transaction|acid|atomic|consisten|constraint'
  'join|index|filter|ad-hoc|ad hoc|sql|flexible query'
)
D_TEXT=(
  "The order page loads one order with its items, modifiers and delivery notes in a single read by order id."
  "Each partner restaurant sends menu items with different, evolving attributes (allergens, combos, size options)."
  "We archive raw payment-gateway webhook payloads. Their shape differs per provider and changes without notice."
)
D_KW=(
  'nested|embed|single read|one read|one document|denormal|locality|document'
  'flexible|schema|schemaless|varying|evolv|attributes|jsonb|json'
  'schema|payload|shape|varying|flexible|raw|json'
)
ri=$((RANDOM % 3)); di=$((RANDOM % 3))
if (( RANDOM % 2 )); then
  A_TEXT="${R_TEXT[$ri]}"; A_KIND=relational; A_KW="${R_KW[$ri]}"
  B_TEXT="${D_TEXT[$di]}"; B_KIND=document;   B_KW="${D_KW[$di]}"
else
  A_TEXT="${D_TEXT[$di]}"; A_KIND=document;   A_KW="${D_KW[$di]}"
  B_TEXT="${R_TEXT[$ri]}"; B_KIND=relational; B_KW="${R_KW[$ri]}"
fi
CODE="DB17-$(rand_between 1000 9999)"
write_seed code "$CODE"
write_seed a-kind "$A_KIND"
write_seed b-kind "$B_KIND"
write_seed a-kw "$A_KW"
write_seed b-kw "$B_KW"

write_ticket <<TICKET
# Ticket: SQL or documents? Make the call

Architecture review is tomorrow. The team has the same QuickBite orders in **both**
shapes, in this database:

- relational: \`orders\`, \`order_items\`, \`customers\` (joins, constraints, transactions)
- document: \`order_docs(doc jsonb)\`, one nested JSON document per order

Play with both in \`psql\`. For example, fetch one order with its items each way:

    SELECT o.*, i.* FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.id = 10;
    SELECT doc FROM order_docs WHERE doc ->> 'order_id' = '10';

## The two query patterns

**Pattern A:** $A_TEXT

**Pattern B:** $B_TEXT

## Task

For each pattern, decide whether it fits a **relational** or a **document** model better,
and say why. Write your recommendation to:

    ~/answers/recommendation.md

Use exactly this layout (one label per line; explanations may span several lines):

    REVIEW CODE: $CODE
    PATTERN A: relational   (or: document)
    WHY A: ...
    PATTERN B: relational   (or: document)
    WHY B: ...
    TRADE-OFFS: ...

Requirements:

- \`REVIEW CODE\` must be exactly \`$CODE\`.
- Choose **one** model per pattern.
- Each \`WHY\` must be at least a full sentence (40+ characters) and use at least one
  concrete modelling term, for example: join, aggregate, transaction, ACID, constraint,
  nested, embedded, one document, single read, flexible schema, schemaless, denormalised,
  payload, index.
- \`TRADE-OFFS\` (60+ characters) must name a cost of **each** approach and use at least
  two of: schema, join, transaction, ACID, consistency, index, scale, duplicate,
  denormalised.
TICKET

ok "two patterns picked (review code $CODE)"
