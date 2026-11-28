# Production Git labs stuck on setup timeout (2026-11-27)

## Summary

Git labs in production failed during **Preparing the lab** with:

```text
script timed out: setup.sh
```

status `504`. Many learners hit the same failure. Waking the machine pool was fine; setup itself should be seconds once the box is Ready. Local backends talking to the same EKS cluster completed setup quickly — so this was a **hang**, not “prod is slower.”

Fixed in PR [#40](https://github.com/Devsetu-Org/Devsetu/pull/40) (`ft/git-readings-mobile-and-setup-hang`).

## Symptoms

| What people saw | What was actually true |
|-----------------|------------------------|
| Boot stepper X on **Waking machines…** | Failure happened later on **Preparing the lab** |
| Error: `script timed out: setup.sh` | Node killed `setup.sh` after the script budget (was 180s) |
| Affects everyone on Git labs that use the forge remote | Not one bad account or one cold node |
| Local laptop backend → remote EKS: setup fast | Same cluster; hang only showed up reliably with the in-AWS backend path / prod load |

Backend log shape (setup timeout often logged next to concurrent boot-phase polls):

```text
[http] GET /api/session/k8s/boot-phase?openSeq=…&challengeId=git-03-…
[http] unhandled error Error: script timed out: setup.sh
    at …/dist/workspace/k8sCluster.js:…
  status: 504
```

Example challenge: `git-03-untrack-the-leaked-env` (any lab that calls `ensure_forge_git_host`).

## Boot phases (what each step means)

For Git / Linux box labs the stepper is roughly:

1. **Waking machines…** — node pool / Karpenter capacity  
2. **Creating your machine** — create the `box` pod  
3. **Waiting for your machine to start** — pod Ready (systemd up)  
4. **Preparing the lab** — run `setup.sh` on the backend (kubectl exec into the box)

Waking can legitimately take tens of seconds. Preparing should not.

## Root cause

Git labs plant a **fake team forge** inside the learner box:

- Bare repo under `/srv/git/…`
- Hostname `git.forgeboard.internal` → `127.0.0.1` in `/etc/hosts`
- Image **sshd** started so `git clone` / `git push` over SSH feel like a real remote

That bootstrap lives in `ensure_forge_git_host` (`backend/challenges/git/_lib/lab.sh`), called from each forge lab’s `setup.sh`.

The hang was in that bootstrap, not in “Git work is slow.” Two classes of stall:

### 1. `systemctl enable ssh.socket`

Setup called `systemctl enable` on every open. The unit is already enabled in the linux-box image; **linux-22** only restarts ssh. On some images / dbus states, `enable` can sit indefinitely. That burns the whole `setup.sh` budget with no useful progress.

### 2. SSH `UseDNS` / GSSAPI

Default sshd / client behavior can:

- Reverse-DNS every connect (`UseDNS`)
- Try Kerberos/GSSAPI before pubkey

In EKS there is often no useful reverse DNS and no KDC. The forge **smoke test** (`ssh learner@git.forgeboard.internal true`) then stalls for a long time. Failure debug with unbounded `ssh -vvv` made it worse.

If those stalls run long enough, the backend’s `runChallengeScript` timer fires → `script timed out: setup.sh` → 504. Learners never get a clear “sshd failed”; they get a generic timeout.

### Why local → EKS looked fine

Same cluster and same scripts, but the stall paths (dbus / DNS / GSSAPI timing) did not always show up from a laptop session the way they did for every prod open. Raising the timeout would only hide the hang; it would not make Preparing “correctly slow.”

## UI bug (misleading stepper)

Separately, the frontend treated **any** start failure as a preflight `machineCheck: failed`, and `BootLog` always pinned that failure on step 0 (**Waking machines…**).

So a setup timeout looked like a capacity/wake failure even when boot phases had already reached Preparing.

## Fix (what we changed)

| Area | Change |
|------|--------|
| Forge setup | Drop `systemctl enable`; only `restart` (same idea as linux-22) |
| Forge setup | Bound `systemctl` with `timeout 12` |
| Forge setup | sshd drop-in: `UseDNS no`, `GSSAPIAuthentication no` |
| Forge setup | Client smoke: pubkey-only, `ConnectTimeout=5`, no unbounded `-vvv` |
| Forge setup | Shorter listen wait (fail loud if sshd never binds) |
| kubectl helpers | `--request-timeout` on `in_box` / `box_script` so a stuck exec cannot eat the whole budget silently |
| Script timeout | Keep a **tight** setup budget (120s) so hangs fail loud instead of looking like “slow prod” |
| Errors | On timeout, attach a tail of setup stdout/stderr to the error |
| Boot UI | Fail on the **last real phase** (e.g. Preparing), not always Waking |

Learner-facing Git behavior is unchanged: same forge hostname, SSH remote, planted keys, pubkey-only sshd. The flags are ops hardening for bootstrap, not part of the lab lesson.

## Files

- `backend/challenges/git/_lib/lab.sh` — `ensure_forge_git_host`
- `backend/challenges/linux/_lib/lab.sh` — kubectl exec request timeout
- `backend/workspace/k8sCluster.ts` — `runChallengeScript` timeout detail
- `backend/workspace/k8sLifecycle.ts` — box `setup.sh` timeout budget
- `frontend/src/components/K8sLabWorkspace.tsx` — `BootLog` failure step

## How to tell if it comes back

1. Stepper should show X on **Preparing the lab** (not Waking) if setup dies.  
2. Error text may include a stderr/stdout tail (sshd status, smoke failure).  
3. Inside a stuck open (admin): `kubectl -n lx-<user> exec box -c box -- systemctl status ssh.socket ssh.service` and a bounded `ssh -o ConnectTimeout=5 … true` as learner.  
4. If setup regularly needs more than ~30–60s after Ready, treat it as a regression in forge bootstrap — do not “fix” by only raising the timer.

## Related product notes

sshd here is **in-box** SSH so Git labs can teach `clone` / `push` against a team-like remote without Gitea. See `backend/challenges/software-engineering/TRACK.md` (Git shape) and comments on `ensure_forge_git_host`.
