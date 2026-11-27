#!/usr/bin/env bash
# Continuation of lab 2: main still has the bad default; fix/agentic-default has
# three atomic commits already pushed. The discussion writeup was never staged —
# docs/agentic-default.md sits untracked. Learner amends the tip, then
# force-with-lease updates the remote branch (not main).
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

doc_id="$(printf '%04x%04x' $((RANDOM)) $((RANDOM)))"
BR=fix/agentic-default

ensure_git
fresh_home
set_learner_git_identity
ensure_forge_git_host

{
  git_seed_prelude
  echo "doc_id=$doc_id"
  echo "BR=$(printf '%q' "$BR")"
  cat <<'EOF'
base_repo
# Bug on main (same world as lab 2).
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
attach_remote

# --- lab 2 already done: three atomic commits on the fix branch, then pushed ---
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

seed branch-base "$(git rev-parse main)"
seed orig-sha "$(git rev-parse HEAD)"
seed seed-commits "$(git rev-list --count main..HEAD)"
seed tip-py-hash "$(git rev-parse HEAD:src/main.py)"

# Publish the branch without SSH (root has no learner known_hosts).
git push "$REMOTE" "HEAD:refs/heads/$BR"
# Root just wrote objects into the bare repo — hand it back to learner or their
# later force-push fails with Permission denied / unable to migrate objects.
chown -R learner:learner "$REMOTE"
git update-ref "refs/remotes/origin/$BR" "$(git rev-parse HEAD)"
git config "branch.$BR.remote" origin
git config "branch.$BR.merge" "refs/heads/$BR"

# Forgotten discussion writeup — never staged, never pushed.
mkdir -p docs
cat > docs/agentic-default.md <<MD
# Why the agentic default stays on beta

Standup follow-up from the \`fix/agentic-default\` discussion:

- \`agentic_sprints_default = full\` on \`main\` turns the full toolkit on for every
  enterprise. Early access was supposed to stay tenant-by-tenant.
- Keep the global default on **beta**. Promote one tenant at a time under
  \`[agentic_sprints.tenants]\`.
- Land that kind of rescue on a short-lived fix branch — never straight on \`main\`.

Doc id: $doc_id
MD
seed doc-hash "$(git hash-object docs/agentic-default.md)"

[[ -d "$REPO/.git" ]] || { echo "setup bug: $REPO missing" >&2; exit 1; }
git remote get-url origin >/dev/null
git show-ref --verify --quiet "refs/heads/$BR"
git --git-dir="$REMOTE" show-ref --verify --quiet "refs/heads/$BR"

seed_finish
EOF
} | box_script

box_ok "test -d /home/learner/sprint-service/.git" \
  || { fail "setup did not plant ~/sprint-service"; exit 1; }
box_ok "test -d /srv/git/sprint-service.git" \
  || { fail "setup did not plant the team remote"; exit 1; }

ok "lab-2 world planted: $BR pushed; docs/agentic-default.md left untracked"
