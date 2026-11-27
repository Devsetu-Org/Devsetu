#!/usr/bin/env bash
# Document-style orders in Postgres jsonb (order_docs). Learner inserts a nested order and
# queries by nested fields.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_postgres
fresh_db_lab

sql_learner <<'SQL'
CREATE TABLE order_docs (
  id  serial PRIMARY KEY,
  doc jsonb NOT NULL
);
INSERT INTO order_docs (doc)
SELECT jsonb_build_object(
         'order_id', 1000 + g,
         'status',   (ARRAY['pending','confirmed','delivered','delivered','cancelled'])[1 + floor(random() * 5)::int],
         'customer', jsonb_build_object(
                       'id',   1 + floor(random() * 40)::int,
                       'name', (ARRAY['Aarav','Diya','Kabir','Meera','Rohan','Isha'])[1 + floor(random() * 6)::int],
                       'city', (ARRAY['Pune','Mumbai','Bengaluru','Chennai','Delhi','Kolkata'])[1 + floor(random() * 6)::int]),
         'items',    (SELECT jsonb_agg(jsonb_build_object(
                              'sku',   'SKU-' || lpad((1 + floor(random() * 12))::int::text, 3, '0'),
                              'qty',   1 + floor(random() * 3)::int,
                              'price', round((40 + random() * 260)::numeric, 2)))
                      FROM generate_series(1, 1 + (g % 4)) k),
         'total',    round((100 + random() * 1400)::numeric, 2))
FROM generate_series(1, 250) g;
ANALYZE order_docs;
SQL

CITY="$(printf '%s\n' Pune Mumbai Bengaluru Chennai Delhi Kolkata | sed -n "$(rand_between 1 6)p")"
SKU="$(sql_scalar <<SQL
SELECT sku FROM (
  SELECT jsonb_array_elements(doc -> 'items') ->> 'sku' AS sku
  FROM order_docs WHERE doc #>> '{customer,city}' = '$CITY'
) t GROUP BY sku ORDER BY count(*) DESC, random() LIMIT 1;
SQL
)"
OTHER_SKU="SKU-9$(rand_between 10 99)"
NEW_ID="$(rand_between 9100 9899)"
COUNT="$(echo 'SELECT count(*) FROM order_docs;' | sql_scalar)"
write_seed params "$CITY $SKU $OTHER_SKU $NEW_ID $COUNT"

write_ticket <<TICKET
# Ticket: Orders as documents

The order page always reads one order with everything on it: customer, items, totals.
Joining four tables for that is wasteful, so the team prototypes an **order document**
store. (We use Postgres \`jsonb\` for the prototype; the modelling ideas are the same as a
MongoDB collection.)

The table is already there:

    order_docs(id serial PRIMARY KEY, doc jsonb)

Each \`doc\` looks like:

    { "order_id": 1001, "status": "delivered", "total": 480.50,
      "customer": { "id": 7, "name": "Meera", "city": "Pune" },
      "items": [ { "sku": "SKU-003", "qty": 2, "price": 120.00 }, ... ] }

## 1. Insert a new order document

Insert this order as **one row** (items nested inside the document, not in another table):

    { "order_id": $NEW_ID, "status": "pending", "total": 487.00,
      "customer": { "id": 7, "name": "Ada Learner", "city": "$CITY" },
      "items": [ { "sku": "$SKU", "qty": 2, "price": 199.00 },
                 { "sku": "$OTHER_SKU", "qty": 1, "price": 89.00 } ] }

## 2. Query by nested fields

Write a query that returns the \`order_id\` (as text, via \`->>\`) of every order where

- the customer's \`city\` is **$CITY**, **and**
- at least one item has \`sku\` = **$SKU**

Output a single column. Do not change any data in this step.

Save the SQL to:

    ~/answers/query.sql

Hints: \`doc -> 'customer' ->> 'city'\`, \`doc #>> '{customer,city}'\`, and the containment
operator \`@>\` for "an array contains an object like this".
TICKET

ok "order_docs seeded ($COUNT docs; city $CITY, sku $SKU)"
