#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

params="$(seed_value params)"
[[ -n "$params" ]] || fail "lab seed missing (params); reset the lab"
bail_if_failed
read -r customer total x_order maxid count cancelled base <<<"$params"

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

q() { sql_scalar <<<"$1"; }

# 1. INSERT
newrows="$(q "SELECT count(*) FROM orders WHERE id > $maxid;")"
if [[ "$newrows" != 1 ]]; then
  fail "expected exactly one new order (id > $maxid); found $newrows"
else
  row="$(q "SELECT id || ',' || coalesce(customer_id::text,'') || ',' || total || ',' || status || ',' || (deleted_at IS NULL) FROM orders WHERE id > $maxid;" | _norm_rows)"
  IFS=, read -r nid ncust ntotal nstatus nlive <<<"$row"
  if [[ "$ncust" == "$customer" && "$ntotal" == "$total" && "$nstatus" == pending ]]; then
    ok "new order inserted (id $nid)"
  else
    fail "new order should be customer $customer, status 'pending', total $total (found customer=$ncust status=$nstatus total=$ntotal)"
  fi
  [[ "$nlive" == true ]] || fail "the new order must not be soft-deleted"
  if need_file="$(in_box "cat $ANSWERS/new_order_id.txt 2>/dev/null | tr -dc '0-9'")" && [[ -n "$need_file" ]]; then
    [[ "$need_file" == "$nid" ]] || fail "~/answers/new_order_id.txt says $need_file but the inserted order is $nid (use RETURNING id)"
    ok "new_order_id.txt matches RETURNING id"
  else
    fail "~/answers/new_order_id.txt is missing or has no id — save the id returned by INSERT ... RETURNING"
  fi
fi

# 2. UPDATE
st="$(q "SELECT status FROM orders WHERE id = $x_order;")"
[[ "$st" == confirmed ]] || fail "order #$x_order should have status 'confirmed' (is '$st')"
ok "order #$x_order confirmed"

# 3. Soft delete (and nothing physically removed)
total_now="$(q "SELECT count(*) FROM orders;")"
if [[ "$total_now" != $((count + 1)) ]]; then
  fail "orders row count is $total_now, expected $((count + 1)) — rows must be soft-deleted, not removed"
else
  ok "no orders were physically deleted"
fi
open_c="$(q "SELECT count(*) FROM orders WHERE status = 'cancelled' AND deleted_at IS NULL;")"
bad_d="$(q "SELECT count(*) FROM orders WHERE status <> 'cancelled' AND deleted_at IS NOT NULL;")"
if [[ "$open_c" != 0 ]]; then
  fail "$open_c cancelled order(s) still have deleted_at NULL"
elif [[ "$bad_d" != 0 ]]; then
  fail "$bad_d non-cancelled order(s) were soft-deleted by mistake"
else
  ok "all $cancelled cancelled orders soft-deleted, nothing else"
fi

# No collateral damage: every other original order is untouched (status, total, customer...).
now="$(q "SELECT md5(string_agg(id || '|' || coalesce(customer_id::text, '') || '|' || status || '|' || total || '|' || created_at, ',' ORDER BY id)) FROM orders WHERE id <> $x_order AND id <= $maxid;")"
[[ "$now" == "$base" ]] || fail "other orders were modified — a statement touched more rows than it should have"
ok "no collateral damage to other orders"

pass "insert, update and soft delete done safely"
