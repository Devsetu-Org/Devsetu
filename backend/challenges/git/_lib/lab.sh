# Shared helpers for Git-lab setup.sh / grade.sh. Sourced, not run.
#
# World: Forgeboard (multi-tenant project tracker). The Core team's codebase is
# sprint-service — classic + agentic sprints.
#
# Remotes live as bare repos under /srv/git on the box (no Gitea UI). Learners
# reach them over SSH via git.forgeboard.internal, which /etc/hosts maps to
# 127.0.0.1 — so clone/push feel like a team git host without hairpin-to-self.
#
# Env from the backend: LEARNER_NS, BOX_POD, BOX_CONTAINER, CHALLENGE_ID.

source "$(dirname "${BASH_SOURCE[0]}")/../../linux/_lib/lab.sh"

REPO=/home/learner/sprint-service
REMOTE=/srv/git/sprint-service.git
GIT_HOST=git.forgeboard.internal
# scp-style SSH URL learners clone/push (same host, same path on the box).
REMOTE_URL="learner@${GIT_HOST}:${REMOTE}"
SEED=/root/.lab

# ensure_git — git must already be on the box image (linux-lab v0.6+). Lab
# NetworkPolicy blocks egress, so apt-get at setup time cannot install it.
# Do not treat kubectl/API failures as "git missing" — box_ok hides stderr.
ensure_git() {
  local out ec
  out="$(in_box 'command -v git' 2>&1)" && return 0
  ec=$?
  if [[ "$out" == *"Unable to connect"* || "$out" == *"error:"* || "$out" == *"Error from server"* ]]; then
    fail "could not reach the lab box to check for git (kubectl exit $ec): ${out%%$'\n'*}"
    exit 1
  fi
  if [[ -z "$out" ]]; then
    fail "git is missing from this machine image (need linux-lab with git baked in)."
    exit 1
  fi
  fail "git check failed (exit $ec): ${out%%$'\n'*}"
  exit 1
}

# seed_dir — grader-owned secrets for this session
seed_dir() {
  in_box "install -d -m 700 $SEED"
}

# write_seed <name> <value>
write_seed() {
  in_box "printf '%s\n' $(printf '%q' "$2") > $SEED/$1"
}

# seed_value <name>
seed_value() {
  in_box "cat $SEED/$1 2>/dev/null" || true
}

# in_repo '<git args...>' — run git -C ~/sprint-service as learner
in_repo() {
  in_box "runuser -u learner -- env HOME=/home/learner git -C $REPO $(printf '%q ' "$@")"
}

# in_remote '<git args...>' — inspect the bare remote (grader-only).
# The bare repo is owned by learner (so they can push). Root git refuses
# "dubious ownership" unless safe.directory is set — that made push checks
# look empty even after a successful learner push.
in_remote() {
  in_box "git -c safe.directory=$REMOTE -C $REMOTE $(printf '%q ' "$@")"
}

# repo_ok '<shell>' — true when command succeeds in the repo as learner
repo_ok() {
  in_box "runuser -u learner -- env HOME=/home/learner bash -c $(printf '%q' "cd $REPO && $1")" >/dev/null 2>&1
}

# fresh_home — wipe previous lab workspace and any bare remote.
# Ticket copy lives in the UI Description tab (pack description), not on disk.
fresh_home() {
  box_script <<EOF
rm -rf $REPO /home/learner/ticket /home/learner/answers $REMOTE
rm -rf /home/learner/.ssh
rm -rf $SEED
install -d -m 700 $SEED
install -d -m 755 /srv/git
EOF
}

# ensure_answers — only labs that collect a written answer (bisect SHA, blame
# email, optional cherry-pick SHA) should call this; most git labs do not.
ensure_answers() {
  in_box "install -d -o learner -g learner -m 755 /home/learner/answers"
}

# ensure_forge_git_host — map git.forgeboard.internal → 127.0.0.1, start the
# image's systemd sshd (same path as linux-22), and plant a passwordless
# learner→learner key so clone/push work without prompts. git-01 must NOT set
# box.unprivileged — sshd needs the privileged seccomp/caps profile.
ensure_forge_git_host() {
  box_script <<EOF
set -euo pipefail
GIT_HOST=$(printf '%q' "$GIT_HOST")
REMOTE_URL=$(printf '%q' "$REMOTE_URL")
SEED=$(printf '%q' "$SEED")
SSH_PORT=22

# Hostname → loopback (same-box "remote"; eth0 self-connect is unreliable).
hosts="\$(grep -vF "\$GIT_HOST" /etc/hosts || true)"
printf '%s\n%s\n' "\$hosts" "127.0.0.1  \$GIT_HOST" > /etc/hosts

# Host keys (image job usually creates these; generate if missing).
systemctl start ssh-hostkeys.service 2>/dev/null || true
[[ -f /etc/ssh/ssh_host_ed25519_key ]] || ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
[[ -f /etc/ssh/ssh_host_ecdsa_key ]] || ssh-keygen -q -t ecdsa -N '' -f /etc/ssh/ssh_host_ecdsa_key
install -d -m 755 /run/sshd

# StrictModes: home must not be group/world-writable or pubkey auth is denied.
chmod 755 /home/learner
chown learner:learner /home/learner
usermod -s /bin/bash learner 2>/dev/null || true
passwd -u learner 2>/dev/null || true

# Passwordless SSH as learner (keys planted; not the lesson).
install -d -o learner -g learner -m 700 /home/learner/.ssh
rm -f /home/learner/.ssh/id_ed25519 /home/learner/.ssh/id_ed25519.pub
runuser -u learner -- env HOME=/home/learner ssh-keygen -q -t ed25519 -N '' -f /home/learner/.ssh/id_ed25519
install -o learner -g learner -m 600 /home/learner/.ssh/id_ed25519.pub /home/learner/.ssh/authorized_keys

# Point the stock sshd at pubkey-only for this lab (linux-22 style drop-in).
rm -f /etc/ssh/sshd_config.d/50-legacy.conf /etc/ssh/sshd_forgeboard.conf
cat > /etc/ssh/sshd_config.d/50-forgeboard.conf <<'CONF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AuthorizedKeysFile .ssh/authorized_keys
CONF

# Forge SSH needs a privileged box (systemd as PID 1). Unprivileged boxes use
# `sleep infinity` and systemctl fails with "Host is down" / "not been booted…".
if ! command -v systemctl >/dev/null 2>&1 || [[ "\$(ps -p 1 -o comm= 2>/dev/null || true)" != "systemd" ]]; then
  echo "forge git host needs a privileged box (systemd as PID 1); this machine has no systemd" >&2
  ps -p 1 -o pid,comm,args 2>&1 || true
  exit 1
fi

# Use the image sshd via systemd (not a minimal sshd -f — that rejected keys).
systemctl unmask ssh.socket ssh.service 2>/dev/null || true
systemctl enable ssh.socket 2>/dev/null || true
systemctl restart ssh.socket
systemctl restart ssh.service 2>/dev/null || true

ready=0
i=0
while [[ "\$i" -lt 40 ]]; do
  if (echo >/dev/tcp/127.0.0.1/\$SSH_PORT) >/dev/null 2>&1; then
    ready=1
    break
  fi
  if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 "\$SSH_PORT" >/dev/null 2>&1; then
    ready=1
    break
  fi
  # Integer seconds only — some images ship a sleep(1) that rejects fractions.
  sleep 1
  i=\$((i + 1))
done
if [[ "\$ready" -ne 1 ]]; then
  systemctl status ssh.socket ssh.service --no-pager 2>&1 | tail -n 40 || true
  ss -ltn 2>/dev/null | head -n 30 || true
  echo "sshd did not listen on 127.0.0.1:\$SSH_PORT" >&2
  exit 1
fi

# Clone URL stays learner@git.forgeboard.internal:... (HostName → loopback).
cat > /home/learner/.ssh/config <<CFG
Host \$GIT_HOST
  HostName 127.0.0.1
  User learner
  IdentityFile /home/learner/.ssh/id_ed25519
  IdentitiesOnly yes
CFG
chown learner:learner /home/learner/.ssh/config
chmod 600 /home/learner/.ssh/config

# Trust host keys for both the hostname and the rewritten HostName.
: > /home/learner/.ssh/known_hosts
for pub in /etc/ssh/ssh_host_ed25519_key.pub /etc/ssh/ssh_host_ecdsa_key.pub /etc/ssh/ssh_host_rsa_key.pub; do
  [[ -f "\$pub" ]] || continue
  key="\$(awk '{print \$1, \$2}' "\$pub")"
  printf '%s %s\n' "127.0.0.1" "\$key" >> /home/learner/.ssh/known_hosts
  printf '%s %s\n' "\$GIT_HOST" "\$key" >> /home/learner/.ssh/known_hosts
done
chown learner:learner /home/learner/.ssh/known_hosts
chmod 600 /home/learner/.ssh/known_hosts
grep -q . /home/learner/.ssh/known_hosts || {
  echo "no SSH host keys found under /etc/ssh" >&2
  exit 1
}

# Smoke: learner can reach the forge host over SSH with no prompt.
if ! runuser -u learner -- env HOME=/home/learner \
  ssh -o BatchMode=yes -o ConnectTimeout=5 -i /home/learner/.ssh/id_ed25519 \
    "learner@\$GIT_HOST" true; then
  echo "forge SSH smoke test failed (learner@\$GIT_HOST)" >&2
  ss -ltn 2>/dev/null | head -n 30 || true
  ls -la /home/learner /home/learner/.ssh 2>&1 || true
  runuser -u learner -- env HOME=/home/learner \
    ssh -vvv -o BatchMode=yes -o ConnectTimeout=5 -i /home/learner/.ssh/id_ed25519 \
      "learner@\$GIT_HOST" true 2>&1 | tail -n 50 || true
  exit 1
fi

printf '%s\n' "127.0.0.1" > "\$SEED/git-host-ip"
printf '%s\n' "\$GIT_HOST" > "\$SEED/git-host"
printf '%s\n' "\$SSH_PORT" > "\$SEED/git-host-port"
printf '%s\n' "\$REMOTE_URL" > "\$SEED/remote-url"
EOF
}

# init_learner_git_identity — unset so labs that teach config can require it
clear_learner_git_identity() {
  in_box "runuser -u learner -- env HOME=/home/learner git config --global --unset-all user.name 2>/dev/null || true"
  in_box "runuser -u learner -- env HOME=/home/learner git config --global --unset-all user.email 2>/dev/null || true"
  in_box "runuser -u learner -- env HOME=/home/learner git config --global init.defaultBranch main"
}

# set_bot_identity inside a directory (for seeding commits as platform bot)
# Usage inside box_script: bot_git_config
bot_git_config_snippet() {
  cat <<'SNIP'
git config user.name "Priya Sharma"
git config user.email "priya@forgeboard.internal"
SNIP
}

# set_learner_git_identity — Ada Learner, for labs after git-01 (which teaches config).
set_learner_git_identity() {
  in_box "runuser -u learner -- env HOME=/home/learner git config --global user.name 'Ada Learner'"
  in_box "runuser -u learner -- env HOME=/home/learner git config --global user.email 'ada@forgeboard.internal'"
  in_box "runuser -u learner -- env HOME=/home/learner git config --global init.defaultBranch main"
}

# need_repo — grader guard: ~/sprint-service must still be a git repo (aborts grading).
need_repo() {
  box_ok "test -d $REPO/.git" || { fail "~/sprint-service is not a git repository — clone it from $REMOTE_URL"; exit 1; }
}

# origin_is_forge_remote <url> — true when origin is the SSH forge URL (scp or ssh://).
origin_is_forge_remote() {
  local got="$1"
  [[ "$got" == "$REMOTE_URL" \
    || "$got" == "ssh://learner@${GIT_HOST}${REMOTE}" \
    || "$got" == "ssh://learner@${GIT_HOST}${REMOTE}/" \
    || "$got" == "learner@${GIT_HOST}:${REMOTE}/" ]]
}

# need_remote — grader guard: bare remote must exist
need_remote() {
  box_ok "test -d $REMOTE" || { fail "team remote $REMOTE is missing; reset the lab"; exit 1; }
}

# repo_clean — true when `git status --porcelain` is empty (no changes, no untracked files).
repo_clean() {
  local out
  out="$(in_repo status --porcelain 2>/dev/null || true)"
  [[ -z "$out" ]]
}

# repo_branch — current branch name, or empty when HEAD is detached.
repo_branch() {
  in_repo symbolic-ref --short -q HEAD 2>/dev/null || true
}

# blob_hash <rev> <path> — object id of a file at a revision (empty if missing).
# git rev-parse prints "REV:path" on stdout when the path is absent (especially if
# the file still exists on disk) — never treat that as a blob id.
blob_hash() {
  local out
  out="$(in_repo rev-parse "$1:$2" 2>/dev/null || true)"
  [[ "$out" =~ ^[0-9a-f]{40,64}$ ]] && printf '%s\n' "$out"
}

# git_seed_prelude — print a bash prelude for `{ git_seed_prelude; cat <<'EOF' ...; } | box_script`.
# Helpers build history as root. `publish_remote` installs a bare remote and removes the
# worktree so the learner must clone. `seed_finish` hands ownership to the learner.
git_seed_prelude() {
  echo "REPO=$REPO; REMOTE=$REMOTE; SEED=$SEED"
  cat <<'PRELUDE'
export GIT_TERMINAL_PROMPT=0
# Root seeds the repo then chowns it to learner; without this, later root git
# calls fail with "dubious ownership".
git config --global --add safe.directory '*' 2>/dev/null || true
_clock=1767225600
tick() {
  _clock=$((_clock + ${1:-3600}))
  export GIT_AUTHOR_DATE="$_clock +0000" GIT_COMMITTER_DATE="$_clock +0000"
}
# gcommit <name> <email> <message> — commit whatever is staged, as that person
gcommit() { tick; git -c user.name="$1" -c user.email="$2" commit -q -m "$3"; }
pcommit() { gcommit "Priya Sharma" "priya@forgeboard.internal" "$1"; }
acommit() { gcommit "Ada Learner" "ada@forgeboard.internal" "$1"; }
# g <git args> — any other git command as Priya (merge, cherry-pick, annotated tag, ...)
# Use this for `tag -a` — bare `git tag -a` fails with "identity unknown" because
# pcommit/acommit pass -c user.* only on commit, not into the repo config.
g() { tick; git -c user.name="Priya Sharma" -c user.email="priya@forgeboard.internal" "$@"; }
# seed <name> <value> — grader-only secret
seed() { printf '%s\n' "$2" > "$SEED/$1"; }
# base_repo — scaffold + first commit on main, as Priya (worktree at $REPO).
# Agentic sprints ship in beta (limited options) for every enterprise tenant.
base_repo() {
  rm -rf "$REPO"
  mkdir -p "$REPO/config" "$REPO/src"
  cd "$REPO"
  git init -q -b main
  cat > README.md <<'MD'
# sprint-service

Owns classic and agentic sprints for Forgeboard workspaces.
MD
  cat > config/app.conf <<'CONF'
# sprint-service configuration
[server]
host = 0.0.0.0
port = 8080

[features]
# Agentic sprints: beta = limited option set for all tenants.
# Per-tenant flags below unlock the full toolkit for early-access enterprises.
agentic_sprints_default = beta

[agentic_sprints.tenants]
northstar-labs = beta
helix-robotics = beta
cinder-pay = beta
orbit-health = beta
lumen-retail = beta
atlas-cloud = beta

[logging]
level = info
CONF
  cat > src/main.py <<'PY'
"""sprint-service entrypoint (stub for git labs)."""


def main() -> None:
    print("sprint-service ready")


if __name__ == "__main__":
    main()
PY
  cat > src/sprints.py <<'PY'
"""Sprint and agentic-sprint helpers (stub for git labs)."""

AGENTIC_MODES = ("beta", "full")


def resolve_mode(tenant: str, override=None, default: str = "beta") -> str:
    if override in AGENTIC_MODES:
        return override
    return default
PY
  git add -A
  pcommit "Initial sprint-service scaffold"
}
# publish_remote — install bare remote from the current worktree, then remove the
# worktree so the learner must `git clone`. Remote is learner-writable for push.
publish_remote() {
  install -d -m 755 /srv/git
  rm -rf "$REMOTE"
  git clone --bare -q "$REPO" "$REMOTE"
  # Default branch for fresh clones
  git -C "$REMOTE" symbolic-ref HEAD refs/heads/main
  rm -rf "$REPO"
  chown -R learner:learner "$REMOTE"
}
# attach_remote — bare team remote from the current worktree, keep the worktree,
# and point origin at the forge SSH URL (learner must push over git.forgeboard.internal).
# Call ensure_forge_git_host first so clone/push work. Uncommitted edits stay local.
# Local main tracks origin/main (same tip) so plain `git push` on main is defined;
# a new fix branch still needs `git push -u origin <branch>` the first time.
attach_remote() {
  install -d -m 755 /srv/git
  rm -rf "$REMOTE"
  git clone --bare -q "$REPO" "$REMOTE"
  git -C "$REMOTE" symbolic-ref HEAD refs/heads/main
  chown -R learner:learner "$REMOTE"
  git -C "$REPO" remote remove origin 2>/dev/null || true
  # SSH forge URL for the learner. Do not `git fetch` here as root — root has no
  # planted known_hosts/key (those belong to learner), so fetch fails with
  # "Host key verification failed". Mirror origin/main to local main (not HEAD —
  # setup often attaches while on a feature tip, which would make origin/main
  # look ahead of main in git log).
  git -C "$REPO" remote add origin "learner@git.forgeboard.internal:$REMOTE"
  if git -C "$REPO" rev-parse --verify refs/heads/main >/dev/null 2>&1; then
    tip="$(git -C "$REPO" rev-parse refs/heads/main)"
  else
    tip="$(git -C "$REPO" rev-parse HEAD)"
  fi
  git -C "$REPO" update-ref "refs/remotes/origin/main" "$tip"
  git -C "$REPO" config branch.main.remote origin
  git -C "$REPO" config branch.main.merge refs/heads/main
  seed remote-url "learner@git.forgeboard.internal:$REMOTE"
}
# protect_remote_main — server-side update hook: reject pushes to refs/heads/main.
# Call only after setup has finished seeding main on the bare remote. Escape hatch:
# ALLOW_PUSH_MAIN=1 (git-01 — learner's first push is onto main).
protect_remote_main() {
  [[ -d "$REMOTE" ]] || return 0
  install -d -m 755 "$REMOTE/hooks"
  cat > "$REMOTE/hooks/update" <<'HOOK'
#!/bin/bash
# Forgeboard: main is protected. Push a feature/fix branch for review.
refname="$1"
if [ "$refname" = "refs/heads/main" ]; then
  echo "rejected: Forgeboard policy forbids direct pushes to main." >&2
  echo "Push a feature/fix branch for review instead." >&2
  exit 1
fi
exit 0
HOOK
  chmod 755 "$REMOTE/hooks/update"
}

# seed_finish — lock grader secrets; hand worktree + bare remote to the learner.
# Always re-chown the bare remote: setup may push as root after attach_remote's
# first chown, which leaves root-owned objects and breaks learner force-push
# ("Permission denied" / "unable to migrate objects to permanent storage").
# When a bare remote exists and ALLOW_PUSH_MAIN is not 1, install the main-deny
# hook here (after any seed pushes to main).
seed_finish() {
  chmod 700 "$SEED"
  if [[ -d "$REMOTE" && "${ALLOW_PUSH_MAIN:-0}" != "1" ]]; then
    protect_remote_main
  fi
  if [[ -d "$REPO" ]]; then
    chown -R learner:learner "$REPO"
  fi
  if [[ -d "$REMOTE" ]]; then
    chown -R learner:learner "$REMOTE"
  fi
}
PRELUDE
}
