# Shared helpers for Databases-lab setup.sh / grade.sh. Sourced, not run.
#
# Local-first: Postgres runs on the learner's Linux box (sandboxType linux, dev-box) with
# the QuickBite schema. The learner writes SQL under ~/answers/ (and may poke around in
# psql). Graders run on the backend host and reach the box only through in_box / box_*,
# never through anything the learner controls.
#
# Per-session secrets (business date, thresholds, wallet ids, ...) live in /root/.lab,
# readable only by root, and are echoed into ~/ticket/TASK.md for the learner.
#
# Env from the backend: LEARNER_NS, BOX_POD, BOX_CONTAINER, CHALLENGE_ID.

source "$(dirname "${BASH_SOURCE[0]}")/../../linux/_lib/lab.sh"

DBNAME=quickbite
ANSWERS=/home/learner/answers
TICKET=/home/learner/ticket
SEED=/root/.lab

# Learner SQL is graded read-only unless a lab says otherwise (see answer_rows_rw).
PG_RO_OPTS='-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=5000'
PG_RW_OPTS='-c statement_timeout=30000 -c lock_timeout=5000'

# --------------------------------------------------------------------------------------
# Plumbing
# --------------------------------------------------------------------------------------

# box_stdin '<shell command>' — like in_box, but forwards our stdin into the command.
box_stdin() {
  kubectl -n "$LEARNER_NS" exec -i "$BOX_POD" -c "$BOX_CONTAINER" -- bash -c "$1"
}

# ensure_postgres — install (if needed) and start the local cluster. Works with or
# without systemd: unprivileged boxes run `sleep infinity` as PID 1, so we fall back to
# pg_ctlcluster. Setup runs as root inside the box.
ensure_postgres() {
  box_script <<'EOF'
export DEBIAN_FRONTEND=noninteractive
if ! command -v psql >/dev/null 2>&1 || ! ls /usr/lib/postgresql/*/bin/postgres >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y --no-install-recommends postgresql postgresql-contrib >/dev/null
fi
ver=$(ls /usr/lib/postgresql | sort -V | tail -1)
install -d -o postgres -g postgres -m 2775 /var/run/postgresql
if ! pg_lsclusters -h 2>/dev/null | grep -q .; then
  pg_createcluster "$ver" main
fi
if ! pg_isready -q; then
  if [ -d /run/systemd/system ] && systemctl start postgresql 2>/dev/null; then
    :
  else
    pg_ctlcluster "$ver" main start || true
  fi
fi
for _ in $(seq 1 45); do
  pg_isready -q && break
  sleep 1
done
pg_isready -q
EOF
  box_ok 'pg_isready -q' || fail "PostgreSQL is not running on this machine"
  bail_if_failed
}

# fresh_db_lab — wipe answers/ticket/seed, recreate the quickbite DB owned by `learner`.
# The learner connects over the unix socket with peer auth (OS user = DB role), so a bare
# `psql` works once PGDATABASE is exported (we add it to ~/.bashrc).
fresh_db_lab() {
  box_script <<EOF
rm -rf $ANSWERS $TICKET $SEED /home/learner/legacy
install -d -m 700 $SEED
install -d -o learner -g learner -m 755 $ANSWERS $TICKET
cd /tmp
runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -d postgres <<'SQL'
SET client_min_messages = warning;
DROP DATABASE IF EXISTS $DBNAME WITH (FORCE);
DROP ROLE IF EXISTS learner;
CREATE ROLE learner LOGIN;
CREATE DATABASE $DBNAME OWNER learner;
SQL
touch /home/learner/.bashrc
grep -q '^export PGDATABASE=' /home/learner/.bashrc || echo 'export PGDATABASE=$DBNAME' >> /home/learner/.bashrc
chown learner:learner /home/learner/.bashrc
EOF
}

# sql_learner  — run SQL from stdin as the learner role (owner of the DB, so seed objects
#                belong to the learner and ALTER / CREATE INDEX work in labs).
# sql_root     — run SQL from stdin as the postgres superuser.
# sql_scalar   — run SQL from stdin as postgres; prints bare tuples (-A -t).
# ref_rows     — same, comma-separated: the grader's reference result set.
# (lock_timeout keeps a grader from hanging behind a transaction the learner left open.)
sql_learner() { box_stdin "cd /tmp && PGOPTIONS='$PG_RW_OPTS' runuser -u learner -- psql -X -q -d $DBNAME -v ON_ERROR_STOP=1"; }
sql_root()    { box_stdin "cd /tmp && PGOPTIONS='$PG_RW_OPTS' runuser -u postgres -- psql -X -q -d $DBNAME -v ON_ERROR_STOP=1"; }
sql_scalar()  { box_stdin "cd /tmp && PGOPTIONS='$PG_RW_OPTS' runuser -u postgres -- psql -X -q -d $DBNAME -v ON_ERROR_STOP=1 -A -t"; }
ref_rows()    { box_stdin "cd /tmp && PGOPTIONS='$PG_RW_OPTS' runuser -u postgres -- psql -X -q -d $DBNAME -v ON_ERROR_STOP=1 -A -t -F','"; }

# write_ticket — ticket from stdin, owned by learner.
write_ticket() {
  box_write "$TICKET/TASK.md" 644 learner:learner
}

# write_seed <name> <value>  /  seed_value <name>  — grader-owned per-session values.
write_seed() {
  in_box "printf '%s\n' $(printf '%q' "$2") > $SEED/$1"
}
seed_value() {
  in_box "cat $SEED/$1 2>/dev/null" || true
}

# --------------------------------------------------------------------------------------
# Seeding
# --------------------------------------------------------------------------------------

# rand_between <lo> <hi> — inclusive.
rand_between() {
  echo $(( $1 + RANDOM % ($2 - $1 + 1) ))
}

# pick_biz_date <min-days-back> <max-days-back> — a calendar date (UTC) in the recent past.
pick_biz_date() {
  local n
  n="$(rand_between "$1" "$2")"
  in_box "date -u -d '-$n days' +%F"
}

# seed_core — QuickBite base schema + data, created as `learner` (so the learner owns it).
#
#   customers(id, name, email)
#   orders(id, customer_id, status, total, created_at, deleted_at)   -- no FK on customer_id
#   order_items(id, order_id, sku, qty, price)
#
# Knobs (env): BIZ_DATE (required, YYYY-MM-DD), SEED_CUSTOMERS (40), SEED_ORDERS (300),
# SEED_DAYS (12 days of history up to and including BIZ_DATE), SEED_AFTER (3 more days
# after BIZ_DATE, so "everything from the date onward" is a wrong answer), SEED_ORPHANS (6; legacy rows pointing at a missing
# customer — half NULL, half dangling ids), SEED_ITEMS (1; 0 skips order_items and makes
# totals random).
#
# created_at is unique per order while SEED_ORDERS <= 86400, so ORDER BY created_at is
# deterministic. Everything random is driven by a per-session setseed().
seed_core() {
  local ncust=${SEED_CUSTOMERS:-40} nord=${SEED_ORDERS:-300} days=${SEED_DAYS:-12}
  local after=${SEED_AFTER:-3} orph=${SEED_ORPHANS:-6} items=${SEED_ITEMS:-1} biz=${BIZ_DATE:?BIZ_DATE is required}
  local rs off orph_sql='' items_sql=''
  rs="0.$(printf '%03d' "$(rand_between 100 899)")"
  off="$(rand_between 0 86399)"

  if (( items == 1 )); then
    items_sql="
INSERT INTO order_items (order_id, sku, qty, price)
SELECT o.id,
       'SKU-' || lpad((1 + floor(random() * 24))::int::text, 3, '0'),
       1 + floor(random() * 3)::int,
       round((40 + random() * 260)::numeric, 2)
FROM orders o, generate_series(1, 1 + (o.id % 4)) k;
UPDATE orders o SET total = s.t
FROM (SELECT order_id, sum(qty * price) AS t FROM order_items GROUP BY order_id) s
WHERE s.order_id = o.id;"
  else
    items_sql="
UPDATE orders SET total = round((80 + random() * 1420)::numeric, 2);"
  fi

  if (( orph > 0 )); then
    orph_sql="
UPDATE orders SET customer_id = NULL
WHERE id IN (SELECT id FROM orders ORDER BY random() LIMIT $(( orph / 2 )));
UPDATE orders SET customer_id = 90000 + id
WHERE id IN (SELECT id FROM orders WHERE customer_id IS NOT NULL ORDER BY random() LIMIT $(( orph - orph / 2 )));"
  fi

  sql_learner <<SQL
SELECT setseed($rs) AS seeded \\gset

CREATE TABLE customers (
  id    serial PRIMARY KEY,
  name  text NOT NULL,
  email text NOT NULL UNIQUE
);
CREATE TABLE orders (
  id          serial PRIMARY KEY,
  customer_id integer,
  status      text NOT NULL,
  total       numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamp NOT NULL DEFAULT now(),
  deleted_at  timestamp
);
CREATE TABLE order_items (
  id       serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id),
  sku      text NOT NULL,
  qty      integer NOT NULL,
  price    numeric(10,2) NOT NULL
);

INSERT INTO customers (name, email)
SELECT (ARRAY['Aarav','Diya','Kabir','Meera','Rohan','Isha','Vikram','Ananya','Arjun','Sana','Neel','Tara'])[1 + floor(random() * 12)::int]
       || ' ' ||
       (ARRAY['Sharma','Iyer','Khan','Patel','Nair','Gupta','Reddy','Menon','Bose','Rao','Das','Kapoor'])[1 + floor(random() * 12)::int],
       'customer' || g || '@quickbite.test'
FROM generate_series(1, $ncust) g;

INSERT INTO orders (customer_id, status, created_at)
SELECT 1 + floor(random() * $ncust)::int,
       (ARRAY['pending','pending','confirmed','delivered','delivered','delivered','cancelled'])[1 + floor(random() * 7)::int],
       (date '$biz' + (floor(random() * ($days + $after))::int - ($days - 1))) + ((g::bigint * 7919 + $off) % 86400) * interval '1 second'
FROM generate_series(1, $nord) g;
$items_sql
$orph_sql
ANALYZE customers;
ANALYZE orders;
ANALYZE order_items;
SQL
}

# --------------------------------------------------------------------------------------
# Grading helpers
# --------------------------------------------------------------------------------------

# bail_if_failed — stop grading now if an earlier check failed (fail does not exit).
bail_if_failed() {
  if [[ "${_grade_failures:-0}" -gt 0 ]]; then
    exit 1
  fi
  return 0
}

# need_sql <name> — the learner's answer file exists and is not empty. Returns 1 on miss.
need_sql() {
  local name=$1
  if ! box_ok "test -f $ANSWERS/$name"; then
    fail "~/answers/$name does not exist — write your SQL there"
    return 1
  fi
  if ! box_ok "test -s $ANSWERS/$name"; then
    fail "~/answers/$name is empty"
    return 1
  fi
  return 0
}

# sql_text <name> — the learner's SQL, one line, lower-cased, `--` comments stripped.
sql_text() {
  in_box "sed -e 's/--.*\$//' $ANSWERS/$1 | tr '\n\r\t' '   ' | tr '[:upper:]' '[:lower:]'" || true
}

# sql_mentions <name> <ERE> <what> — answer text must match the (lower-case) regex.
sql_mentions() {
  local t
  t="$(sql_text "$1")"
  if [[ ! "$t" =~ $2 ]]; then
    fail "~/answers/$1 should use $3"
    return 1
  fi
  return 0
}

# sql_stmt_count <name> — number of non-empty `;`-separated statements (comments ignored).
sql_stmt_count() {
  in_box "sed -e 's/--.*\$//' $ANSWERS/$1 | tr -s '[:space:]' ' ' | awk -v RS=';' 'NF{n++} END{print n+0}'" || echo 0
}

# run_answer <name> — learner SQL as the learner role, read-only, rows on stdout.
# (kept for labs that just want the raw rows; non-zero on a SQL error)
run_answer() {
  answer_rows "$1"
}

# answer_rows <name> — execute ~/answers/<name> as the learner in a read-only session and
# print tuples (psql -A -t -F','). Non-zero on SQL error; see answer_err.
answer_rows() {
  local out
  if out="$(in_box "cd /tmp && PGOPTIONS='$PG_RO_OPTS' timeout 60 runuser -u learner -- psql -X -q -d $DBNAME -v ON_ERROR_STOP=1 -A -t -F',' -f $ANSWERS/$1 2>/tmp/.answer.err")"; then
    printf '%s\n' "$out"
    return 0
  fi
  return 1
}

# answer_err — first lines of the last SQL error from answer_rows.
answer_err() {
  in_box 'head -c 300 /tmp/.answer.err | tr "\n" " "' 2>/dev/null || true
}

# run_script <name> — run ~/answers/<name> as the learner with write access and psql's
# default behaviour (keeps going after an error, exactly like `psql -f` at a terminal).
# Output is discarded; graders judge the resulting database state.
run_script() {
  in_box "cd /tmp && PGOPTIONS='$PG_RW_OPTS' timeout 60 runuser -u learner -- psql -X -q -d $DBNAME -f $ANSWERS/$1 >/dev/null 2>/tmp/.script.err" || true
}

# run_script_strict <name> — like run_script but with ON_ERROR_STOP: returns psql's exit
# status (non-zero = some statement failed). First error line via script_err.
run_script_strict() {
  in_box "cd /tmp && PGOPTIONS='$PG_RW_OPTS' timeout 60 runuser -u learner -- psql -X -q -d $DBNAME -v ON_ERROR_STOP=1 -f $ANSWERS/$1 >/dev/null 2>/tmp/.script.err"
}
script_err() {
  in_box 'head -c 300 /tmp/.script.err | tr "\n" " "' 2>/dev/null || true
}

# answer_ms <name> — wall-clock milliseconds to run ~/answers/<name> (read-only session).
answer_ms() {
  in_box "cd /tmp && s=\$(date +%s%N) && PGOPTIONS='$PG_RO_OPTS' timeout 120 runuser -u learner -- psql -X -q -d $DBNAME -f $ANSWERS/$1 >/dev/null 2>&1; e=\$(date +%s%N); echo \$(( (e - s) / 1000000 ))" || echo 999999
}

# run_ref '<sql>' — reference query as postgres (single statement, passed as an argument).
run_ref() {
  printf '%s\n' "$1" | ref_rows
}

# _norm_rows — stdin -> stdout: strip CR, trim fields, drop blank lines, canonical numerics
# (so 1234.50 == 1234.5 == 1234.500 and 12.00 == 12).
_norm_rows() {
  awk -F',' 'BEGIN { OFS = "," }
    { sub(/\r$/, "") }
    $0 ~ /^[ \t]*$/ { next }
    { for (i = 1; i <= NF; i++) {
        f = $i
        gsub(/^[ \t]+|[ \t]+$/, "", f)
        if (f ~ /^-?[0-9]+\.[0-9]+$/) { sub(/0+$/, "", f); sub(/\.$/, "", f) }
        $i = f
      }
      print }'
}

_sorted() {
  printf '%s' "$1" | LC_ALL=C sort
}

# compare_results <label> <ordered|set> <expected> <got> — prints ok / fail.
compare_results() {
  local label=$1 mode=$2 exp=$3 got=$4 se sg ne ng missing extra
  if [[ "$mode" == set ]]; then
    exp="$(_sorted "$exp")"
    got="$(_sorted "$got")"
  fi
  if [[ "$exp" == "$got" ]]; then
    ok "$label"
    return 0
  fi
  ne="$(printf '%s' "$exp" | awk 'NF{n++} END{print n+0}')"
  ng="$(printf '%s' "$got" | awk 'NF{n++} END{print n+0}')"
  se="$(_sorted "$exp")"
  sg="$(_sorted "$got")"
  missing="$(LC_ALL=C comm -23 <(printf '%s\n' "$se") <(printf '%s\n' "$sg") | head -2 | tr '\n' '|')"
  extra="$(LC_ALL=C comm -13 <(printf '%s\n' "$se") <(printf '%s\n' "$sg") | head -2 | tr '\n' '|')"
  if [[ "$mode" == ordered && "$se" == "$sg" ]]; then
    fail "$label — right rows ($ne) but in the wrong order"
  else
    fail "$label — expected $ne rows, got $ng. Missing e.g. [${missing%|}]; unexpected e.g. [${extra%|}]"
  fi
  return 1
}

# grade_rows <answer-file> <ordered|set> <label> — reference SQL on stdin (must end in `;`).
# Runs the learner's file read-only and compares the result sets.
grade_rows() {
  local name=$1 mode=$2 label=$3 ref got
  if ! ref="$(ref_rows | _norm_rows)"; then
    fail "grader could not build the reference result — reset the lab"
    return 1
  fi
  need_sql "$name" || return 1
  if ! got="$(answer_rows "$name" | _norm_rows)"; then
    fail "~/answers/$name failed to run: $(answer_err)"
    return 1
  fi
  compare_results "$label" "$mode" "$ref" "$got"
}

# plan_of '<sql>' — EXPLAIN text for a query as postgres (ANALYZE first for fair stats).
plan_of() {
  printf 'EXPLAIN %s\n' "$1" | box_stdin "cd /tmp && runuser -u postgres -- psql -X -q -d $DBNAME -v ON_ERROR_STOP=1 -A -t"
}
