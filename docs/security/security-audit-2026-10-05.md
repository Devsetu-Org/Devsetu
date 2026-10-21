# DevSetu Security Audit: Full repository (2026-10-05)

## Executive summary

DevSetu is **not safe to ship** in its current state. Any internet user can sign up (registration is forced open on every boot), start a free Kubernetes lab, and then use the learner `kubectl` API (`POST /api/session/:id/k8s/exec`) to make the backend read its own environment (JWT secret, DB password, AWS keys of an EKS cluster-admin IAM user, Google/Razorpay secrets) or swap in the controller kubeconfig. That is a full platform and cluster compromise in a handful of requests. Two more independent Critical paths exist: a user-chosen `gradeScript` that the backend downloads and executes as root, and a hardcoded platform-admin email/password committed to the **public** GitHub repo and re-seeded on every boot. The infrastructure layer also lets learner pods reach EC2 instance metadata (IMDSv2 hop limit 2, no NetworkPolicy in learner namespaces). The isolation engineering inside the lab shell, lab-file API and snapshot restore is genuinely good; the problems are in the API's trust boundary and in auth.

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High     | 5 |
| Medium   | 7 |
| Low      | 12 |
| Info     | 4 |

## Scope & methodology

**Reviewed:** entire repository at `HEAD` (`3fda87c`) plus the working tree: `backend/` (server, routes, auth, billing, admin, db, cache, sandbox, workspace, challenges incl. setup/grade scripts, observability, services, scripts), `frontend/` (src, `vite.config.ts`, built `dist/` scanned for secrets), `deploy/` (Dockerfiles, nginx, `eks/` scripts and manifests, IAM JSON, env examples), `images/`, `kube/`, `docker-compose.*.yml`, `Makefile`, `scripts/`, `docs/`, `.github/workflows/`, root files, and untracked local files (`k8s-lab.kubeconfig`, `kube/k8s-lab.kubeconfig`, `deploy/env.ec2`, `backend/.env`, `backend/.env copy`, `frontend/.env`, `.devlabs-beta.pem`, `docker-spike.log`).

Note: the `deploy/eks/{eks-destroy.sh,env.sh,nodegroups.sh}` modifications listed in the starting git status are no longer uncommitted; they appear to be part of commit `3fda87c`, so they were audited at `HEAD`.

**Attacker models:** (1) malicious authenticated lab user running untrusted code (primary); (2) anonymous internet user; (3) compromised dependency.

**Tools actually run:** `npm audit --json` (backend, frontend), `git ls-files` / `git log --all --name-only` / `git log --all -p` regex secret sweep (gitleaks-style patterns for AWS, Google, Razorpay, Anthropic/OpenAI, GitHub, Slack, private keys, JWTs), `git log -S`, `gh repo view` (visibility check), `rg`/ripgrep pattern hunting, manual code review. `gitleaks`, `trivy`, `semgrep`, `hadolint`, `kube-score`, `checkov`, `tfsec` are **not installed** and were not used. `kubectl` is installed but was **not** pointed at any cluster (read-only static analysis only, per scope).

**Out of scope / not verified live:** running cluster state (actual launch-template metadata options, whether the VPC CNI NetworkPolicy agent is enabled, node kernel versions), the external Spark Platform service, AWS IAM policies attached to `AmazonEKSNodeRole` / `KarpenterNodeRole-devlabs` beyond what the repo declares, and the production database contents. Findings that depend on those are marked **Needs verification**.

---

## Findings

### [CRIT-1] Learner kubectl API lets any user read backend secrets, take over the controller kubeconfig, and write files on the backend
- **Severity:** Critical | **Category:** Command/argument injection, sandbox escape / CWE-88, CWE-73
- **Location:** `backend/routes/session.ts:556-583`, `backend/workspace/k8sCluster.ts:1624-1697`
- **Description:** `POST /api/session/:id/k8s/exec` takes a free-form `args` array (or a `command` string split on whitespace) and runs `kubectl` **on the backend host