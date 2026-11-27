#!/usr/bin/env bash
# Annotated v2.2.0 on main tip + pushed; hotfix/2.1.1 from v2.1.0 with a real
# patch commit, pushed; main tip unchanged.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

HB=hotfix/2.1.1
main_seed="$(seed_value main-sha)"
v210="$(seed_value v210-sha)"
v220_target="$(seed_value v220-target)"
want_interval="$(seed_value patch-health-interval)"
want_version="$(seed_value patch-version)"
[[ -n "$main_seed" && -n "$v210" && -n "$v220_target" && -n "$want_interval" && -n "$want_version" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main tip alone (main is ${local_main:0:7}, expected ${main_seed:0:7})"
ok "local main tip unchanged"

# Annotated tag v2.2.0 points at current main tip
tag_type="$(in_repo cat-file -t v2.2.0 2>/dev/null || true)"
[[ "$tag_type" == "tag" ]] \
  || fail "v2.2.0 must be an annotated tag (git tag -a), not a lightweight tag (got type '${tag_type:-missing}')"
tag_commit="$(in_repo rev-parse v2.2.0^{commit} 2>/dev/null || true)"
[[ "$tag_commit" == "$v220_target" ]] \
  || fail "v2.2.0 must point at today's main tip (${v220_target:0:7}), got ${tag_commit:0:7}"
ok "annotated v2.2.0 on main tip"

# Hotfix exists, based on v2.1.0, ahead by exactly one commit
hb="$(in_repo rev-parse "refs/heads/$HB" 2>/dev/null || true)"
[[ -n "$hb" ]] || fail "create branch $HB from the v2.1.0 tag"
in_repo merge-base --is-ancestor "$v210" "$HB" 2>/dev/null \
  || fail "$HB must be based on v2.1.0 — branch from that tag, not from main"
[[ "$hb" != "$v210" ]] \
  || fail "$HB still points at v2.1.0 — land the patch commit (health interval + VERSION) before pushing"
ahead="$(in_repo rev-list --count "$v210..$HB" 2>/dev/null || echo 0)"
[[ "$ahead" == "1" ]] \
  || fail "$HB should have exactly one commit beyond v2.1.0 (found $ahead)"
# Must not contain 2.2-only files
if in_repo cat-file -e "$HB:src/card_search.py" 2>/dev/null; then
  fail "$HB picked up 2.2 work — cut it from v2.1.0, not from main"
fi
ok "$HB is one patch commit beyond v2.1.0"

# Patch content
got_interval="$(in_repo show "$HB:config/app.conf" 2>/dev/null | awk -F' *= *' '/^check_interval_seconds/ {print $2; exit}' || true)"
[[ "$got_interval" == "$want_interval" ]] \
  || fail "$HB: set check_interval_seconds = $want_interval (found '${got_interval:-missing}')"
got_ver="$(in_repo show "$HB:VERSION" 2>/dev/null | tr -d '[:space:]' || true)"
[[ "$got_ver" == "$want_version" ]] \
  || fail "$HB: VERSION should be $want_version (found '${got_ver:-missing}')"
ok "patch content on $HB"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] || fail "remote main moved — do not push new commits to main"
ok "remote main untouched"

remote_tag="$(in_box "git -c safe.directory=$REMOTE -C $REMOTE rev-parse refs/tags/v2.2.0^{commit}" 2>/dev/null || true)"
[[ "$remote_tag" == "$v220_target" ]] \
  || fail "push the annotated tag: git push origin v2.2.0 (remote tag missing or wrong)"
ok "v2.2.0 pushed to origin"

remote_hb="$(in_remote rev-parse "refs/heads/$HB" 2>/dev/null || true)"
[[ -n "$remote_hb" ]] || fail "push $HB to origin"
[[ "$remote_hb" == "$hb" ]] \
  || fail "push $HB: remote is ${remote_hb:0:7}, local is ${hb:0:7}"
ok "$HB pushed to origin"

old="$(in_repo rev-parse v2.1.0^{commit} 2>/dev/null || true)"
[[ "$old" == "$v210" ]] || fail "do not move or delete tag v2.1.0"
ok "v2.1.0 still intact"

pass "v2.2.0 annotated+pushed; $HB patched from v2.1.0 and pushed; main untouched"
