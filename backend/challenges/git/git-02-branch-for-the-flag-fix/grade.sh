#!/usr/bin/env bash
# Grades the merged branch + atomic-commits lab (former git-02 + git-03).
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

main_seed="$(seed_value main-sha)"
base="$(seed_value base-sha)"
h_conf="$(seed_value hash-config)"
h_readme="$(seed_value hash-readme)"
h_main="$(seed_value hash-main)"
[[ -n "$main_seed" && -n "$base" && -n "$h_conf" && -n "$h_readme" && -n "$h_main" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_remote
need_repo

BR=fix/agentic-default

# --- from Branch for the Flag Fix ---
main_now="$(in_repo rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$main_now" == "$main_seed" ]] || fail "main moved — it must stay at the seed commit (found ${main_now:0:7}, expected ${main_seed:0:7}). Undo anything you committed on main."
ok "main is untouched"

tip="$(in_repo rev-parse --verify -q "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$tip" ]] || { fail "branch $BR does not exist"; exit 1; }
ok "branch $BR exists"

in_repo merge-base --is-ancestor "$main_seed" "$BR" 2>/dev/null || fail "$BR must be built on top of main"
ok "$BR is built on main"

got="$(in_repo show "$BR:config/app.conf" 2>/dev/null | awk -F' *= *' '/^agentic_sprints_default/ {print $2; exit}' || true)"
[[ "$got" == "beta" ]] || fail "$BR:config/app.conf should have agentic_sprints_default = beta (found: '${got:-missing}')"
ok "fix committed on the branch"

bug="$(in_repo show main:config/app.conf 2>/dev/null | awk -F' *= *' '/^agentic_sprints_default/ {print $2; exit}' || true)"
[[ "$bug" == "full" ]] || fail "main:config/app.conf should still have agentic_sprints_default = full"
ok "main still shows the bug"

an="$(in_repo log -1 --format=%ae "$BR" 2>/dev/null || true)"
[[ "$an" == "ada@forgeboard.internal" ]] || fail "tip of $BR should be authored by ada@forgeboard.internal (got: $an)"
ok "commit author"

# --- from Commit History That Tells a Story (on the fix branch) ---
in_repo merge-base --is-ancestor "$base" "$BR" 2>/dev/null || { fail "the seed commit is no longer in your history"; exit 1; }

count="$(in_repo rev-list --count "$base..$BR" 2>/dev/null || echo 0)"
[[ "$count" == "3" ]] || fail "expected exactly 3 commits on $BR beyond main (found $count)"
merges="$(in_repo rev-list --merges --count "$base..$BR" 2>/dev/null || echo 0)"
[[ "$merges" == "0" ]] || fail "history should be linear (no merge commits)"
ok "three linear commits on $BR"

[[ "$(blob_hash "$BR" config/app.conf)" == "$h_conf" ]] || fail "config/app.conf on $BR differs from the expected fix"
[[ "$(blob_hash "$BR" README.md)" == "$h_readme" ]] || fail "README.md on $BR differs from your original edit"
[[ "$(blob_hash "$BR" src/main.py)" == "$h_main" ]] || fail "src/main.py on $BR differs from your original edit"
ok "all three edits preserved on $BR"

seen=""
bad=""
for c in $(in_repo rev-list --reverse "$base..$BR" 2>/dev/null || true); do
  files="$(in_repo diff-tree --no-commit-id --name-only -r "$c" 2>/dev/null || true)"
  n="$(echo "$files" | grep -c . || true)"
  if [[ "$n" != "1" ]]; then bad="$bad ${c:0:7}($n files)"; fi
  seen="$seen $(echo $files)"
done
[[ -z "$bad" ]] || fail "each commit must touch exactly one file; offending:$bad"
for f in config/app.conf README.md src/main.py; do
  [[ " $seen " == *" $f "* ]] || fail "no commit on $BR contains $f"
done
ok "one file per commit"

generic_re='^(wip|update|updates|updated|change|changes|fix|fixes|misc|stuff|commit|test|tmp|asdf|\.+)$'
for s in $(in_repo rev-list "$base..$BR" 2>/dev/null || true); do
  subj="$(in_repo log -1 --format=%s "$s" 2>/dev/null || true)"
  lower="$(echo "$subj" | tr '[:upper:]' '[:lower:]')"
  words="$(echo "$subj" | wc -w | tr -d ' ')"
  if [[ "$words" -lt 2 || "${#subj}" -lt 12 || "${#subj}" -gt 72 || "$lower" =~ $generic_re ]]; then
    fail "weak commit subject: '$subj' (${s:0:7}) — be specific, 12–72 characters, two+ words"
  fi
done
ok "commit subjects checked"

repo_clean || fail "working tree is not clean — commit or discard your changes"
ok "working tree clean"

# Pushed the fix branch; remote main still the seed tip
remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$remote_main" ]] || fail "team remote has no main branch"
[[ "$remote_main" == "$main_seed" ]] \
  || fail "team remote main moved — push only $BR (remote main is ${remote_main:0:7}, expected ${main_seed:0:7})"
ok "remote main untouched"

remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push your branch: team remote has no $BR (git push -u origin $BR)"
[[ "$remote_br" == "$tip" ]] \
  || fail "push your branch: remote $BR is ${remote_br:0:7}, local is ${tip:0:7} (git push -u origin $BR)"
ok "pushed $BR to origin"

pass "fix lives on $BR as three atomic commits, pushed; main is untouched"
