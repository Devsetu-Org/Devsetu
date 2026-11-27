#!/usr/bin/env bash
# Dirty invite WIP on a feature. Ops needs TTL=72 on a fix branch from main.
# Stash → fix branch → commit → push → pop. Leave main alone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

F=feature/workspace-invites
FIX=fix/invite-ttl-72
ttl_hours=72

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "F=$(printf '%q' "$F")"
  echo "FIX=$(printf '%q' "$FIX")"
  cat <<'EOF'
base_repo 0

cat >> config/app.conf <<'CONF'

[invites]
invite_link_ttl_hours = 0
redeem_code_length = 8
CONF
git add config/app.conf
pcommit "Add workspace invite link TTL"
seed main-sha "$(git rev-parse HEAD)"
seed main-entry-hash "$(git rev-parse HEAD:src/main.py)"

git checkout -q -b "$F"
cat > src/main.py <<'PY'
"""sprint-service entrypoint (stub for git labs)."""


def invite_banner() -> str:
    return "sprint-service ready"


def main() -> None:
    print(invite_banner())


if __name__ == "__main__":
    main()
PY
git add src/main.py
pcommit "Extract invite_banner() in main"
seed feature-sha "$(git rev-parse HEAD)"

cat > src/main.py <<'PY'
"""sprint-service entrypoint (stub for git labs)."""

INVITE_PREVIEW = True  # WIP: show pending invite count in the banner


def invite_banner() -> str:
    msg = "sprint-service ready"
    if INVITE_PREVIEW:
        msg += " | pending invites: TODO"
    return msg


def main() -> None:
    print(invite_banner())


if __name__ == "__main__":
    main()
PY
seed wip-hash "$(git hash-object src/main.py)"

attach_remote
git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$F:refs/heads/$F"

seed_finish
EOF
} | box_script

write_seed invite-ttl-hours "$ttl_hours"
write_seed fix-branch "$FIX"
write_seed feature-branch "$F"

ok "sprint-service planted mid-invite-feature with dirty WIP; stash → $FIX → push (ttl=${ttl_hours}h)"
