#!/usr/bin/env bash
# Feature branch history has no secret string; branch pushed; main untouched.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=feature/invite-redeem-docs
SECRET="$(seed_value secret-string)"
main_seed="$(seed_value main-sha)"
[[ -n "$SECRET" && -n "$main_seed" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$BR" ]] || fail "you should be on $BR (got: '$(repo_branch)')"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main alone (main is ${local_main:0:7}, expected ${main_seed:0:7})"
ok "main untouched"

# Rewrite required — tip-only delete still leaves the key in older commits.
scan_cmd=$(cat <<SCAN
cd $REPO
hits=
for c in \$(git rev-list main..HEAD); do
  if git grep -F -q '$SECRET' "\$c" -- 2>/dev/null; then
    hits="\$hits \$c"
  fi
done
printf '%s' "\$hits"
SCAN
)
hits="$(in_box "runuser -u learner -- env HOME=/home/learner bash -c $(printf '%q' "$scan_cmd")" 2>/dev/null || true)"
hits="$(echo "$hits" | tr -d '\r' | xargs)"
[[ -z "$hits" ]] \
  || fail "secret still appears in feature history — rewrite so no commit contains the API key"
ok "secret gone from feature history"

[[ -n "$(blob_hash HEAD src/invites.py)" ]] || fail "keep the invite redeem helper on $BR"
[[ -n "$(blob_hash HEAD src/invite_audit.py)" ]] || fail "keep the invite audit helper on $BR"
readme="$(in_repo show HEAD:README.md 2>/dev/null || true)"
echo "$readme" | grep -qi 'redeem\|invite' \
  || fail "keep the invite redeem README docs on $BR"
if [[ -n "$(blob_hash HEAD config/local_debug.conf)" ]]; then
  conf="$(in_repo show HEAD:config/local_debug.conf 2>/dev/null || true)"
  echo "$conf" | grep -qF "$SECRET" \
    && fail "config/local_debug.conf on the tip still contains the API key"
fi
ok "feature tip still has invite work without the key"

repo_clean || fail "working tree is not clean"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] || fail "remote main moved — push only $BR"
ok "remote main untouched"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
remote_br="$(in_remote rev-parse "refs/heads/$BR" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push the cleaned $BR to origin"
[[ "$remote_br" == "$head" ]] \
  || fail "push $BR: remote is ${remote_br:0:7}, local is ${head:0:7}"

rscan=$(cat <<SCAN
hits=
for c in \$(git rev-list main..refs/heads/$BR 2>/dev/null); do
  if git grep -F -q '$SECRET' "\$c" -- 2>/dev/null; then
    hits="\$hits \$c"
  fi
done
printf '%s' "\$hits"
SCAN
)
rhits="$(in_box "git -c safe.directory=$REMOTE -C $REMOTE bash -c $(printf '%q' "$rscan")" 2>/dev/null || true)"
rhits="$(echo "$rhits" | tr -d '\r' | xargs)"
[[ -z "$rhits" ]] || fail "origin/$BR still has the secret in history — push only after rewriting"
ok "pushed cleaned $BR"

pass "API key scrubbed from $BR history and pushed; main untouched"
