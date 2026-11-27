#!/usr/bin/env bash
# Grade: rebase feature/board-filters onto main (resolve README conflict keeping
# both docs), then force-with-lease push the rewritten feature. Remote main stays.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

main_seed="$(seed_value main-sha)"
orig="$(seed_value orig-feature-sha)"
f_hash="$(seed_value filters-hash)"
c_hash="$(seed_value conf-hash)"
s_hash="$(seed_value sprints-hash)"
filters_phrase="$(seed_value readme-filters-phrase)"
label_phrase="$(seed_value readme-label-phrase)"
[[ -n "$main_seed" && -n "$orig" && -n "$f_hash" && -n "$filters_phrase" && -n "$label_phrase" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_remote
need_repo

F=feature/board-filters
if ! repo_ok "git show-ref --verify --quiet refs/heads/$F"; then
  fail "no local $F yet — git fetch, then check out the remote feature (e.g. git switch $F)"
fi

[[ "$(repo_branch)" == "$F" ]] \
  || fail "you should be on $F (got: '$(repo_branch)') — fetch if needed, check out origin/$F, then rebase onto main"
ok "on $F"

box_ok "test ! -d $REPO/.git/rebase-merge && test ! -d $REPO/.git/rebase-apply" \
  || fail "a rebase is still in progress — finish it (resolve README.md, git add, git rebase --continue)"

[[ "$(in_repo rev-parse refs/heads/main 2>/dev/null || true)" == "$main_seed" ]] \
  || fail "main must not change — rebase the feature onto main, not the other way round"
ok "main untouched"

mb="$(in_repo merge-base "refs/heads/$F" refs/heads/main 2>/dev/null || true)"
[[ "$mb" == "$main_seed" ]] || fail "$F is not based on main's current tip yet (rebase onto main)"
[[ "$mb" == "$main_seed" ]] && ok "$F sits on top of main"

tip="$(in_repo rev-parse "refs/heads/$F" 2>/dev/null || true)"
[[ "$tip" != "$orig" ]] || fail "$F is unchanged — its commits must be replayed on top of main"

merges="$(in_repo rev-list --merges --count "refs/heads/main..refs/heads/$F" 2>/dev/null || echo 0)"
[[ "$merges" == "0" ]] || fail "history must be linear — found $merges merge commit(s) on $F"
count="$(in_repo rev-list --count "refs/heads/main..refs/heads/$F" 2>/dev/null || echo 0)"
[[ "$count" == "2" ]] || fail "$F should have exactly 2 commits beyond main (found $count)"
[[ "$merges" == "0" && "$count" == "2" && "$tip" != "$orig" ]] && ok "linear history, two commits"

subs="$(in_repo log --reverse --format=%s "refs/heads/main..refs/heads/$F" 2>/dev/null | tr '\n' '|' || true)"
[[ "$subs" == "Add normalize_column for board filters|Document board filters in README|" ]] \
  || fail "the original two commit subjects were not preserved (got: $subs)"

[[ "$(blob_hash "$F" src/filters.py)" == "$f_hash" ]] || fail "src/filters.py changed on $F"
[[ "$(blob_hash "$F" config/app.conf)" == "$c_hash" ]] || fail "$F is missing main's config/app.conf change"
[[ "$(blob_hash "$F" src/sprints.py)" == "$s_hash" ]] || fail "$F is missing main's src/sprints.py change"
ok "feature filters.py plus main's updates"

readme="$(in_repo show "$F:README.md" 2>/dev/null || true)"
[[ -n "$readme" ]] || fail "README.md missing on $F"
echo "$readme" | grep -qF "$filters_phrase" \
  || fail "README.md on $F is missing your board-filters docs (expected mention of $filters_phrase) — keep both sides when resolving the rebase conflict"
echo "$readme" | grep -qF "$label_phrase" \
  || fail "README.md on $F is missing main's board_label docs — keep both sides when resolving the rebase conflict"
echo "$readme" | grep -qE 'todo|doing|done|blocked' \
  || fail "README.md on $F should still document the filter columns (todo / doing / done / blocked)"
if echo "$readme" | grep -qE '^(<<<<<<<|=======|>>>>>>>)'; then
  fail "conflict markers are still in README.md on $F — combine both docs and remove every marker"
fi
if repo_ok "git grep -qE '^(<<<<<<<|=======|>>>>>>>)' $F -- ."; then
  fail "conflict markers are still committed on $F"
fi
ok "README keeps both docs, no conflict markers"

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
  || fail "update remote $F after rebase: remote is ${remote_br:0:7}, local tip is ${tip:0:7} (git push --force-with-lease origin $F)"
[[ "$remote_br" != "$orig" ]] \
  || fail "remote $F is still the pre-rebase tip — push the rewritten branch (git push --force-with-lease origin $F)"
ok "origin/$F matches rebased tip"

pass "feature/board-filters rebased onto main, README resolved, force-with-lease pushed; remote main untouched"
