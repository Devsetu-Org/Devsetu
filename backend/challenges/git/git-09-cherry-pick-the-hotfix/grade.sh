#!/usr/bin/env bash
# Grade: cherry-pick HOTFIX onto release/2.1 (resolve sprints.py conflict keeping
# the safe empty-board clamp), leave main untouched, plain-push the release tip.
# Remote main stays. Fail if conflict markers or CHERRY_PICK_HEAD remain.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

rel_seed="$(seed_value release-sha)"
main_seed="$(seed_value main-sha)"
hotfix="$(seed_value hotfix-sha)"
s_hash="$(seed_value sprints-hash)"
r_hash="$(seed_value release-readme-hash)"
batch="$(seed_value batch)"
[[ -n "$rel_seed" && -n "$main_seed" && -n "$hotfix" && -n "$s_hash" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_remote
need_repo

R=release/2.1
box_ok "test ! -f $REPO/.git/CHERRY_PICK_HEAD" \
  || fail "a cherry-pick is still in progress — resolve src/sprints.py, git add it, then git cherry-pick --continue"

[[ "$(in_repo rev-parse refs/heads/main 2>/dev/null || true)" == "$main_seed" ]] \
  || fail "main must stay exactly as it was — apply the fix onto $R, do not rewrite main"
ok "main untouched"

in_repo merge-base --is-ancestor "$rel_seed" "refs/heads/$R" 2>/dev/null \
  || { fail "$R lost its original history"; exit 1; }
count="$(in_repo rev-list --count "$rel_seed..refs/heads/$R" 2>/dev/null || echo 0)"
[[ "$count" == "1" ]] || fail "$R should have exactly 1 new commit beyond the pre-pick tip (found $count)"
merges="$(in_repo rev-list --merges --count "$rel_seed..refs/heads/$R" 2>/dev/null || echo 0)"
[[ "$merges" == "0" ]] || fail "$R should get a single applied fix commit, not a merge"
[[ "$count" == "1" && "$merges" == "0" ]] && ok "one new commit on $R"

[[ "$(blob_hash "$R" src/sprints.py)" == "$s_hash" ]] \
  || fail "src/sprints.py on $R must keep the HOTFIX empty-board clamp (digest_batch_size, batch=$batch) — not the release's temporary helper"
ok "hotfix clamp on $R"

if repo_ok "git cat-file -e refs/heads/$R:src/capacity.py"; then
  fail "src/capacity.py is on $R — unreleased work leaked into the release (you brought more than the hotfix)"
else
  ok "no unreleased capacity module on $R"
fi
[[ "$(blob_hash "$R" README.md)" == "$r_hash" ]] \
  || fail "README.md on $R changed — capacity docs must not appear on the release"

if repo_ok "git grep -qE '^(<<<<<<<|=======|>>>>>>>)' refs/heads/$R -- ."; then
  fail "conflict markers are still committed on $R — keep the HOTFIX clamp and remove every marker"
fi
if repo_ok "grep -rqE '^(<<<<<<<|>>>>>>>) ' src README.md"; then
  fail "conflict markers are still in your working files"
fi
ok "no conflict markers"

# Optional answer file
if box_ok "test -f /home/learner/answers/hotfix-sha"; then
  ans="$(answer hotfix-sha)"
  if [[ ${#ans} -ge 7 && "$hotfix" == "$ans"* ]]; then
    ok "hotfix-sha answer matches"
  else
    fail "~/answers/hotfix-sha does not match the hotfix commit on main (remove the file or fix it)"
  fi
fi

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

tip="$(in_repo rev-parse "refs/heads/$R" 2>/dev/null || true)"
[[ -n "$tip" ]] || { fail "$R tip missing"; exit 1; }

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$remote_main" ]] || fail "team remote has no main branch"
[[ "$remote_main" == "$main_seed" ]] \
  || fail "do not change main — remote main moved (found ${remote_main:0:7}, expected ${main_seed:0:7})"
ok "remote main untouched"

remote_rel="$(in_remote rev-parse "refs/heads/$R" 2>/dev/null || true)"
[[ -n "$remote_rel" ]] || fail "push $R to origin — remote is missing the branch"
[[ "$remote_rel" != "$rel_seed" ]] \
  || fail "push $R to origin — remote still has the pre-fix tip (git push origin $R)"
[[ "$remote_rel" == "$tip" ]] \
  || fail "push $R to origin: remote is ${remote_rel:0:7}, local tip is ${tip:0:7} (git push origin $R)"
ok "origin/$R matches local tip"

pass "hotfix landed on $R (conflict resolved) and pushed; remote main untouched"
