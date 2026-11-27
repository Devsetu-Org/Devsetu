#!/usr/bin/env bash
# Grade: squash five WIP commits into two clear ones, then force-with-lease push
# the feature. main stays at its seed tip locally and on origin.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

main_seed="$(seed_value main-sha)"
orig_tip="$(seed_value orig-tip)"
orig_tree="$(seed_value orig-tree)"
[[ -n "$main_seed" && -n "$orig_tip" && -n "$orig_tree" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_remote
need_repo

F=feature/csv-export
if ! repo_ok "git show-ref --verify --quiet refs/heads/$F"; then
  fail "no local $F yet — git fetch, then check out the remote feature (e.g. git switch $F)"
fi
box_ok "test ! -d $REPO/.git/rebase-merge && test ! -d $REPO/.git/rebase-apply" || fail "a rebase is still in progress — finish it (git rebase --continue)"

[[ "$(repo_branch)" == "$F" ]] \
  || fail "you should be on $F (got: '$(repo_branch)') — fetch if needed, check out origin/$F, then squash"
ok "on $F"

[[ "$(in_repo rev-parse refs/heads/main 2>/dev/null || true)" == "$main_seed" ]] || fail "main must stay untouched"
mb="$(in_repo merge-base "refs/heads/$F" refs/heads/main 2>/dev/null || true)"
[[ "$mb" == "$main_seed" ]] || fail "$F must still branch off main's tip"
ok "branch still starts at main"

tip="$(in_repo rev-parse "refs/heads/$F" 2>/dev/null || true)"
[[ "$tip" != "$orig_tip" ]] || fail "$F is unchanged — squash the WIP commits"

count="$(in_repo rev-list --count "refs/heads/main..refs/heads/$F" 2>/dev/null || echo 0)"
[[ "$count" == "2" ]] || fail "$F should have exactly 2 commits beyond main (found $count)"
merges="$(in_repo rev-list --merges --count "refs/heads/main..refs/heads/$F" 2>/dev/null || echo 0)"
[[ "$merges" == "0" ]] || fail "no merge commits allowed on $F"
[[ "$count" == "2" && "$merges" == "0" && "$tip" != "$orig_tip" ]] && ok "exactly two linear commits"

[[ "$(in_repo rev-parse "refs/heads/$F^{tree}" 2>/dev/null || true)" == "$orig_tree" ]] || fail "the final files differ from the original branch tip — rearrange history, don't change code"
ok "final content identical to the original work"

noisy_re='(^|[^a-z])(wip|fixup|squash|typo|tmp|temp|asdf|stuff|misc)([^a-z]|$)'
for c in $(in_repo rev-list "refs/heads/main..refs/heads/$F" 2>/dev/null || true); do
  subj="$(in_repo log -1 --format=%s "$c" 2>/dev/null || true)"
  lower="$(echo "$subj" | tr '[:upper:]' '[:lower:]')"
  words="$(echo "$subj" | wc -w | tr -d ' ')"
  if [[ "$words" -lt 2 || "${#subj}" -lt 12 || "${#subj}" -gt 72 || "$lower" =~ $noisy_re ]]; then
    fail "weak subject: '$subj' (${c:0:7}) — be specific, 12–72 chars, no wip/fixup/typo"
  fi
  empty="$(in_repo diff-tree --no-commit-id --name-only -r "$c" 2>/dev/null | grep -c . || true)"
  [[ "$empty" -ge 1 ]] || fail "commit ${c:0:7} is empty"
done
ok "clear subjects"

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$remote_main" ]] || fail "team remote has no main branch"
[[ "$remote_main" == "$main_seed" ]] \
  || fail "do not change main — remote main moved (found ${remote_main:0:7}, expected ${main_seed:0:7})"
ok "remote main untouched"

remote_br="$(in_remote rev-parse "refs/heads/$F" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push $F to origin — remote is missing the branch"
[[ "$remote_br" == "$tip" ]] \
  || fail "update remote $F after squash: remote is ${remote_br:0:7}, local tip is ${tip:0:7} (git push --force-with-lease origin $F)"
[[ "$remote_br" != "$orig_tip" ]] \
  || fail "remote $F is still the noisy tip — push the rewritten branch (git push --force-with-lease origin $F)"
ok "origin/$F matches squashed tip"

pass "WIP noise squashed into two clear commits and force-with-lease pushed; remote main untouched"
