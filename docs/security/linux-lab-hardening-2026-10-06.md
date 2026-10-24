# Linux-lab hardening (2026-10-06)

Fixes for five findings from the [2026-10-05 audit](security-audit-2026-10-05.md) and the Linux-box isolation review: learner kubectl API (CRIT-1), unenforced NetworkPolicy, instance metadata reachable from learner pods, unconfined seccomp on Linux boxes, and io_uring enabled on learner nodes. A sixth item (added 2026-10-06) hardens the free, public-facing Linux labs by running them in a no-root box.

| # | Finding | Fix | Status (as of 2026-10-06) |
|---|---------|-----|--------|
| 1 | CRIT-1: `POST /api/session/:id/k8s/exec` ran learner-supplied kubectl args on the backend host | Endpoint removed (no caller) | **Done in code**, local backend restarted with it; **App EC2 deploy pending** |
| 2 | NetworkPolicy stored but not enforced | VPC CNI network policy agent enabled | **Live on the cluster** (`aws-eks-nodeagent` running); enforcement verified (box↔box blocked) |
| 3 | IMDS reachable from learner pods (hop limit 2) | Hop limit 1 on every learner node | **Rolled on `labs-linux`** (token PUT now times out); `labs-k8s` / `labs-docker` when those groups exist |
| 4 | Linux boxes ran seccomp `Unconfined` | Custom profile `devlabs/linux-box.json` | **Installed and verified**; all 26 labs pass, lab 12 PASS end to end; backend wiring live locally, **EC2 deploy pending** |
| 5 | io_uring enabled on learner nodes | `kernel.io_uring_disabled=2` at boot | **Rolled on `labs-linux`** (`io_uring_disabled=2` confirmed); other groups when they exist |
| 6 | Free (public) Linux labs ran the full systemd box with `SYS_ADMIN`/`NET_ADMIN` and sudo | No-root box for the free, no-sudo labs | **Done in code**, verified end to end on `labs-linux`; **App EC2 deploy pending** |

Remaining to fully land: deploy the backend to the App EC2 (fixes 1, 4 and 6), and roll `labs-k8s` / `labs-docker` plus the Karpenter pools once they exist (fixes 3 and 5). See the rollout checklist below.

## 1. CRIT-1: learner kubectl API removed

**Problem.** The endpoint took a free-form `args` array (or a `command` string), checked only the verb, and ran `kubectl` on the backend host. Flags such as `--kubeconfig`, `--from-file`, `-f <path>` and the `cp` verb let a learner read backend files (`.env` with the JWT secret, DB password and AWS keys), or replace the controller kubeconfig, which has cluster-admin.

**Fix.** Nothing in the frontend called it (`execK8sCommand` in `workspaceApi.ts` was defined but unused), so the endpoint was removed rather than filtered. A flag deny-list for kubectl is easy to get wrong.

- `backend/routes/session.ts`: route removed (and the now-unused `k8sCluster` import)
- `backend/workspace/k8sCluster.ts`: `learnerKubectl`, `assertSafeLearnerArgs` and `ALLOWED_KUBECTL_VERBS` removed
- `frontend/src/services/workspaceApi.ts`: `execK8sCommand` removed

The learner terminal is unaffected: it uses the learner ServiceAccount kubeconfig inside the learner's own shell, not this endpoint. If an in-page kubectl runner is ever needed again, build it to run as the learner SA **inside the learner's pod** (as the terminal does), never on the backend host.

Both `tsc --noEmit` (backend) and `tsc -b` (frontend) pass.

## 2. NetworkPolicy enforcement

**Problem.** Every `lx-*` / `dk-*` namespace gets `dl-box-isolation` (same-namespace traffic + DNS only; Docker boxes also reach the registry mirror). The VPC CNI ran without its network policy agent, so the policy was ignored: boxes could reach each other, the VPC, node ports and the internet.

**Fix.** `deploy/eks/env.sh`: `EKS_VPC_CNI_CONFIG` now includes `"enableNetworkPolicy":"true"` (checked against the vpc-cni `v1.22.4-eksbuild.3` add-on schema: a string-typed boolean). `eks-recreate.sh` applies it on new clusters, and on existing clusters when re-run (`ensure_vpc_cni_config` now updates whenever the config differs).

**Side effects.**
- Learners' own NetworkPolicies in Kubernetes labs (`ns-*`) start being enforced, which is what those labs teach.
- Linux boxes lose internet access (by design: labs 17 and 21 that need it are closed). The `apt egress` capability check in `eks-linux.sh check` will fail from then on; that's expected.
- Not covered: `ns-*` namespaces have no platform default policy, so pods in Kubernetes labs can still reach other learners' pods. A platform allow-policy would override learners' own deny policies and break the NetworkPolicy labs, so this needs a different design.

## 3. Instance metadata (IMDS)

**Problem.** The managed learner node groups' launch template (`deploy/eks/nodegroups.sh`) set `HttpPutResponseHopLimit: 2`, so pods could get an IMDSv2 token and the node role's AWS credentials. **Confirmed live** on 2026-10-06: from a box on the `labs-linux` base node, `PUT /latest/api/token` returned HTTP 200. (The Oct 1 isolation test saw it blocked because that box was on a Karpenter node, where the default is 1.)

**Fix.**
- `deploy/eks/nodegroups.sh`: learner launch templates (`labs-k8s`, `labs-linux`, `labs-docker`) use hop limit **1**. Host-network DaemonSets (aws-node, kube-proxy, pod identity agent) still reach IMDS. The EBS CSI node plugin falls back to Kubernetes metadata, as it already does on the Karpenter nodes.
- `deploy/eks/karpenter/nodepool{,-linux,-docker}.yaml`: `metadataOptions` set explicitly (hop limit 1, tokens required). That was already Karpenter's default; it's explicit now so it can't drift.
- `ensure_launch_template` used to compare only `UserData`, so a metadata-only change never produced a new version. It now stores a checksum of the full launch template data in the version description and creates a new default version whenever anything changes.
- New `deploy/eks/eks-nodegroup-update.sh <nodegroup>...`: refreshes the launch template and runs `aws eks update-nodegroup-version` (new template version **and** the latest AMI). Also use it monthly for kernel patches, since managed node groups never update their AMI on their own.

## 4. seccomp profile for Linux boxes

**Problem.** Boxes run with `SYS_ADMIN`, `NET_ADMIN` and other namespaced capabilities and seccomp `Unconfined`, exposing kernel interfaces behind many container-escape bugs (e.g. CVE-2022-0185 via `fsconfig`, io_uring bugs, nested user namespaces).

**Fix.** A deny-list profile, `deploy/eks/linux/seccomp/linux-box.json` (everything allowed except):

| Blocked | Returns | Why it's safe for the labs |
|---------|---------|----------------------------|
| `io_uring_setup/enter/register` | ENOSYS | Nothing in the labs uses io_uring |
| `keyctl`, `add_key`, `request_key` | ENOSYS | systemd skips per-service keyrings when unsupported |
| New mount API: `fsopen`, `fsconfig`, `fsmount`, `fspick`, `move_mount`, `open_tree`, `mount_setattr` | ENOSYS | systemd and util-linux `mount` fall back to classic `mount(2)` |
| `clone3` | ENOSYS | glibc falls back to `clone`, which can be argument-filtered |
| `unshare` / `clone` with `CLONE_NEWUSER` | EPERM | Blocks nested user namespaces; other namespaces (net, mount…) still work |
| `bpf`, `perf_event_open`, `userfaultfd`, `kexec_*`, module load/unload, `open_by_handle_at`, `acct`, `swapon/off`, `iopl/ioperm`, `syslog`, `quotactl*`, legacy calls | EPERM | Not used by any lab |

How it reaches nodes: `deploy/eks/linux/seccomp-profiles.yaml` is a DaemonSet on `devlabs.io/pool=linux` nodes. It copies ConfigMap `dl-system/seccomp-profiles` (built from `linux/seccomp/`) into `/var/lib/kubelet/seccomp/devlabs/` and re-checks every 30 s, so profile edits roll out without restarts. The installer runs busybox pinned by digest, as root but with all capabilities dropped, a read-only root filesystem and `RuntimeDefault` seccomp.

- `deploy/eks/eks-linux.sh`: `up` installs it; new `seccomp` subcommand reinstalls only the profiles; `down` removes them; `check` adds four checks (seccomp active on PID 1, io_uring blocked, nested user namespace blocked, no failed units).
- `backend/workspace/linuxBox.ts`: Linux boxes use `seccompProfile: {type: Localhost, localhostProfile: devlabs/linux-box.json}`. **Escape hatch:** `LINUX_LAB_SECCOMP=unconfined` in the backend env restores `Unconfined` (documented in `backend/.env.example`).
- `deploy/eks/linux/spike.yaml`: the spike box uses the same profile.
- **Docker boxes run `devlabs/docker-box.json`** (`deploy/eks/docker/seccomp/docker-box.json`), installed by `seccomp-profiles-docker` on `devlabs.io/pool=docker` nodes (`eks-docker.sh base` / `seccomp`). It is the Linux deny-list with two calls left open, because runc fails the container start instead of falling back: keyrings (`keyctl`, `add_key`, `request_key`) and `bpf` (cgroup v2 device controller). io_uring, the new mount API, `clone3`, nested user namespaces, and the rest stay blocked. Escape hatch: `DOCKER_LAB_SECCOMP=unconfined`.

**Live test (2026-10-06, `labs-linux` base node, AL2023 kernel, systemd 255 in `devsetu/linux-lab:v0.5`)**, spike box with the profile:

- PASS: user namespace, systemd as PID 1, system `running` with no failed units (boot 0.4 s userspace, 9 MiB), journalctl, learner sudo, useradd/chown/userdel, ACLs, custom unit start, cron, nftables, tmpfs mount, negative nice, strace, sshd when started (`systemctl start ssh` + `ssh-keyscan`), a hardened unit (`PrivateTmp`, `ProtectSystem=strict`, `ProtectHome`, `NoNewPrivileges`), `unshare -n -m`.
- Blocked as intended: io_uring (ENOSYS), keyctl (ENOSYS), `unshare -Ur` (EPERM), units with `PrivateUsers=yes`. No lab uses `PrivateUsers=`, `DynamicUser=`, nested user namespaces, keyrings or io_uring (grep over `backend/challenges`).
- Unchanged pre-existing fails: loop + ext4 mount (never worked in user namespaces), sshd not running at boot (off by default since image v0.3).

**Limits.** A deny-list doesn't cover syscalls added to future kernels, and it leaves the rest of the kernel reachable. A strict allow-list (containerd's default profile plus what systemd needs with the box's capabilities) is the next step.

## 5. io_uring disabled on learner nodes

**Fix.** Learner node boot scripts write `/etc/sysctl.d/90-devlabs-learner.conf` with `kernel.io_uring_disabled = 2` and apply it:
- managed groups: a `text/x-shellscript` part in the launch template user data (`nodegroups.sh`)
- Karpenter pools: the same script added to each `EC2NodeClass` `userData`, now MIME multipart

This covers every pod on learner nodes, including Docker boxes and Kubernetes-lab pods, which seccomp doesn't. The script runs during boot, so in the first seconds after a node joins, io_uring is blocked only by seccomp (Linux boxes).

## 6. No-root box for free labs

**Problem.** The free (publicly reachable, no-plan) labs ran the same box as paid labs: systemd as PID 1 with `SYS_ADMIN`, `NET_ADMIN`, `NET_RAW`, `SYS_PTRACE`, `SYS_RESOURCE`, `SYS_NICE`, `AUDIT_WRITE` and a sudo-capable `learner`. That is the widest kernel attack surface (the capabilities behind the escape CVEs — e.g. `CAP_SYS_ADMIN` for CVE-2022-0185, `CAP_NET_ADMIN` for CVE-2024-1086) handed to the least-trusted, zero-cost tier. The free labs don't need any of it: they're shell navigation, file organization and `find` (`linux-00/01/02`), whose own graders and solutions require working *without* sudo.

Note isolation does **not** depend on the learner being non-root — the box is user-namespaced (`hostUsers: false`), so root-in-box is already an unprivileged node UID. This is defense-in-depth: it removes the capability/seccomp surface that a kernel bug would need, for the tier where that matters most.

**Fix.** A `platformSpec.box.unprivileged` flag (linux flavor only) that swaps the box for a no-root runtime:

- **No added capabilities.** `drop: [ALL]`, then add back only the six the lab setup and `runuser`→`learner` need: `SETUID`, `SETGID`, `CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `FSETID`. Verified on a live box: `CapEff` is `…db`, exactly those six, no `SYS_ADMIN`/`NET_ADMIN`.
- **`seccompProfile: RuntimeDefault`** instead of the custom `devlabs/linux-box.json` deny-list and its exemptions.
- **No systemd.** A plain `sleep infinity` PID 1 (setup execs in as root, the shell execs in as `learner`), so no `devlabs.io/cgroup-rw` annotation and no NRI/cgroupfs involvement; Ready as soon as the container runs.

Why not just block the `sudo` command: that leaves setuid-root binaries (`su`, `mount`, …) able to re-arm the box's capabilities. Removing the capabilities at the pod level is what actually shrinks the surface, so even `sudo`-to-root in a no-root box lands on an empty capability set.

- `backend/types/domain.ts`: `LinuxBoxSpec.unprivileged`.
- `backend/workspace/linuxBox.ts`: `boxPodYaml` branches on it; paid boxes unchanged (systemd caps, readiness probe, custom seccomp, cgroup-rw all intact).
- `backend/challenges/packs/linux-00/01/02-*.json`: `box.unprivileged: true`; the "systemd / sudo works" hint corrected to "plain shell work, no sudo needed".
- `backend/challenges/linux/linux-02-*/`: `linux-02` originally needed sudo to delete root-owned dumps. Its `setup.sh` now creates `/var/tmp/order-dumps` learner-owned, and the solution's `sudo find … -delete` became `find … -delete`, making it genuinely no-root. The `/srv` find-by-owner and `/etc` copy steps were already read-only and unchanged.

Scope is keyed on whether a lab needs root, not free-vs-paid (they coincide today: the free set is exactly the no-root labs). From `linux-07` on, the module is built around root + systemd and stays on the full box.

**Live test (2026-10-06, `labs-linux` base node).** For each of `linux-00/01/02`: stood up the no-root box, ran the real `setup.sh` (rc=0), solved it as `learner` with no sudo, ran the real `grade.sh` → **PASS** for all three. Confirmed PID 1 is `sleep`, setup execs in as root, and `runuser`→`learner` works under the reduced caps.

**Limits.** Only the free tier is reduced; paid labs keep the full box, so the escape surface still exists for payment-identified users (traceability/cost is the deterrent there, as in §4). This doesn't replace fixes 1–5, which apply to all tiers.

## Rollout (in this order)

Run from the repo root with AWS admin credentials and `export KUBECONFIG=$PWD/kube/k8s-lab.kubeconfig`.

```bash
# 1. [DONE 2026-10-06] Seccomp profiles on Linux nodes.
./deploy/eks/eks-linux.sh seccomp

# 2. [DONE 2026-10-06] Network policy agent. Idempotent; pass the groups that exist.
EKS_NODEGROUPS=system-k8s,labs-linux ./deploy/eks/eks-recreate.sh
kubectl -n kube-system get ds aws-node -o jsonpath='{.spec.template.spec.containers[*].name}'
#    → lists aws-eks-nodeagent (confirmed running)

# 3. [DONE 2026-10-06 for labs-linux] Roll learner node groups onto hop limit 1 + io_uring
#    off + latest AMI. Evicts running boxes / labs on that group: do it with no learners active.
./deploy/eks/eks-nodegroup-update.sh labs-linux
#    TODO when those groups exist: ./deploy/eks/eks-nodegroup-update.sh labs-k8s labs-docker

# 4. [TODO when Karpenter is installed] Karpenter pools: re-apply; drift replaces nodes once empty.
./deploy/eks/eks-karpenter.sh        # labs-elastic
./deploy/eks/eks-linux.sh up         # labs-linux-elastic (+ NRI plugin + seccomp profiles)
./deploy/eks/eks-docker.sh up        # labs-docker-elastic

# 5. [TODO] Deploy the backend (seccomp on boxes + CRIT-1 removal + no-root free boxes),
#    e.g. scripts/sync-to-ec2.sh. Local dev backend already restarted with these changes on 2026-10-06.
```

The backend must not ship before step 1 on any cluster with Linux nodes: boxes referencing a missing profile fail with `CreateContainerError`. If that happens, set `LINUX_LAB_SECCOMP=unconfined` and restart the backend.

## Verify after rollout

From a box on each Linux node (as root):

```bash
curl -s -m3 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
  http://169.254.169.254/latest/api/token; echo " exit=$?"   # times out (exit 28)
cat /proc/sys/kernel/io_uring_disabled                        # 2
grep Seccomp: /proc/1/status                                  # Seccomp: 2
unshare -Ur true; echo $?                                     # non-zero
ping -c1 -W2 <another box IP>; nc -z -w2 <node IP> 10250       # both fail
timeout 10 apt-get update                                      # fails (no internet)
```

And `./deploy/eks/eks-linux.sh spike` (all PASS except the optional ext4 mount, sshd-at-boot and apt egress), then `./deploy/eks/eks-linux.sh down` to remove the spike.

## Verification (6 Oct 2026)

Backend restarted with the profile wired in. Then, on a seccomp-profiled box:

- **All 26 Linux labs**: every `setup.sh` exited 0 and every `grade.sh` ran cleanly (logical FAIL on the unsolved box, no blocked-syscall errors). Lab 12 (systemd service) was solved end to end and graded **PASS**, including the crash-and-restart check.
- **Attacker vs victim box** (same node, real `dl-box-isolation` policy): blocked — box↔box ping and lab service, system node, CoreDNS metrics, IMDS (times out), public internet, `memory.max` write, `bpf`, io_uring, keyctl, nested user namespaces. Reachable — only the attacker's **own node** `kubelet :10250` (401) and `sshd :22` (key-only); see the first item below.

## Still open

- **Pod → own-node traffic isn't policed (AWS VPC CNI limitation).** Verified 2026-10-06: with the network policy enforced, an attacker box could not reach another box (ping or its `:9000` service), the system node, CoreDNS metrics, IMDS, or the internet — but it **could** reach its own node's `kubelet :10250` (returned **401**, auth required) and `sshd :22` (key-only). The VPC CNI policy agent always allows node↔pod traffic so kubelet health probes work, and pod→node rides the same path. Exposure is low because those services are authenticated, but it's defense-in-depth worth closing later (host nftables on learner nodes dropping pod-CIDR → node `:10250`/`:22`, or confirm no other sensitive host ports listen). Keep kubelet authn/authz on (EKS default).
- Other audit criticals: hardcoded admin credentials in the public repo, user-chosen `gradeScript` executed as root, registration forced open.
- The backend's AWS user has EKS cluster-admin; scope it to the namespaces it manages.
- Seccomp profile for Docker boxes; strict allow-list for Linux boxes.
- No platform NetworkPolicy in `ns-*` (Kubernetes labs).
- Pin `devsetu/linux-lab` and `devsetu/nri-cgroup-rw` by digest.
- Monthly `eks-nodegroup-update.sh` for kernel patches on managed groups.
