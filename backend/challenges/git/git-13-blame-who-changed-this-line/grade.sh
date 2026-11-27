#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

want="$(seed_value author-email)"
main_seed="$(seed_value main-sha)"
[[ -n "$want" && -n "$main_seed" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo

need_answer author-email "write the author's email there"
got="$(answer author-email | head -n1 | tr -d '[:space:]<>' | tr '[:upper:]' '[:lower:]')"
if [[ -n "$got" ]]; then
  if [[ "$got" == "$want" ]]; then
    ok "found the author of the last change"
  else
    fail "that is not the person who last changed the NOTIFY_BATCH_MULTIPLIER line — look at blame for that line, not the whole file"
  fi
fi

[[ "$(in_repo rev-parse HEAD 2>/dev/null || true)" == "$main_seed" ]] || fail "the repo history was changed — this lab is read-only"
ok "history untouched"

repo_clean || fail "working tree is not clean — undo any edits (git status)"
ok "working tree clean"

pass "correct author identified"
