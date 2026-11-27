#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

params="$(seed_value params)"
[[ -n "$params" ]] || fail "lab seed missing (params); reset the lab"
bail_if_failed
read -r wa wb amt bal_a bal_b others <<<"$params"

box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
bail_if_failed

q() { sql_scalar <<<"$1"; }
# "balance-of-source,balance-of-destination"
balances() { q "SELECT (SELECT balance FROM wallets WHERE id = $wa) || ',' || (SELECT balance FROM wallets WHERE id = $wb);" | _norm_rows; }
others_now() { q "SELECT md5(string_agg(id || ':' || balance, ',' ORDER BY id)) FROM wallets WHERE id NOT IN ($wa, $wb);"; }
reset_pair() {  # <balance-a> <balance-b>
  sql_root <<SQL
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_balance_nonneg;
ALTER TABLE wallets ADD CONSTRAINT wallets_balance_nonneg CHECK (balance >= 0);
UPDATE wallets SET balance = $1 WHERE id = $wa;
UPDATE wallets SET balance = $2 WHERE id = $wb;
SQL
}

if need_sql transfer.sql; then
  sql_mentions transfer.sql '(^|[^a-z_])(begin|start[[:space:]]+transaction)([^a-z_]|$)' "an explicit transaction (BEGIN ... COMMIT)" || true
  sql_mentions transfer.sql '(^|[^a-z_])commit([^a-z_]|$)' "COMMIT" || true
  bail_if_failed

  # Scenario 1: enough money.
  reset_pair "$bal_a" "$bal_b"
  run_script transfer.sql
  want_a="$(q "SELECT $bal_a - $amt;")"; want_b="$(q "SELECT $bal_b + $amt;")"
  got="$(balances)"
  want="$(printf '%s,%s' "$want_a" "$want_b" | _norm_rows)"
  if [[ "$got" == "$want" ]]; then
    ok "successful transfer: #$wa -$amt, #$wb +$amt"
  else
    fail "after the transfer wallets #$wa,#$wb should hold [$want] but hold [$got]"
  fi
  [[ "$(others_now)" == "$others" ]] || fail "your script changed a wallet other than #$wa and #$wb"
  ok "no other wallet touched"

  # Scenario 2: source cannot cover the amount -> nothing may change.
  low="$(q "SELECT $amt - 1;")"
  reset_pair "$low" "$bal_b"
  run_script transfer.sql
  got="$(balances)"
  want="$(printf '%s,%s' "$low" "$bal_b" | _norm_rows)"
  if [[ "$got" == "$want" ]]; then
    ok "insufficient funds: both wallets unchanged (all or nothing)"
  else
    fail "with too little balance wallets #$wa,#$wb should stay [$want] but are [$got] — the credit must roll back with the failed debit"
  fi

  reset_pair "$bal_a" "$bal_b"
fi

pass "atomic wallet transfer"
