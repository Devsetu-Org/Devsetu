#!/usr/bin/env bash
# Grade: fetch/checkout feature/board-summary, merge advanced main into it,
# resolve, push the feature. Remote main must stay at its seed tip.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=feature/board-summary
feature="$(seed_value feature-sha)"
main_seed="$(seed_value main-sha)"
outdated="$(seed_value outdated-main-sha)"
s_py_hash="$(seed_value summary-hash)"
sprints_hash="$(seed_value sprints-hash)"
want="$(seed_value main-summary-channel)"
[[ -n "$feature" && -n "$main_seed" && -n "$outdated" && -n "$s_py_hash" && -n "$sprints_hash" && -n "$want" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_remote
need_repo

if ! repo_ok "git show-ref --verify --quiet refs/heads/$BR"; then
  fail "no local $BR yet — git fetch, then check out the remote feature (e.g. git checkout $BR)"
fi

[[ "$(repo_branch)" == "$BR" ]] \
  || fail "you should be on $BR (got: '$(repo_branch)') — fetch if needed, check out the remote feature, then merge main into it"
ok "on $BR"

box_ok "test ! -f $REPO/.git/MERGE_HEAD" \
  || fail "a merge is still in progress — finish it (resolve, git add, commit)"

# Local main may stay outdated or catch up via pull — only reject weird rewrites.
main_now="$(in_repo rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$main_now" ]] || fail "local main branch is missing"
if [[ "$main_now" != "$main_seed" ]]; then
  in_repo merge-base --is-ancestor "$main_now" "$main_seed" 2>/dev/null \
    || fail "local main looks rewritten (found ${main_now:0:7}) — leave main alone or pull to update it; do not land work onto main"
fi
ok "local main is ok (outdated or pulled tip)"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
[[ "$head" != "$feature" ]] \
  || fail "merge main into your feature — $BR has not moved yet (fetch advanced main / origin/main first)"
ok "$BR tip moved"

in_repo merge-base --is-ancestor "$feature" HEAD 2>/dev/null \
  || fail "$BR's original commits were lost (history rewritten?)"
in_repo merge-base --is-ancestor "$main_seed" HEAD 2>/dev/null \
  || fail "merge advanced main into your feature — production tip is not an ancestor of $BR yet (did you fetch / merge origin/main?)"
ok "$BR includes main's seed tip"

# Tip should be a merge of main into the feature (second parent = advanced main seed).
p1="$(in_repo rev-parse 'HEAD^1' 2>/dev/null || true)"
p2="$(in_repo rev-parse 'HEAD^2' 2>/dev/null || true)"
[[ -n "$p1" && "$p1" == "$feature" && "$p2" == "$main_seed" ]] \
  || fail "the tip of $BR should be a merge of advanced main into your feature (fetch, resolve the conflict, then commit)"
ok "merge of main into $BR is the tip"

# Exactly one merge commit since the feature seed tip.
merge_count="$(in_repo rev-list --count --merges "${feature}..HEAD" 2>/dev/null || echo 0)"
[[ "$merge_count" == "1" ]] \
  || fail "expected exactly one merge commit on $BR (got ${merge_count}) — sync with a single merge of main"
ok "exactly one merge commit"

[[ "$(blob_hash HEAD src/board_summary.py)" == "$s_py_hash" ]] \
  || fail "src/board_summary.py is missing or changed on $BR"
[[ "$(blob_hash HEAD src/sprints.py)" == "$sprints_hash" ]] \
  || fail "src/sprints.py on $BR is not main's board_label version — merge advanced main into your feature"
in_repo show HEAD:config/app.conf 2>/dev/null | grep -q '^\[board_summary\]' \
  || fail "config/app.conf on $BR lacks the [board_summary] section"
ok "auto-merged summary/board content is correct"

conf="$(in_repo show HEAD:config/app.conf 2>/dev/null || true)"
got="$(echo "$conf" | awk -F' *= *' '/^channel/ {print $2; exit}')"
[[ "$got" == "$want" ]] || fail "channel should be $want (production's value); found '${got:-missing}'"
echo "$conf" | grep -qE '^enabled *= *true$' || fail "enabled = true (from the feature) is missing"
echo "$conf" | grep -qE '^workers *= *4$' || fail "workers = 4 (from main) is missing"
[[ "$(echo "$conf" | grep -c '^channel')" == "1" ]] || fail "channel must appear exactly once"
ok "resolved channel config has the right values"

if repo_ok "git grep -qE '^(<<<<<<<|=======|>>>>>>>)' HEAD -- ."; then
  fail "conflict markers are still committed on $BR"
fi
if repo_ok "grep -rqE '^(<<<<<<<|>>>>>>>) ' config src README.md"; then
  fail "conflict markers are still in your working files"
fi
ok "no conflict markers"

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$remote_main" ]] || fail "team remote has no main branch"
[[ "$remote_main" == "$main_seed" ]] \
  || fail "do not change main — remote main moved (found ${remote_main:0:7}, expected ${main_seed:0:7})"
ok "remote main untouched"

remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push $BR to origin — remote is missing the branch"
[[ "$remote_br" == "$head" ]] \
  || fail "push $BR to origin: remote is ${remote_br:0:7}, local tip is ${head:0:7} (git push -u origin $BR)"
ok "origin/$BR matches local tip"

pass "main merged into $BR, conflict resolved, feature pushed; remote main untouched"
