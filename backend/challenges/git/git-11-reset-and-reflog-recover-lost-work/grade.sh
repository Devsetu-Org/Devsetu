#!/usr/bin/env bash
# Recover lost commit onto feature/column-auto-advance, push it; leave main at seed tip.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=feature/column-auto-advance
seed_count="$(seed_value seed-commits)"
automate_hash="$(seed_value automate-hash)"
stale="$(seed_value stale-hours)"
main_seed="$(seed_value main-sha)"
[[ -n "$seed_count" && -n "$automate_hash" && -n "$stale" && -n "$main_seed" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$BR" ]] \
  || fail "you should be on $BR (got: '$(repo_branch)') — recover onto your feature tip, not main"

# Tip SHA match is enough: seed main never had column_automate.py. Do not use
# blob_hash here — a missing path makes rev-parse print a fatal on kubectl's
# combined stream, which falsely looks like a non-empty hash.
local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main alone — restore the commit on $BR (main is ${local_main:0:7}, expected ${main_seed:0:7})"
ok "main untouched"

got="$(blob_hash HEAD src/column_automate.py)"
[[ -n "$got" ]] || fail "src/column_automate.py is not committed on $BR yet"
[[ "$got" == "$automate_hash" ]] || fail "src/column_automate.py on $BR differs from the original (expected STALE_HOURS = $stale)"
ok "column auto-advance recovered exactly"

count="$(in_repo rev-list --count HEAD 2>/dev/null || echo 0)"
[[ "$count" -gt "$seed_count" ]] || fail "$BR has no commit beyond the post-reset history"
subj="$(in_repo log --format=%s HEAD 2>/dev/null | grep -c 'Add column auto-advance for stale Doing cards' || true)"
[[ "$subj" -ge 1 ]] || fail "the commit 'Add column auto-advance for stale Doing cards' is not in $BR history"
ok "commit is part of $BR"

[[ -n "$(blob_hash HEAD src/columns.py)" ]] || fail "src/columns.py went missing"

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$remote_main" ]] || fail "team remote has no main branch"
[[ "$remote_main" == "$main_seed" ]] \
  || fail "remote main moved — push only $BR for review (remote main is ${remote_main:0:7})"
ok "remote main untouched"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push your recovered feature: team remote has no $BR tip update"
[[ "$remote_br" == "$head" ]] \
  || fail "push $BR for review: remote is ${remote_br:0:7}, local is ${head:0:7}"
# Remote tip must include the auto-advance file
remote_auto="$(in_box "git -c safe.directory=$REMOTE -C $REMOTE rev-parse refs/heads/$BR:src/column_automate.py" 2>/dev/null || true)"
[[ "$remote_auto" == "$automate_hash" ]] \
  || fail "origin/$BR does not have the recovered column_automate.py — push after restoring"
ok "pushed recovered $BR for review"

pass "lost commit recovered onto $BR and pushed for review; main untouched"
