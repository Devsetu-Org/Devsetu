#!/usr/bin/env bash
# fix/restore-notify-format has notify_format.py restored; cleanup edits kept;
# pushed; main tip unchanged. Full revert of the cleanup commit must fail.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=fix/restore-notify-format
main_seed="$(seed_value main-sha)"
good_hash="$(seed_value good-format-hash)"
keep_notify="$(seed_value keep-board-notify-hash)"
keep_readme="$(seed_value keep-readme-hash)"
[[ -n "$main_seed" && -n "$good_hash" && -n "$keep_notify" && -n "$keep_readme" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$BR" ]] \
  || fail "you should be on $BR (got: '$(repo_branch)') — restore on a fix branch, not on main"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main at the seed tip — restore on $BR (main is ${local_main:0:7}, expected ${main_seed:0:7})"
# main tip must still lack the file (use cat-file, not blob_hash — missing path fatals)
if repo_ok "git cat-file -e main:src/notify_format.py"; then
  fail "src/notify_format.py must not return on main in this lab — keep the restore on $BR"
fi
ok "main untouched"

[[ "$(blob_hash HEAD src/notify_format.py)" == "$good_hash" ]] \
  || fail "src/notify_format.py on $BR must match the deleted helper exactly (restore that path from history)"
body="$(in_repo show HEAD:src/notify_format.py 2>/dev/null || true)"
echo "$body" | grep -q 'def format_notify_payload' \
  || fail "restored file must still define format_notify_payload"
ok "notify format helper restored on $BR"

# Revert of the whole cleanup commit would undo these wanted edits.
[[ "$(blob_hash HEAD src/board_notify.py)" == "$keep_notify" ]] \
  || fail "src/board_notify.py lost the cleanup trim — do not revert the whole cleanup commit; restore only src/notify_format.py"
notify_body="$(in_repo show HEAD:src/board_notify.py 2>/dev/null || true)"
echo "$notify_body" | grep -q 'event == "card_moved"' \
  || fail "keep the cleanup should_notify trim (card_moved only) on $BR"
[[ "$(blob_hash HEAD README.md)" == "$keep_readme" ]] \
  || fail "README.md lost the cleanup edits — do not revert the whole cleanup commit; restore only src/notify_format.py"
ok "cleanup edits kept (revert of the whole commit would undo them)"

repo_clean || fail "working tree is not clean"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] || fail "remote main moved — push only $BR"
ok "remote main untouched"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push $BR to origin for review"
[[ "$remote_br" == "$head" ]] \
  || fail "push $BR: remote is ${remote_br:0:7}, local is ${head:0:7}"
ok "pushed $BR"

pass "format_notify_payload restored on $BR; cleanup kept; main untouched"
