#!/usr/bin/env bash
# fix/webhook-timeout-30 pushed with timeout=30; main untouched; WIP still on
# feature; worktree gone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

F=feature/webhook-delivery
FIX=fix/webhook-timeout-30
WT=/home/learner/sprint-webhook-fix
expected="$(seed_value webhook-timeout-seconds)"
main_seed="$(seed_value main-sha)"
feature_seed="$(seed_value feature-sha)"
wip_hash="$(seed_value wip-hash)"
[[ -n "$expected" && -n "$main_seed" && -n "$feature_seed" && -n "$wip_hash" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$F" ]] || fail "you should end on $F (got: '$(repo_branch)')"
ok "back on $F"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main at the seed tip — the webhook fix rides $FIX (main is ${local_main:0:7})"
if in_repo cat-file -e "main:src/webhooks.py" 2>/dev/null; then
  fail "src/webhooks.py landed on main — keep the feature WIP off main; land only the config fix on $FIX"
fi
ok "main untouched"

[[ "$(in_repo rev-parse --verify "refs/heads/$FIX" 2>/dev/null || true)" != "" ]] \
  || fail "missing local branch $FIX — create it in a worktree from main"
fix_count="$(in_repo rev-list --count "$main_seed..$FIX" 2>/dev/null || echo 0)"
[[ "$fix_count" == "1" ]] || fail "$FIX should have exactly one commit beyond main (found $fix_count)"
got="$(in_repo show "$FIX:config/app.conf" 2>/dev/null | awk -F' *= *' '/^webhook_timeout_seconds/ {print $2; exit}' || true)"
[[ "$got" == "$expected" ]] || fail "$FIX:config/app.conf should have webhook_timeout_seconds = $expected (found '${got:-missing}')"
files="$(in_repo diff --name-only "$main_seed" "$FIX" 2>/dev/null || true)"
[[ "$files" == "config/app.conf" ]] || fail "$FIX commit must touch only config/app.conf (changed: $(echo $files))"
ok "hotfix committed on $FIX"

[[ "$(in_repo rev-parse "refs/heads/$F")" == "$feature_seed" ]] \
  || fail "$F gained or lost commits — leave the feature tip alone"
cur="$(in_repo hash-object src/webhooks.py 2>/dev/null || true)"
[[ "$cur" == "$wip_hash" ]] || fail "src/webhooks.py WIP was lost — worktree should leave your dirty tree alone"
status="$(in_repo status --porcelain 2>/dev/null || true)"
[[ "$status" == " M src/webhooks.py" ]] || fail "expected only ' M src/webhooks.py' (got: $(echo $status))"
ok "WIP still dirty on $F"

box_ok "test ! -e $WT" || fail "remove the extra worktree when done (git worktree remove $WT)"
wt_list="$(in_repo worktree list --porcelain 2>/dev/null || true)"
echo "$wt_list" | grep -q "$WT" && fail "worktree still registered at $WT — git worktree remove $WT"
ok "worktree removed"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] || fail "remote main moved — push only $FIX"
ok "remote main untouched"

fix_head="$(in_repo rev-parse "$FIX" 2>/dev/null || true)"
remote_fix="$(in_remote rev-parse "refs/heads/$FIX" 2>/dev/null || true)"
[[ -n "$remote_fix" ]] || fail "push $FIX to origin for review"
[[ "$remote_fix" == "$fix_head" ]] \
  || fail "push $FIX: remote is ${remote_fix:0:7}, local is ${fix_head:0:7}"
ok "pushed $FIX"

pass "webhook hotfix on $FIX via worktree, pushed; WIP intact on $F; main untouched"
