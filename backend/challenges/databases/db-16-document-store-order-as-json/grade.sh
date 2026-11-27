#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

params="$(seed_value params)"
[[ -n "$params" ]] || fail "lab seed missing (params); reset the lab"
bail_if_failed
read -r city sku other_sku new_id count <<<"$params"

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

q() { sql_scalar <<<"$1"; }

# 1. The nested document was inserted as one row.
n="$(q "SELECT count(*) FROM order_docs WHERE doc ->> 'order_id' = '$new_id';")"
if [[ "$n" != 1 ]]; then
  fail "expected exactly one order_docs row with order_id $new_id (found $n)"
else
  good="$(q "SELECT count(*) FROM order_docs
             WHERE doc ->> 'order_id' = '$new_id'
               AND doc ->> 'status' = 'pending'
               AND doc #>> '{customer,city}' = '$city'
               AND doc #>> '{customer,name}' = 'Ada Learner'
               AND jsonb_typeof(doc -> 'items') = 'array'
               AND jsonb_array_length(doc -> 'items') = 2
               AND doc -> 'items' @> '[{\"sku\": \"$sku\", \"qty\": 2}]'
               AND doc -> 'items' @> '[{\"sku\": \"$other_sku\", \"qty\": 1}]';")"
  if [[ "$good" == 1 ]]; then
    ok "order $new_id stored as a nested document"
  else
    fail "document for order $new_id doesn't match the ticket (status pending, customer.name 'Ada Learner', customer.city $city, items: 2 x $sku, 1 x $other_sku nested in an array)"
  fi
fi
now="$(q 'SELECT count(*) FROM order_docs;')"
[[ "$now" == $((count + 1)) ]] || fail "order_docs should have $((count + 1)) rows (found $now) — insert one document, change nothing else"

# 2. The nested-field query.
if need_sql query.sql; then
  sql_mentions query.sql 'order_docs' "the order_docs table" || true
  grade_rows query.sql set "orders in $city containing $sku" <<SQL || true
SELECT doc ->> 'order_id' FROM order_docs
WHERE doc #>> '{customer,city}' = '$city'
  AND doc -> 'items' @> '[{"sku": "$sku"}]';
SQL
fi

pass "order document inserted and queried by nested fields"
