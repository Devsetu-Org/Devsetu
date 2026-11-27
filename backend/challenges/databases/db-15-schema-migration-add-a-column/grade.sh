#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

phrase="$(seed_value phrase)"
read -r rows base <<<"$(seed_value base)"
[[ -n "$phrase" && -n "$base" ]] || fail "lab seed missing; reset the lab"
bail_if_failed

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

q() { sql_scalar <<<"$1"; }
sq="$(printf '%s' "$phrase" | sed "s/'/''/g")"

check_state() {  # <label>
  local label=$1 col pend_total pend_ok other_bad
  col="$(q "SELECT data_type || ',' || is_nullable || ',' || coalesce(column_default, '') FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_instructions';")"
  if [[ -z "$col" ]]; then
    fail "$label: orders.delivery_instructions does not exist"
    return 1
  fi
  [[ "$col" == "text,YES," ]] || { fail "$label: delivery_instructions should be TEXT, nullable, with no default (found: $col)"; return 1; }
  pend_total="$(q "SELECT count(*) FROM orders WHERE status = 'pending';")"
  pend_ok="$(q "SELECT count(*) FROM orders WHERE status = 'pending' AND delivery_instructions = '$sq';")"
  other_bad="$(q "SELECT count(*) FROM orders WHERE status <> 'pending' AND delivery_instructions IS NOT NULL;")"
  [[ "$pend_ok" == "$pend_total" ]] || { fail "$label: $((pend_total - pend_ok)) pending order(s) are missing the backfill text '$phrase'"; return 1; }
  [[ "$other_bad" == 0 ]] || { fail "$label: $other_bad non-pending order(s) got delivery_instructions — only pending orders are backfilled"; return 1; }
  ok "$label: column + backfill correct"
}

if need_sql migration.sql; then
  sql_mentions migration.sql 'alter[[:space:]]+table' "ALTER TABLE orders ADD COLUMN ..." || true
  sql_mentions migration.sql 'if[[:space:]]+not[[:space:]]+exists' "IF NOT EXISTS so the migration can be re-run" || true
fi
bail_if_failed

check_state "applied state" || true

now_rows="$(q 'SELECT count(*) FROM orders;')"
now_hash="$(q "SELECT md5(string_agg(id || '|' || coalesce(customer_id::text, '') || '|' || status || '|' || total || '|' || created_at, ',' ORDER BY id)) FROM orders;")"
if [[ "$now_rows" == "$rows" && "$now_hash" == "$base" ]]; then
  ok "existing order data is unchanged"
else
  fail "existing order data changed (rows: $now_rows, expected $rows) — a migration must not alter other columns"
fi

# Replay from scratch: drop the column, run the learner's migration, then run it again.
q 'ALTER TABLE orders DROP COLUMN IF EXISTS delivery_instructions;' >/dev/null
if run_script_strict migration.sql; then
  check_state "fresh run" || true
else
  fail "migration.sql failed on a database without the column: $(script_err)"
fi
if run_script_strict migration.sql; then
  ok "second run succeeds (idempotent)"
  check_state "second run" || true
else
  fail "running migration.sql twice fails: $(script_err) — add IF NOT EXISTS"
fi

pass "migration applied and re-runnable"
