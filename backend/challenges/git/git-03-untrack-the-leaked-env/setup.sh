#!/usr/bin/env bash
# Ch1 agentic-default subplot: fix/agentic-default already has the three flag-fix
# commits, then a mistaken .env.local for local agentic debug. Untrack + ignore + push.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

BR=fix/agentic-default

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "BR=$(printf '%q' "$BR")"
  cat <<'EOF'
base_repo

# Same broken main as labs 2 and 4.
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
seed branch-base "$(git rev-parse main)"
attach_remote

# Lab-2 style flag fix already on the branch.
git switch -c "$BR"

sed -i 's/^agentic_sprints_default = full$/agentic_sprints_default = beta/' config/app.conf
git add config/app.conf
acommit "Keep agentic sprints default on beta for tenant rollouts"

cat >> README.md <<'MD'

## Running locally

```bash
python3 src/main.py
```

The service prints a one-line banner when sprint-service is ready.
MD
git add README.md
acommit "Document how to run sprint-service locally"

cat > src/main.py <<'PY'
"""sprint-service entrypoint (stub for git labs)."""

VERSION = "0.2.0"


def main() -> None:
    print(f"sprint-service {VERSION} ready")


if __name__ == "__main__":
    main()
PY
git add src/main.py
acommit "Add version constant and print it in the banner"

# Mistaken local override while testing helix-robotics agentic beta on the laptop.
cat > .env.local <<'ENV'
# DO NOT COMMIT — local overrides while testing agentic tenant rollouts
FORGEBOARD_API_KEY=fb_test_9f3c2a1b8e7d6c5a
AGENTIC_DEBUG_TENANT=helix-robotics
ENV
git add .env.local
acommit "Add local env overrides for agentic debug"

mkdir -p .cache
echo "tmp" > .cache/board.json

seed tip-before "$(git rev-parse HEAD)"
seed leaked-blob "$(git rev-parse HEAD:.env.local)"

git push "$REMOTE" "main:refs/heads/main"
git push "$REMOTE" "$BR:refs/heads/$BR"
git update-ref "refs/remotes/origin/$BR" "$(git rev-parse HEAD)"
git config "branch.$BR.remote" origin
git config "branch.$BR.merge" "refs/heads/$BR"

seed_finish
EOF
} | box_script

ok "fix/agentic-default planted with flag-fix commits + leaked .env.local; untrack + ignore + push"
