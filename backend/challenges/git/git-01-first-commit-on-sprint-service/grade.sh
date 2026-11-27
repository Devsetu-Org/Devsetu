#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

org_a="$(seed_value rollout-org-a)"
org_b="$(seed_value rollout-org-b)"
base="$(seed_value base-sha)"
[[ -n "$org_a" && -n "$org_b" && -n "$base" ]] || { fail "lab seed missing; reset the lab"; exit 1; }
need_remote
need_repo

# Identity is configured for the learner
name="$(in_box "runuser -u learner -- env HOME=/home/learner git config --global user.name" || true)"
email="$(in_box "runuser -u learner -- env HOME=/home/learner git config --global user.email" || true)"
[[ "$name" == "Ada Learner" && "$email" == "ada@forgeboard.internal" ]] \
  || fail "git identity should be Ada Learner <ada@forgeboard.internal> (got: '${name}' <'${email}'>)"
ok "git identity configured"

# Clone is on main and tracks the team forge host
branch="$(repo_branch)"
[[ "$branch" == "main" ]] || fail "you should be on main (got: '${branch:-detached}')"
origin="$(in_repo remote get-url origin 2>/dev/null || true)"
want_url="$(seed_value remote-url)"
[[ -n "$want_url" ]] || want_url="$REMOTE_URL"
if ! origin_is_forge_remote "$origin"; then
  # Also accept whatever setup seeded (covers trailing-slash variants).
  [[ "$origin" == "$want_url" || "$origin" == "${want_url}/" ]] \
    || fail "origin should be $want_url (got: '${origin:-none}') — clone from $GIT_HOST"
fi
ok "cloned from $GIT_HOST on main"

# A new local commit exists on top of the seed
head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
[[ -n "$head" && "$head" != "$base" ]] || fail "no new commit yet: HEAD is still the seed commit"
in_repo merge-base --is-ancestor "$base" HEAD 2>/dev/null || fail "the seed commit is no longer part of your history"
ok "new commit on top of the seed"

# Config at HEAD has the two early-access tenants on full; others stay beta
conf="$(in_repo show HEAD:config/app.conf 2>/dev/null || true)"
[[ -n "$conf" ]] || fail "config/app.conf missing at HEAD"

flag_of() {
  printf '%s\n' "$1" | awk -F' *= *' -v k="$2" '$1 == k {print $2; exit}'
}

got_a="$(flag_of "$conf" "$org_a")"
got_b="$(flag_of "$conf" "$org_b")"
[[ "$got_a" == "full" ]] || fail "config/app.conf at HEAD should have $org_a = full (found: '${got_a:-missing}')"
[[ "$got_b" == "full" ]] || fail "config/app.conf at HEAD should have $org_b = full (found: '${got_b:-missing}')"
ok "early-access tenants set to full"

for tenant in northstar-labs helix-robotics cinder-pay orbit-health lumen-retail atlas-cloud; do
  [[ "$tenant" == "$org_a" || "$tenant" == "$org_b" ]] && continue
  got="$(flag_of "$conf" "$tenant")"
  [[ "$got" == "beta" ]] || fail "$tenant should still be beta (found: '${got:-missing}')"
done
default="$(printf '%s\n' "$conf" | awk -F' *= *' '/^agentic_sprints_default/ {print $2; exit}')"
[[ "$default" == "beta" ]] || fail "agentic_sprints_default should still be beta (found: '${default:-missing}')"
ok "other tenants and default remain beta"

# Only the tenant flag lines changed
changed="$(in_repo diff --name-only "$base" HEAD 2>/dev/null || true)"
[[ "$changed" == "config/app.conf" ]] || fail "the commit should change only config/app.conf (changed: $(echo $changed))"
numstat="$(in_repo diff --numstat "$base" HEAD -- config/app.conf 2>/dev/null | awk '{print $1"/"$2}' || true)"
[[ "$numstat" == "2/2" ]] || fail "exactly two tenant lines should change (got +/- ${numstat:-none})"
ok "diff is only the two tenant flags"

# Author + message
an="$(in_repo log -1 --format=%an 2>/dev/null || true)"
ae="$(in_repo log -1 --format=%ae 2>/dev/null || true)"
[[ "$an" == "Ada Learner" && "$ae" == "ada@forgeboard.internal" ]] \
  || fail "latest commit author should be Ada Learner <ada@forgeboard.internal> (got: $an <$ae>); set your identity, then amend the commit"
ok "commit author"
msg="$(in_repo log -1 --format=%s 2>/dev/null || true)"
[[ "$head" != "$base" && "${#msg}" -ge 8 && "$msg" == *" "* ]] || fail "commit subject '$msg' is missing or too short — say what and why"
ok "commit message"

# Clean working tree
[[ "$head" != "$base" ]] && repo_clean || fail "working tree is not clean, or nothing was committed — stage and commit everything (git status)"
ok "working tree clean"

# Pushed to origin/main — team remote must match local HEAD
remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ -n "$remote_main" ]] || fail "team remote has no main branch"
[[ "$remote_main" == "$head" ]] \
  || fail "push your commit: remote main is ${remote_main:0:7}, local HEAD is ${head:0:7} (git push origin main)"
ok "pushed to origin main"

# Remote tree carries the same config (belt-and-suspenders vs a force-push of empty)
remote_conf="$(in_remote show refs/heads/main:config/app.conf 2>/dev/null || true)"
[[ "$(flag_of "$remote_conf" "$org_a")" == "full" && "$(flag_of "$remote_conf" "$org_b")" == "full" ]] \
  || fail "team remote main does not have the early-access flags set to full"
ok "team remote has the rollout"

pass "first change cloned, committed, and pushed on main"
