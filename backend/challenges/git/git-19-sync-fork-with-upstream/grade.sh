#!/usr/bin/env bash
# upstream remote added; local+origin main match org tip; stale origin tracking ref pruned.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

UPSTREAM=/srv/git/forgeboard-sprint-service.git
STALE_BR=feature/card-colors
upstream_main="$(seed_value upstream-main)"
audit_hash="$(seed_value audit-hash)"
[[ -n "$upstream_main" && -n "$audit_hash" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote
box_ok "test -d $UPSTREAM" || { fail "upstream remote repo missing; reset the lab"; exit 1; }

[[ "$(repo_branch)" == "main" ]] || fail "you should end on main (got: '$(repo_branch)')"

up_url="$(in_repo remote get-url upstream 2>/dev/null || true)"
[[ -n "$up_url" ]] || fail "add the org remote: git remote add upstream learner@git.forgeboard.internal:$UPSTREAM"
echo "$up_url" | grep -q 'forgeboard-sprint-service' \
  || fail "upstream should point at forgeboard-sprint-service.git (got: $up_url)"
ok "upstream remote configured"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$upstream_main" ]] \
  || fail "fast-forward main to match upstream (main is ${local_main:0:7}, upstream tip ${upstream_main:0:7})"
[[ "$(blob_hash HEAD src/invite_audit.py)" == "$audit_hash" ]] \
  || fail "src/invite_audit.py missing on main — merge/rebase upstream/main into your main"
ok "local main matches upstream"

origin_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$origin_main" == "$upstream_main" ]] \
  || fail "push your synced main to origin (origin main is ${origin_main:0:7})"
ok "origin main synced"

org_main="$(in_box "git -c safe.directory=$UPSTREAM -C $UPSTREAM rev-parse refs/heads/main" 2>/dev/null || true)"
[[ "$org_main" == "$upstream_main" ]] || fail "do not rewrite the org upstream remote"
ok "org upstream untouched"

stale_ref="$(in_repo show-ref "refs/remotes/origin/$STALE_BR" 2>/dev/null || true)"
# show-ref prints the ref line if present; ignore fatals via empty check on SHA-looking output
if echo "$stale_ref" | grep -q "refs/remotes/origin/$STALE_BR"; then
  fail "stale remote-tracking branch origin/$STALE_BR still present — git fetch --prune origin"
fi
ok "pruned deleted origin/$STALE_BR"

repo_clean || fail "working tree is not clean"
ok "working tree clean"

pass "fork main synced from upstream and pushed; stale origin ref pruned"
