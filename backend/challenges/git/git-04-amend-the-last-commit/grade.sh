#!/usr/bin/env bash
# Continuation of lab 2: amend the forgotten writeup into the tip of
# fix/agentic-default, then force-with-lease that branch. main stays put.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

main_seed="$(seed_value main-sha)"
branch_base="$(seed_value branch-base)"
orig="$(seed_value orig-sha)"
seed_count="$(seed_value seed-commits)"
tip_py="$(seed_value tip-py-hash)"
doc_hash="$(seed_value doc-hash)"
[[ -n "$main_seed" && -n "$branch_base" && -n "$orig" && -n "$seed_count" && -n "$doc_hash" && -n "$tip_py" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_remote
need_repo

BR=fix/agentic-default

[[ "$(repo_branch)" == "$BR" ]] || fail "you should be on $BR (got: '$(repo_branch)')"
ok "on $BR"

main_now="$(in_repo rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$main_now" == "$main_seed" ]] \
  || fail "main moved — leave it at the seed tip (found ${main_now:0:7}, expected ${main_seed:0:7})"
ok "main is untouched"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
[[ "$head" != "$orig" ]] || fail "HEAD is still the original tip — amend after staging docs/agentic-default.md"
ok "tip was rewritten"

count="$(in_repo rev-list --count "$branch_base..HEAD" 2>/dev/null || echo 0)"
[[ "$count" == "$seed_count" ]] \
  || fail "$BR has $count commits beyond main; it should still have $seed_count (amend, don't add a fourth commit)"
ok "still $seed_count commits on the fix branch"

[[ "$(blob_hash HEAD docs/agentic-default.md)" == "$doc_hash" ]] \
  || fail "HEAD does not contain docs/agentic-default.md (unchanged) — amend it into the tip"
[[ "$(blob_hash HEAD src/main.py)" == "$tip_py" ]] \
  || fail "src/main.py in HEAD changed — amend should only add the writeup"
ok "writeup folded into the tip"

msg="$(in_repo log -1 --format=%s 2>/dev/null || true)"
[[ "${#msg}" -ge 8 && "$msg" == *" "* ]] || fail "commit subject '$msg' is too short"
lower="$(echo "$msg" | tr '[:upper:]' '[:lower:]')"
if [[ "$lower" =~ ^(forgot|oops|wip|fix|update|misc|stuff) ]]; then
  fail "weak tip subject '$msg' — keep the same theme, not a 'forgot the doc' follow-up"
fi
ok "commit subject"

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] \
  || fail "remote main moved — never force-push main (remote ${remote_main:0:7}, expected ${main_seed:0:7})"
ok "remote main untouched"

remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "remote is missing $BR"
[[ "$remote_br" == "$head" ]] \
  || fail "update the remote fix branch: remote $BR is ${remote_br:0:7}, local tip is ${head:0:7} (git push --force-with-lease origin $BR)"
ok "remote $BR matches amended tip"

pass "writeup amended into $BR tip and force-with-lease pushed; main untouched"
