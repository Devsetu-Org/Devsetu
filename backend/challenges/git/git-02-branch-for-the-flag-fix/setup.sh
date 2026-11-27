#!/usr/bin/env bash
# Bad default committed on main; forge remote tracks that tip. Working tree already
# holds the three-file fix. Learner opens fix/agentic-default, lands three atomic
# commits, pushes the branch, and leaves main alone.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  cat <<'EOF'
base_repo
# Bug on main: full toolkit enabled for every enterprise by default.
sed -i 's/^agentic_sprints_default = beta$/agentic_sprints_default = full/' config/app.conf
git add config/app.conf
pcommit "Enable full agentic sprints by default"

cat >> README.md <<'MD'

## Branching

Never commit fixes straight to `main`. Open a branch, fix there, then review.
MD
git add README.md
pcommit "Document the branching rule in README"

seed main-sha "$(git rev-parse main)"
seed base-sha "$(git rev-parse HEAD)"
seed seed-commits "$(git rev-list --count main)"

# Team remote matches main tip; worktree stays so the learner can branch and push.
attach_remote

# --- uncommitted mega-diff: config fix + README + banner ---
sed -i 's/^agentic_sprints_default = full$/agentic_sprints_default = beta/' config/app.conf

cat >> README.md <<'MD'

## Running locally

```bash
python3 src/main.py
```

The service prints a one-line banner when sprint-service is ready.
MD

cat > src/main.py <<'PY'
"""sprint-service entrypoint (stub for git labs)."""

VERSION = "0.2.0"


def main() -> None:
    print(f"sprint-service {VERSION} ready")


if __name__ == "__main__":
    main()
PY

seed hash-config "$(git hash-object config/app.conf)"
seed hash-readme "$(git hash-object README.md)"
seed hash-main "$(git hash-object src/main.py)"

# Verify while still root-owned (after seed_finish, root git hits dubious ownership).
[[ -d "$REPO/.git" ]] || { echo "setup bug: $REPO missing after seed" >&2; exit 1; }
git -C "$REPO" remote get-url origin >/dev/null
[[ -d "$REMOTE" ]] || { echo "setup bug: bare remote $REMOTE missing" >&2; exit 1; }

seed_finish
EOF
} | box_script

box_ok "test -d /home/learner/sprint-service/.git" \
  || { fail "setup did not plant ~/sprint-service — reset the lab"; exit 1; }
box_ok "test -d /srv/git/sprint-service.git" \
  || { fail "setup did not plant the team remote — reset the lab"; exit 1; }

ok "sprint-service planted with forge remote + three-file uncommitted fix"
