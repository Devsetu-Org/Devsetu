#!/usr/bin/env bash
# On fix/agentic-default: .env.local untracked+ignored, .cache ignored, cleanup pushed; main untouched.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=fix/agentic-default
main_seed="$(seed_value main-sha)"
base="$(seed_value branch-base)"
tip_before="$(seed_value tip-before)"
[[ -n "$main_seed" && -n "$base" && -n "$tip_before" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$BR" ]] || fail "you should be on $BR (got: '$(repo_branch)')"
ok "on $BR"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main alone (main is ${local_main:0:7}, expected ${main_seed:0:7})"
# main should still have the bad full default
main_conf="$(in_repo show main:config/app.conf 2>/dev/null || true)"
echo "$main_conf" | grep -q '^agentic_sprints_default = full$' \
  || fail "main should still have agentic_sprints_default = full — do not fix main in this lab"
ok "local main untouched"

box_ok "test -f $REPO/.env.local" \
  || fail ".env.local is missing from disk — untrack it with git rm --cached, do not delete the file"
ok ".env.local still on disk"

# Prefer cat-file: blob_hash used to false-fail when .env.local was on disk but
# untracked (rev-parse echoes HEAD:.env.local). Absence = not in the tip tree.
if repo_ok "git cat-file -e HEAD:.env.local"; then
  fail ".env.local is still tracked in HEAD — git rm --cached .env.local and commit"
fi
ok ".env.local not in HEAD tree"

repo_ok "git check-ignore -q .env.local" \
  || fail ".env.local is not ignored — add it to .gitignore"
ok ".env.local is ignored"

repo_ok "git check-ignore -q .cache/board.json" \
  || fail ".cache/ is not ignored — add .cache/ (or .cache) to .gitignore so local cache files stay out of commits"
ok ".cache is ignored"

# Flag-fix story still on the branch
feat_conf="$(in_repo show HEAD:config/app.conf 2>/dev/null || true)"
echo "$feat_conf" | grep -q '^agentic_sprints_default = beta$' \
  || fail "$BR should still keep agentic_sprints_default = beta from the flag fix"
ok "agentic flag fix still on $BR"

after="$(in_repo rev-list --count "$tip_before..HEAD" 2>/dev/null || echo 0)"
[[ "$after" -ge 1 ]] || fail "expected a cleanup commit on $BR after the leaked .env.local tip"
ok "cleanup commit present"

status="$(in_repo status --porcelain 2>/dev/null || true)"
[[ -z "$status" ]] || fail "working tree still has tracked/unignored changes (git status: $(echo $status))"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] \
  || fail "remote main moved — push only $BR (remote main ${remote_main:0:7})"
ok "remote main untouched"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push your fix branch: team remote has no $BR"
[[ "$remote_br" == "$head" ]] \
  || fail "push your fix branch: remote $BR is ${remote_br:0:7}, local is ${head:0:7}"
ok "pushed $BR to origin"

pass ".env.local untracked and ignored on $BR, pushed; agentic flag fix kept; main untouched"
