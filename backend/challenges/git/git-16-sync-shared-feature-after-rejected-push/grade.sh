#!/usr/bin/env bash
# Ada's branch includes Priya's finished invite work (code + both README notes),
# pushed; main untouched. Code files merge cleanly; README must keep both docs.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ADA=feature/workspace-invites-ada
PRIYA=feature/workspace-invites-priya
main_seed="$(seed_value main-sha)"
priya_tip="$(seed_value priya-tip)"
ada_tip="$(seed_value ada-tip)"
ada_invites="$(seed_value ada-invites-hash)"
priya_audit="$(seed_value priya-audit-hash)"
[[ -n "$main_seed" && -n "$priya_tip" && -n "$ada_tip" && -n "$ada_invites" && -n "$priya_audit" ]] \
  || { fail "lab seed missing; reset the lab"; exit 1; }
need_repo
need_remote

[[ "$(repo_branch)" == "$ADA" ]] \
  || fail "you should be on $ADA (got: '$(repo_branch)') — integrate Priya's branch into yours"
box_ok "test ! -d $REPO/.git/rebase-merge -a ! -d $REPO/.git/rebase-apply" \
  || fail "a rebase is still in progress — finish or abort it"
box_ok "test ! -f $REPO/.git/MERGE_HEAD" || fail "a merge is still in progress — finish it"

local_main="$(in_repo rev-parse main 2>/dev/null || true)"
[[ "$local_main" == "$main_seed" ]] \
  || fail "leave main alone (main is ${local_main:0:7}, expected ${main_seed:0:7})"
ok "local main untouched"

[[ "$(blob_hash HEAD src/invites.py)" == "$ada_invites" ]] \
  || fail "keep your src/invites.py preview path helper on $ADA"
[[ "$(blob_hash HEAD src/invite_audit.py)" == "$priya_audit" ]] \
  || fail "bring Priya's src/invite_audit.py onto $ADA (fetch $PRIYA and merge or rebase it in)"
ok "both invite code files on $ADA"

readme="$(in_repo show HEAD:README.md 2>/dev/null || true)"
echo "$readme" | grep -q '<<<<<<\|>>>>>>\|======' \
  && fail "conflict markers still in README.md — finish the resolve"
echo "$readme" | grep -qi 'eight' \
  || fail "keep Priya's note about eight-character redeem codes in README"
echo "$readme" | grep -qi 'preview' \
  || fail "keep your preview-banner redeem docs in README (resolve by keeping both sides)"
ok "README keeps both Priya's and your docs"

head="$(in_repo rev-parse HEAD 2>/dev/null || true)"
[[ "$head" != "$ada_tip" ]] \
  || fail "your tip never moved — fetch $PRIYA, merge (or rebase) it into $ADA, resolve README, then push"
in_repo merge-base --is-ancestor "$priya_tip" HEAD 2>/dev/null \
  || fail "Priya's tip is not in your history — merge or rebase $PRIYA into $ADA"
in_repo merge-base --is-ancestor "$ada_tip" HEAD 2>/dev/null \
  || fail "your original $ADA tip was lost — keep your commits when integrating Priya's branch"
ok "local tip includes Priya's finished branch and your work"

repo_clean || fail "working tree is not clean (git status)"
ok "working tree clean"

remote_main="$(in_remote rev-parse refs/heads/main 2>/dev/null || true)"
[[ "$remote_main" == "$main_seed" ]] || fail "remote main moved — push only $ADA"
ok "remote main untouched"

# Priya's vacation branch must stay on the remote as she left it.
remote_priya="$(in_remote rev-parse "refs/heads/$PRIYA" 2>/dev/null || true)"
[[ "$remote_priya" == "$priya_tip" ]] \
  || fail "leave $PRIYA alone on origin — integrate into $ADA and push your branch"
ok "Priya's remote branch untouched"

remote_br="$(in_remote rev-parse "refs/heads/$ADA" 2>/dev/null || true)"
[[ -n "$remote_br" ]] || fail "push $ADA after integrating Priya's work"
[[ "$remote_br" == "$head" ]] \
  || fail "push $ADA: remote is ${remote_br:0:7}, local is ${head:0:7}"
ok "pushed synced $ADA"

remote_readme="$(in_box "git -c safe.directory=$REMOTE -C $REMOTE show refs/heads/$ADA:README.md" 2>/dev/null || true)"
echo "$remote_readme" | grep -qi 'eight' || fail "pushed tip lost Priya's eight-character redeem note"
echo "$remote_readme" | grep -qi 'preview' || fail "pushed tip lost your preview-banner docs"
ok "origin/$ADA has the combined README"

pass "$ADA includes Priya's invite work and your docs; pushed; main untouched"
