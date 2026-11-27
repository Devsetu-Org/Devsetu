#!/usr/bin/env bash
# Revert on fix/reenable-board-notify, push that branch; leave local + remote main at seed tip.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=fix/reenable-board-notify
bad="$(seed_value bad-sha)"
tip="$(seed_value main-sha)"
good_hash="$(seed_value good-notify-hash)"
sla_hash="$(seed_value sla-hash)"
[[ -n "$bad" && -n "$tip" && -n "$good_hash" && -n "$sla_hash" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$BR" ]] || fail "you should be on $BR (got: '$(repo_branch)') — branch from main, revert there, push for review"
box_ok "test ! -f $REPO/.git/REVERT_HEAD" || fail "a revert is still in progress — finish it"

# local main still at seed tip (do not merge the fix onto main yourself)
local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$tip" ]] \
  || fail "leave local main at the seed tip — your fix rides $BR for review (main is ${local_main:0:7}, expected ${tip:0:7})"
ok "local main untouched"

# history kept on the fix branch
in_repo merge-base --is-ancestor "$bad" HEAD 2>/dev/null || fail "the bad commit is gone from history — revert it, don't erase it"
in_repo merge-base --is-ancestor "$tip" HEAD 2>/dev/null || fail "the original tip of main is gone — history was rewritten"
head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
[[ "$head" != "$tip" ]] || fail "no new commit yet — create a revert commit on $BR"
ok "history preserved, new commit on $BR"

# a revert commit exists
revert_found=0
for c in $(in_repo rev-list "$tip..HEAD" 2>/dev/null || true); do
  full="$(in_repo log -1 --format=%B "$c" 2>/dev/null || true)"
  lower="$(echo "$full" | tr '[:upper:]' '[:lower:]')"
  if [[ "$full" == *"$bad"* || "$lower" == *revert* ]]; then revert_found=1; fi
done
[[ "$revert_found" == "1" ]] || fail "no revert commit found after the original tip (use git revert)"
ok "revert commit present"

# content
[[ "$(blob_hash HEAD src/board_notify.py)" == "$good_hash" ]] || fail "src/board_notify.py is not back to the correct NOTIFY_ENABLED = True version"
[[ "$(blob_hash HEAD src/card_sla.py)" == "$sla_hash" ]] || fail "Priya's later card SLA helper commit (src/card_sla.py) was lost or altered"
ok "bad change undone, card SLA helper kept"

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

# Pushed the fix branch; remote main still the seed tip (hook also rejects main pushes)
remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$remote_main" ]] || fail "team remote has no main branch"
[[ "$remote_main" == "$tip" ]] \
  || fail "team remote main moved — push only $BR for review (remote main is ${remote_main:0:7}, expected ${tip:0:7})"
ok "remote main untouched"

remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push your fix branch: team remote has no $BR (git push -u origin $BR)"
[[ "$remote_br" == "$head" ]] \
  || fail "push your fix branch: remote $BR is ${remote_br:0:7}, local is ${head:0:7}"
ok "pushed $BR to origin for review"

pass "notify-off reverted on $BR and pushed for merge onto main; card SLA helper kept, main untouched"
