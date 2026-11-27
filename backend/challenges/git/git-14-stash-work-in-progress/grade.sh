#!/usr/bin/env bash
# Stash WIP, land TTL on fix/invite-ttl-72, push, pop WIP on feature; main untouched.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

F=feature/workspace-invites
FIX=fix/invite-ttl-72
expected="$(seed_value invite-ttl-hours)"
main_seed="$(seed_value main-sha)"
main_entry="$(seed_value main-entry-hash)"
feature_seed="$(seed_value feature-sha)"
wip_hash="$(seed_value wip-hash)"
[[ -n "$expected" && -n "$main_seed" && -n "$feature_seed" && -n "$wip_hash" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$F" ]] || fail "you should end on $F (got: '$(repo_branch)')"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main at the seed tip — the TTL fix rides $FIX (main is ${local_main:0:7})"
[[ "$(blob_hash main src/main.py)" == "$main_entry" ]] \
  || fail "your WIP edits leaked into main — stash them before committing the hotfix"
ok "main untouched"

[[ "$(in_repo rev-parse --verify "refs/heads/$FIX" 2>/dev/null || true)" != "" ]] \
  || fail "missing $FIX — create it from main after stashing"
fix_count="$(in_repo rev-list --count "$main_seed..$FIX" 2>/dev/null || echo 0)"
[[ "$fix_count" == "1" ]] || fail "$FIX should have exactly one commit beyond main (found $fix_count)"
got="$(in_repo show "$FIX:config/app.conf" 2>/dev/null | awk -F' *= *' '/^invite_link_ttl_hours/ {print $2; exit}' || true)"
[[ "$got" == "$expected" ]] || fail "$FIX:config/app.conf should have invite_link_ttl_hours = $expected (found '${got:-missing}')"
files="$(in_repo diff --name-only "$main_seed" "$FIX" 2>/dev/null || true)"
[[ "$files" == "config/app.conf" ]] || fail "$FIX commit must touch only config/app.conf (changed: $(echo $files))"
ae="$(in_repo log -1 --format=%ae "$FIX" 2>/dev/null || true)"
[[ "$ae" == "ada@forgeboard.internal" ]] || fail "hotfix should be authored by ada@forgeboard.internal (got: $ae)"
ok "hotfix committed on $FIX"

[[ "$(in_repo rev-parse "refs/heads/$F")" == "$feature_seed" ]] \
  || fail "$F gained or lost commits — the WIP must stay uncommitted"
cur="$(in_repo hash-object src/main.py 2>/dev/null || true)"
[[ "$cur" == "$wip_hash" ]] || fail "src/main.py does not have your original uncommitted invite edit — pop the stash"
ok "WIP restored on $F"

stash="$(in_repo stash list 2>/dev/null || true)"
[[ -z "$stash" ]] || fail "the stash is not empty — use git stash pop (not just apply)"
ok "stash empty"

status="$(in_repo status --porcelain 2>/dev/null || true)"
[[ "$status" == " M src/main.py" ]] || fail "expected only ' M src/main.py' (got: $(echo $status))"
ok "working tree has only the WIP change"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] || fail "remote main moved — push only $FIX"
ok "remote main untouched"

fix_head="$(in_repo rev-parse "$FIX" 2>/dev/null || true)"
remote_fix="$(in_remote rev-parse "refs/heads/$FIX" 2>/dev/null || true)"
[[ -n "$remote_fix" ]] || fail "push $FIX to origin for review"
[[ "$remote_fix" == "$fix_head" ]] \
  || fail "push $FIX: remote is ${remote_fix:0:7}, local is ${fix_head:0:7}"
ok "pushed $FIX"

pass "TTL hotfix on $FIX pushed; WIP restored on $F; main untouched"
