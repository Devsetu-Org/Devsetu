#!/usr/bin/env bash
# commit-msg hook rejects non-FB subjects; valid commit on fix branch pushed; main untouched.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=fix/hook-ticket-prefix
main_seed="$(seed_value main-sha)"
[[ -n "$main_seed" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

HOOK="$REPO/.git/hooks/commit-msg"
box_ok "test -f $HOOK" || fail "create .git/hooks/commit-msg"
box_ok "test -x $HOOK" || fail ".git/hooks/commit-msg must be executable (chmod +x)"
ok "commit-msg hook present and executable"

# Hook must reject a bad subject and accept a good one (run as learner)
bad_out="$(in_box "runuser -u learner -- env HOME=/home/learner bash -c $(printf '%q' "
cd $REPO
echo 'no ticket here' > /tmp/cm-bad
if .git/hooks/commit-msg /tmp/cm-bad; then echo HOOK_ACCEPTED_BAD; else echo HOOK_REJECTED_BAD; fi
")" 2>/dev/null || true)"
echo "$bad_out" | grep -q HOOK_REJECTED_BAD \
  || fail "hook must reject subjects that lack an FB-<number> ticket prefix"
ok "hook rejects bad subjects"

good_out="$(in_box "runuser -u learner -- env HOME=/home/learner bash -c $(printf '%q' "
cd $REPO
echo 'FB-1842 Document invite hook policy in README' > /tmp/cm-good
if .git/hooks/commit-msg /tmp/cm-good; then echo HOOK_ACCEPTED_GOOD; else echo HOOK_REJECTED_GOOD; fi
")" 2>/dev/null || true)"
echo "$good_out" | grep -q HOOK_ACCEPTED_GOOD \
  || fail "hook must accept subjects that start with FB-<number>"
ok "hook accepts FB- ticket subjects"

[[ "$(repo_branch)" == "$BR" ]] || fail "you should be on $BR (got: '$(repo_branch)')"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] || fail "leave main alone (main is ${local_main:0:7})"
ok "main untouched"

# One+ commits on fix branch with FB- subject
count="$(in_repo rev-list --count "$main_seed..HEAD" 2>/dev/null || echo 0)"
[[ "$count" -ge 1 ]] || fail "make at least one commit on $BR after installing the hook"
subj="$(in_repo log -1 --format=%s HEAD 2>/dev/null || true)"
echo "$subj" | grep -Eq '^FB-[0-9]+' \
  || fail "latest commit subject must start with FB-<number> (got: '$subj')"
ok "valid ticket-prefixed commit on $BR"

repo_clean || fail "working tree is not clean"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] || fail "remote main moved — push only $BR"
ok "remote main untouched"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push $BR to origin"
[[ "$remote_br" == "$head" ]] || fail "push $BR: remote ${remote_br:0:7} != local ${head:0:7}"
ok "pushed $BR"

pass "commit-msg hook enforces FB- tickets; $BR committed and pushed; main untouched"
