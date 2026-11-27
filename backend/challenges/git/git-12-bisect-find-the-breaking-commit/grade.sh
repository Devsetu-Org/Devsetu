#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

bad="$(seed_value bad-sha)"
main_seed="$(seed_value main-sha)"
[[ -n "$bad" && -n "$main_seed" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo

# answer file
need_answer bad-commit "write the first bad commit's SHA there"
ans="$(answer bad-commit | head -n1 | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
if [[ -n "$ans" ]]; then
  [[ "$ans" =~ ^[0-9a-f]{7,40}$ ]] || fail "~/answers/bad-commit should contain a commit SHA (7–40 hex characters)"
  [[ "$bad" == "$ans"* && ${#ans} -ge 7 ]] || fail "that is not the first bad commit (check with: git bisect run ./check.sh)"
  [[ "$bad" == "$ans"* && ${#ans} -ge 7 ]] && ok "identified the breaking commit"
fi

# repo left in a sane state
box_ok "test ! -f $REPO/.git/BISECT_LOG && test ! -f $REPO/.git/BISECT_START" || fail "a bisect session is still active — run: git bisect reset"
[[ "$(repo_branch)" == "main" ]] || fail "HEAD should be back on main (got: '$(repo_branch)') — run git bisect reset"
[[ "$(in_repo rev-parse refs/heads/main 2>/dev/null || true)" == "$main_seed" ]] || fail "main's history was changed — it must match the original"
ok "main restored"

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

pass "first bad commit found via bisect"
