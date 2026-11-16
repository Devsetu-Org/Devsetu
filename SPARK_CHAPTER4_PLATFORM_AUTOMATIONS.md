# Spark Chapter 4 — Platform Automations
## Design Specifications

**Theme:** Building tools and automation for a production Spark platform. Move from reactive incident response to proactive platform engineering through code.

**Philosophy:** Previous chapters taught you to diagnose and fix problems manually. This chapter teaches you to **automate** prevention, provisioning, and remediation so the platform runs itself—and fails safely when it can't.

**Tech Stack:** Python 3.x for automation and controllers, Bash for operational wrappers, YAML for declarative config, K8s client libraries (`kubectl` + Python `kubernetes` / `kopf`), YARN REST APIs, Flask for the usage dashboard.

**Setup Mix:** Labs use YARN and K8s (no standalone). Focus is on **writing durable automation**, not cluster architecture.

**Chapter shape (5 labs):**
1. Policy engine (declare + refuse bad submits)
2. Team runtime provisioner (build what app teams need)
3. Control loop (detect drift + reconcile)
4. Kubernetes controller (auto-inject + enforce on SparkApplications)
5. Multi-tenant usage tracking (cost attribution for app teams)

---

## Why the old first four were collapsed

| Old lab | Overlap | Where it went |
| --- | --- | --- |
| Apply defaults (01) | Same "desired YAML → platform state" idea as guardrails | Folded into **Platform-01** as `apply` |
| Guardrails (02) | Same policy file, just the refuse path | Folded into **Platform-01** as `validate` / `safe-submit` |
| Detect drift (03) | Half of a control loop | Folded into **Platform-03** |
| Reconcile (04) | Other half of the same loop | Folded into **Platform-03** |

**New Platform-02** (team runtime provisioner) is the missing heavy piece: app teams do not only need defaults and refusal—they need a **provisioned runtime** (deps, env, receipt) they can actually run against.

---

## Lab Platform-01
**Difficulty:** L1  
**Title:** "Platform Policy Engine: Apply Defaults and Refuse Bad Submits"  
**Setup:** Spark on YARN (shell + RM + 2 NMs). Guardrail checks also cover K8s-style image rules in the policy file so the same engine later feeds Lab 04.

### SITUATION
QuickBite's Spark submits are snowflakes. Some teams omit event logging. Some ask for 64 huge executors and wedge the cluster. Some point at a laptop registry image that never pulls. SREs keep rewriting wiki pages; the wiki does not stop a bad submit.

Platform wants **one CLI** that owns policy end-to-end:

1. **Apply** a declarative `platform-policy.yaml` onto the shell's `spark-defaults.conf` (idempotent).
2. **Validate** a proposed submit (script or job YAML) against the same policy—fail closed, audit every reject.
3. **Safe-submit**: validate first; only then call `spark-submit`. Never submit a rejected request.

You are not writing two toys. You are shipping a small **policy engine** teams will actually wrap around production submits.

### PLANTED SETUP
- YARN cluster up; shell `spark-defaults.conf` is incomplete or contradictory (eventLog off / wrong memory).
- `~/platform/platform-policy.yaml`:
  ```yaml
  defaults:
    spark.eventLog.enabled: true
    spark.eventLog.dir: "hdfs://ds-spark-01:9000/spark-logs"
    spark.dynamicAllocation.enabled: false
    spark.executor.memory: "1g"
    spark.executor.cores: "1"
    spark.executor.instances: "2"
    spark.driver.memory: "1g"
  guardrails:
    executor:
      memory: { min: "512m", max: "4g" }
      instances: { max: 16 }
    driver:
      memory: { min: "512m", max: "2g" }
    image:
      allowedRegistries:
        - "quickbite-registry.internal"
        - "docker.io/bitnami"
      requiredPullSecret: "quickbite-registry-pull"
  ```
- Skeleton `~/platform/platformctl.py` with subcommands stubbed: `apply`, `validate`, `safe-submit`.
- Test cases under `~/lab/test-cases/`:
  - `valid-submit.sh` → PASS
  - `too-many-executors.sh` → FAIL
  - `memory-too-low.sh` → FAIL
  - `bad-image.sh` → FAIL (registry not allowed)
  - `missing-pull-secret.sh` → FAIL when private registry is used without pull secret
- Probe job `~/lab/test-submit.sh` with almost no `--conf` flags (must inherit applied defaults after `apply`).

### INVESTIGATION (light)
- Diff current `spark-defaults.conf` against `defaults:` in the policy.
- Predict which test cases fail and why before coding the checks.

### TASKS (heavy)
1. Open the Guide. Read the policy file as the single source of truth.
2. Implement `platformctl apply`:
   - Parse policy YAML; flatten into `key=value` lines for `spark-defaults.conf`.
   - If current file already matches → print `No changes needed`, exit 0.
   - Else backup to `spark-defaults.conf.bak`, write new file, print `Applied N changes`.
3. Run `apply` twice; second run must be a no-op (idempotency).
4. Implement `platformctl validate <path>`:
   - Parse submit script / job YAML for executor/driver memory, instances, image, pullSecrets.
   - Enforce every guardrail in the policy (ranges, max instances, registry allowlist, pull-secret rule).
   - On reject: clear message, append JSON line to `~/platform/audit.log`, exit 1.
   - On pass: `VALIDATED`, exit 0.
5. Run all five test cases; only `valid-submit.sh` passes.
6. Implement `platformctl safe-submit <path>`: call validate; on failure do **not** invoke spark-submit; on success run the submit against YARN.
7. After a successful `apply`, run `safe-submit` on a thin probe and prove inheritance (eventLog on, executor memory from defaults) via RM/app config or driver logs.
8. Change one default in the policy (e.g. executor memory `2g`), re-`apply`, confirm the conf updates.
9. Investigation: why one policy file for both apply and refuse? What does fail-closed buy you?
10. Submit.

### GRADING
- `platformctl apply` is idempotent; backup exists after first real change; conf matches `defaults:`.
- All planted bad submits fail with distinct reasons; valid submit passes.
- `audit.log` has reject entries (timestamp, job id, reason).
- `safe-submit` never launches spark-submit for a rejected case (grader can wrap/spy or check no new app id).
- Probe inherits applied defaults after `apply`.
- Investigation answers coherent.

### LEARNING OBJECTIVES
- Treat platform policy as code, not wiki text.
- Ship idempotent apply + fail-closed validation in one tool.
- Audit refusals as an operational requirement.

### IMPLEMENTATION NOTES
- Memory units: normalize `512m` / `1g` / `1Gi` to MiB before compare.
- Image check: prefix-match registry; require pull secret only for private registry.
- Subcommands: `argparse` or click; keep apply and validate sharing one policy loader.

---

## Lab Platform-02
**Difficulty:** L1–L2  
**Title:** "Provision a Team Spark Runtime (and Leave a Receipt)"  
**Setup:** Spark on Kubernetes (namespace per team request). Distinct from Lab 01: you are not only writing defaults—you are **building a consumable runtime** for an application team.

### SITUATION
Analytics and ML share the same K8s Spark platform, but they do not share the same needs. Analytics wants two extra JARs and a warehouse env var. ML wants a different base image tag plus a GPU-related env (or a larger default executor memory in their team conf). Today an SRE SSHs in, hand-edits conf, copies jars into a shared path, and forgets what was done. Next week nobody knows which team got which runtime.

Platform needs a **provisioner**:

1. Read a **team request** YAML (who, which deps, which env, which image pin).
2. **Refuse** illegal requests (unknown team, disallowed image, jars outside the approved artifact store).
3. **Materialize** the runtime: write team conf overlay, stage approved jars into a team volume/path (or generate a Dockerfile / image tag pointer—pick one path and stick to it), set env files.
4. Write a **receipt** JSON that the next tooling (submit wrapper, controller, or CI) can trust: team, image, jar digests, env keys, timestamp, provisioner version.
5. Prove the team can submit a job that **only works** with the provisioned runtime (missing jar / wrong env → fails before provision; succeeds after).

This is the lab for **application-team enablement**: you build what multi-tenant teams actually consume.

### PLANTED SETUP
- K8s Spark namespace `quickbite-spark` with a base image that does **not** include team JARs.
- Approved artifact store at `/mnt/lab-shared/artifacts/` with real jars: `store-enrichment.jar`, `ml-feature-lib.jar`. A decoy `/tmp/unapproved/evil.jar` must be rejected.
- Team request examples in `~/lab/requests/`:
  - `analytics-request.yaml` (valid): team `analytics`, jars `[store-enrichment.jar]`, env `WAREHOUSE_URL=hdfs://...`, image `quickbite-registry.internal/spark-quickbite:v2.1`.
  - `ml-request.yaml` (valid): team `ml`, jars `[ml-feature-lib.jar]`, env `FEATURE_STORE=...`, same or sibling image tag.
  - `bad-image-request.yaml`: image from `my-laptop:5000/...` → must refuse.
  - `bad-jar-request.yaml`: jar path outside artifact store → must refuse.
  - `unknown-team-request.yaml`: team not in allowlist → must refuse.
- Allowlist `~/platform/teams.yaml`: known teams, max jar count, allowed image prefixes.
- Skeleton `~/platform/provision-runtime.py`.
- Canary job `~/lab/jobs/analytics-canary.py` (or jar main) that **imports/loads** the enrichment class / reads `WAREHOUSE_URL`—fails loudly if runtime incomplete.

### INVESTIGATION (light)
- Run the canary before provision → confirm ClassNotFound / missing env.
- Read a valid request and map each field to an on-disk artifact the provisioner must create.

### TASKS (heavy)
1. Open the Guide. Understand request → runtime → receipt → canary.
2. Implement request validation against `teams.yaml` (team known, image allowed, jars under artifact store, jar count ≤ max).
3. On invalid request: print reason, append audit line, exit 1, **touch nothing** under team runtime dirs.
4. On valid request, materialize under `~/runtimes/<team>/` (or `/mnt/lab-shared/runtimes/<team>/`):
   - `spark-defaults-overlay.conf` (or `spark-env.sh`) with team env and any team-specific Spark keys.
   - `jars/` containing **copies or symlinks** of only approved jars from the artifact store.
   - Optional: `image.txt` pinning the approved image reference for later submit/controller use.
5. Write `~/runtimes/<team>/receipt.json` with: team, image, jar names + sha256, env key names (not secrets), `provisionedAt`, `provisionerVersion`.
6. Re-run provisioner on the same request → idempotent (same receipt digests / "No changes" if unchanged).
7. Change one jar in the request → re-provision updates jars + receipt; old jar gone from `jars/`.
8. Wire a submit helper (small script you finish) that exports env from the runtime and puts `jars/` on the classpath / `--jars`, then run the analytics canary → success.
9. Refuse path: prove `bad-jar-request` and `bad-image-request` leave no partial runtime dir (or leave it untouched from a previous good provision—grader checks no evil jar present).
10. Investigation: why a receipt? Who consumes it? Why refuse unapproved jar paths even if the file exists on the node?
11. Submit.

### GRADING
- Valid analytics (and ideally ML) provision creates overlay + jars + receipt with correct digests.
- Invalid requests exit non-zero, audit logged, no unapproved jar staged.
- Canary fails before provision / succeeds after (or equivalent proof via a grader-run job).
- Second identical provision is idempotent.
- Receipt fields complete enough for a downstream tool to trust without re-reading the request.
- Investigation answers cover receipt consumers and supply-chain refusal.

### LEARNING OBJECTIVES
- Provision **team-scoped runtimes**, not only cluster-wide defaults.
- Fail closed on artifact/image policy before mutating disk.
- Hand off state via a machine-readable receipt (platform ↔ app teams ↔ CI).

### IMPLEMENTATION NOTES
- sha256 via `hashlib` while copying jars.
- Atomic write: stage into `runtimes/<team>.tmp/` then `os.replace` into place so failed runs do not leave half-provisioned trees.
- Keep secrets out of receipts; env **keys** only, or redact values.
- K8s angle: runtime dir can be a shared volume the driver/executor pods mount; lab can simulate with `/mnt/lab-shared/runtimes` even if full image build is out of scope.

---

## Lab Platform-03
**Difficulty:** L2  
**Title:** "Control Loop: Detect Drift, Then Reconcile"  
**Setup:** Spark on YARN. One lab = full loop (old detect + reconcile clubbed).

### SITUATION
Production jobs are supposed to match YAML under `~/platform/jobs/`. Reality: someone one-off-submitted `store-rollup-prod` with half the executors; `dispatch-stream` is running with dynamic allocation on when the desired file says off. Pages follow. A detector that only prints drift still leaves SREs to kill and resubmit by hand under pressure.

You build **one control-loop tool** with two modes:

- `detect` — compare running apps (YARN RM REST) to desired YAML; exit 1 on drift; structured report.
- `reconcile` — detect, then for each drifted app: optional dry-run, else kill → wait → resubmit from YAML → wait RUNNING → re-check; audit every action; continue on per-app failure; idempotent when clean.

This is the same pattern behind Kubernetes controllers—on YARN, in a script you own.

### PLANTED SETUP
- Running apps:
  - `store-rollup-prod`: actual 2×512m; desired 4×1g.
  - `sales-nightly`: matches desired.
  - `dispatch-stream`: dynamic allocation ON; desired OFF.
- Desired YAMLs in `~/platform/jobs/` (name, executor instances/memory, driver memory, dynamicAllocation, jar/main entry).
- Skeleton `~/platform/control-loop.py` with `detect` and `reconcile` (flag `--dry-run`).
- RM API: list apps, get app, PUT state KILLED.

### INVESTIGATION (light)
- Hit RM REST; map each RUNNING app to a desired file (or mark unexpected).
- Confirm which two are drifted before writing fix logic.

### TASKS (heavy)
1. Open the Guide. Internalize detect → (dry-run) → act → verify.
2. Implement desired-state loader (directory of YAMLs keyed by `applicationName`).
3. Implement RM client helpers: list RUNNING, get conf/props, kill, wait for state.
4. Implement `detect`: normalize memory units; compare instances, memory, dynamicAllocation, driver memory; print per-field drift; summary; exit 0/1.
5. Prove detect catches `store-rollup-prod` and `dispatch-stream`, clean on `sales-nightly`.
6. Implement `reconcile --dry-run`: same report plus planned kill/resubmit lines; **no** kills.
7. Implement `reconcile`: for each drifted app, kill, wait KILLED, build `spark-submit` from YAML, submit, wait RUNNING, re-detect that app; log to `~/platform/reconciliation.log`.
8. Run real reconcile; both drifted apps match desired; sales-nightly untouched.
9. Run reconcile again → `No reconciliation needed`, exit 0.
10. Inject a broken desired field for one app (optional chaos): reconcile must log failure for that app and still fix the other.
11. Investigation: when is auto-reconcile unsafe? Why dry-run first?
12. Submit.

### GRADING
- Detect accuracy on all three planted apps; correct exit codes.
- Dry-run makes no RM kill / no new submit.
- Live reconcile repairs both drifted apps; audit log has kill/resubmit/success (or fail) lines.
- Second reconcile is a no-op.
- Partial failure does not abort the whole loop (if chaos case is graded).
- Investigation answers show judgment, not just definition of drift.

### LEARNING OBJECTIVES
- Own a full control loop, not only an alert.
- Safe automation: dry-run, audit, per-item error isolation, idempotency.
- Separate "observe" from "mutate" behind one binary.

### IMPLEMENTATION NOTES
- Poll with timeout/backoff; never spin forever.
- Resubmit must encode enough of the YAML to recreate the intended shape (instances, memory, dyn alloc, name, queue if present).
- Prefer structured drift JSON for later alerting hooks.

---

## Lab Platform-04
**Difficulty:** L2 (Kubernetes controller development)  
**Title:** "Build a Kubernetes Controller: Auto-Inject Platform Standards"  
**Setup:** Spark on Kubernetes cluster with Spark Operator

### SITUATION
QuickBite's Spark platform runs on Kubernetes with the Spark Operator (SparkApplication CRDs). Teams submit jobs by creating SparkApplication resources. But problems keep happening:

**Problem 1: Missing platform defaults.** Teams forget to set image pull secrets → ImagePullBackOff. They skip resource limits → pods get evicted. They omit cost-tracking labels → finance can't bill teams.

**Problem 2: No validation at admission time.** Teams create SparkApplications with 64 executors on a 48GB cluster → jobs sit Pending forever. Invalid memory configs pass through → OOMKilled later.

**Problem 3: Manual cleanup.** Completed SparkApplications stay in the cluster forever, cluttering `kubectl get sparkapplications`. SREs manually delete them weekly.

**Platform team's decision:** Build a **Kubernetes controller** that watches SparkApplication resources and:
1. **Validates** them against guardrails at creation time (before Spark Operator relies on them).
2. **Auto-injects** platform defaults (pull secrets, labels, resource limits, memory overhead) if missing.
3. **Lifecycle management**: Adds finalizers to clean up associated resources when a SparkApplication is deleted. Optionally auto-deletes SparkApplications N days after completion.

Your task: **Build a custom Kubernetes controller in Python** (using the `kopf` library) that watches SparkApplication CRDs and enforces platform policies automatically.

### PLANTED SETUP
- K8s cluster (3 nodes, 16GB each) with Spark Operator installed (`sparkoperator.k8s.io/v1beta2` SparkApplication CRDs).
- Guardrails / policy file compatible with Platform-01 (`~/platform/platform-policy.yaml` or `guardrails.yaml`).
- Python 3.10+ with `kopf`, `kubernetes`, `pyyaml`.
- Skeleton `~/platform/controller/spark-controller.py`.
- Sample SparkApplication YAMLs in `~/lab/test-apps/`:
  - `valid-app.yaml`
  - `missing-pullsecret.yaml`
  - `missing-labels.yaml`
  - `too-many-executors.yaml`
  - `memory-overhead-missing.yaml`
- Platform policy:
  - Private registry images **must** get `imagePullSecrets: [quickbite-registry-pull]`.
  - Labels `team` and `cost-center` **must** exist (inject from namespace map if missing).
  - `memoryOverhead` **must** be set (default 20% of memory if missing).
  - Executor instances **must** be ≤ 16.
  - Completed/Failed apps older than 7 days may be auto-deleted.

### INVESTIGATION (light)
- Skim `kopf` create/delete/timer handlers.
- Contrast admission webhook (block at API) vs controller (reconcile after create).
- Inspect SparkApplication fields you will mutate.

### TASKS (heavy)
1. Open the Guide. Watch → validate/mutate → status/finalizer.
2. Implement `@kopf.on.create` for SparkApplications; load policy once at startup.
3. Validation: instances/memory ranges; on failure raise `kopf.PermanentError` with a clear message (no driver should usefully proceed).
4. Auto-inject: pull secrets, team/cost-center labels, executor/driver memoryOverhead; patch via CustomObjectsApi.
5. Add finalizer `platform.quickbite.io/cleanup`; on delete, clean platform-owned side resources then remove finalizer.
6. Optional `@kopf.timer`: delete COMPLETED/FAILED apps older than 7 days.
7. Run `kopf run ... --verbose`.
8. Apply each test app; prove inject paths and reject path via logs + `kubectl get/yaml`.
9. Investigation: webhook vs controller; why finalizers; why kopf.
10. Submit.

### GRADING
- Controller runs; watches SparkApplications.
- Inject cases: pull secret, labels, memoryOverhead present after reconcile.
- Reject case: too many executors → PermanentError; no healthy success path.
- Finalizer present on create; delete handler runs.
- Bonus: stale completed app cleaned by timer (may be simulated by backdating status).
- Investigation answers solid.

### LEARNING OBJECTIVES
- Build a real K8s controller / mini-operator.
- Mutate + validate at platform layer for multi-tenant SparkApplications.
- Use finalizers for safe lifecycle cleanup.

### IMPLEMENTATION NOTES
- `kopf run controller.py --verbose`; patch with `CustomObjectsApi.patch_namespaced_custom_object`.
- Memory overhead: parse units, take ~20%, write back as `Nm`.
- Timer interval can be shortened in the lab (e.g. 60s) with a 7-day check against planted old timestamps.

---

## Lab Platform-05
**Difficulty:** L2  
**Title:** "Multi-Tenant Usage Tracking: Cost Attribution & Resource Reports"  
**Setup:** Spark on Kubernetes with multiple teams' SparkApplications

### SITUATION
Five teams share the Spark-on-K8s platform. Leadership asks who burns the most capacity. Finance wants chargeback. Teams ask how many executor-hours they used—and whether they are over fair-share. Nobody has a trustworthy answer; metrics exist but are not rolled up by `team` / `cost-center`.

Build a **usage tracking system** that:
1. Queries SparkApplication history (and labels).
2. Computes per-team executor-hours, driver-hours, CPU-core-hours, memory-GB-hours, job counts.
3. Emits daily/weekly CSV/JSON reports.
4. Serves a small Flask dashboard so each team sees **its own** usage without kubectl.
5. Soft-quota alerts when a team exceeds monthly executor-hours from `quotas.yaml`.

This is application-team facing platform work: transparency, chargeback, fairness.

### PLANTED SETUP
- 15+ completed SparkApplications across teams `analytics`, `ml`, `etl`, `finance`, `marketing` with `team` and `cost-center` labels, start/completion times, executor shapes.
- `~/platform/quotas.yaml` with `monthlyExecutorHours` per team.
- Skeletons `~/platform/usage-tracker/tracker.py` and `dashboard.py`.

### INVESTIGATION (light)
- `kubectl get sparkapplications -A -o json` (or API) and spot label + timing fields you will aggregate.

### TASKS (heavy)
1. Open the Guide. Query → aggregate → report → dashboard → quota alert.
2. Implement tracker CLI with `--start-date` / `--end-date`.
3. Per app: duration hours, executor-hours, driver-hours, CPU-core-hours, memory-GB-hours.
4. Aggregate by team; write `~/platform/reports/usage-report-....csv`; print top consumer.
5. Compare month-to-date usage to quotas; warn when over.
6. Flask: `/` team list, `/team/<name>` detail + remaining quota + recent jobs, `/admin` all-teams table (token-gated).
7. Complete one new team job; re-run tracker / refresh dashboard; new row appears.
8. Investigation: why self-service usage pages matter for multi-tenant platforms; what finance does with the CSV.
9. Submit.

### GRADING
- Tracker aggregates correctly; CSV present; quota warnings work when quota lowered.
- Dashboard routes work with coherent numbers.
- New completed app shows up after refresh.
- Investigation answers cover chargeback / fairness / reducing SRE interrupt load.

### LEARNING OBJECTIVES
- Multi-tenant cost attribution from live cluster objects.
- Self-service visibility for app teams.
- Soft quotas as social + operational contract.

### IMPLEMENTATION NOTES
- CustomObjectsApi list; parse ISO times; normalize memory units.
- Cost estimate = rate × executor-hours from quotas file.
- Keep dashboard queries read-only against the API or against the latest CSV snapshot.

---

## Summary of Chapter 4 Labs

### Lab progression (5 labs)

| Lab | Title | Difficulty | Focus | Setup |
| --- | --- | --- | --- | --- |
| Platform-01 | Platform Policy Engine: Apply Defaults and Refuse Bad Submits | L1 | One CLI: idempotent apply + fail-closed validate + safe-submit | YARN |
| Platform-02 | Provision a Team Spark Runtime (and Leave a Receipt) | L1–L2 | Team-scoped runtime + artifact policy + receipt for app teams | K8s |
| Platform-03 | Control Loop: Detect Drift, Then Reconcile | L2 | Full detect → dry-run → kill → resubmit → verify | YARN |
| Platform-04 | Build a Kubernetes Controller: Auto-Inject Platform Standards | L2 | kopf controller: validate, inject, finalizers | K8s |
| Platform-05 | Multi-Tenant Usage Tracking: Cost Attribution & Resource Reports | L2 | Aggregation, chargeback CSV, team dashboard, soft quotas | K8s |

### What each lab uniquely solves

| Lab | Unique job |
| --- | --- |
| 01 | **Policy as a product** — defaults and refusal share one file and one binary |
| 02 | **Team enablement** — provision deps/env/image pin + receipt (not just refuse/apply globals) |
| 03 | **Control plane on YARN** — observe and mutate until desired state holds |
| 04 | **K8s-native enforcement** — continuous reconcile on SparkApplication CRDs |
| 05 | **Multi-tenant economics** — usage, chargeback, fair-share visibility for app teams |

### Design principles

- Coding-heavy in every lab; investigation stays light.
- Every lab ships a durable tool (CLI, provisioner, control loop, controller, tracker)—not a one-off fix.
- YARN + K8s mix; no standalone.
- App-team value is explicit in 02 (runtime) and 05 (usage); 01/03/04 protect the shared platform those teams run on.

---

**Next steps for implementation:** Hand this file to the implementing agent for packs (`setup.sh`, `grade.sh`, GUIDE, skeletons). Do not split Platform-01 or Platform-03 back into pairs—the weight is intentional.
