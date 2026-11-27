#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

want="$(seed_value final-invite-ttl)"
main_seed="$(seed_value main-sha)"
feature="$(seed_value feature-sha)"
readme_hash="$(seed_value readme-hash)"
invites_hash="$(seed_value invites-hash)"
[[ -n "$want" && -n "$main_seed" && -n "$feature" && -n "$readme_hash" && -n "$invites_hash" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo

# --- no leftovers in progress ---
box_ok "test ! -f $REPO/.git/MERGE_HEAD" || fail "the merge is still in progress — resolve config/app.conf, git add it, and commit"
branch="$(repo_branch)"
[[ "$branch" == "main" ]] || fail "HEAD must be on branch main (it is ${branch:-detached})"
[[ "$branch" == "main" ]] && ok "on branch main"

# --- main has everything ---
in_repo merge-base --is-ancestor "$main_seed" refs/heads/main 2>/dev/null || fail "main's original hotfix commit is not in main's history"
in_repo merge-base --is-ancestor "$feature" refs/heads/main 2>/dev/null || fail "main does not contain the feature/workspace-invites commits"
[[ "$(blob_hash main src/invites.py)" == "$invites_hash" ]] || fail "src/invites.py is missing on main"
ok "main contains hotfix + workspace-invites feature"

[[ "$(blob_hash main README.md)" == "$readme_hash" ]] || fail "README.md on main lacks the workspace-invites docs (the orphaned commit was lost)"
cnt="$(in_repo log --format=%s refs/heads/main 2>/dev/null | grep -c 'Document workspace invites in README' || true)"
[[ "$cnt" -ge 1 ]] || fail "the commit 'Document workspace invites in README' is not in main's history"
[[ "$(blob_hash main README.md)" == "$readme_hash" && "$cnt" -ge 1 ]] && ok "orphaned commit rescued"

# --- config content ---
conf="$(in_repo show main:config/app.conf 2>/dev/null || true)"
got="$(echo "$conf" | awk -F' *= *' '/^invite_link_ttl_hours/ {print $2; exit}')"
[[ "$got" == "$want" ]] || fail "invite_link_ttl_hours on main should be $want (the ops sign-off); found '${got:-missing}'"
[[ "$(echo "$conf" | grep -c '^invite_link_ttl_hours')" == "1" ]] || fail "invite_link_ttl_hours must appear exactly once"
echo "$conf" | grep -qE '^workers *= *4$' || fail "workers = 4 is missing from config/app.conf"
echo "$conf" | grep -q '^\[invites\]' || fail "the [invites] section is missing"
echo "$conf" | grep -qE '^redeem_code_length *= *8$' || fail "redeem_code_length = 8 is missing"
ok "config/app.conf resolved correctly"

# --- no markers, no junk ---
if repo_ok "git grep -qE '^(<<<<<<<|=======|>>>>>>>)' main -- ."; then
  fail "conflict markers are committed on main"
fi
junk="$(in_repo ls-tree -r --name-only refs/heads/main 2>/dev/null | grep -E '\.(orig|rej|bak)$' || true)"
[[ -z "$junk" ]] || fail "leftover files are committed on main: $(echo $junk)"
ok "no conflict markers or leftover files in main"

repo_clean || fail "working tree is not clean (leftover .orig/.rej files? uncommitted changes?)"
ok "working tree clean"

pass "invite merge mess untangled"
