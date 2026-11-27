# Spark track — Platforms Engineer

Platforms Engineer, Spark panel. Packs live in `backend/challenges/packs/spark-*.json` and are listed on the Spark shelf in `frontend/src/constants/playCatalog.ts`.

Curriculum design: `docs/spark-curriculum-draft.csv`.

Runtime: `sandboxType: spark` → `workspace/sparkBox.ts` in namespace `sp-<user>`. Pods select and tolerate `devlabs.io/pool=spark` (`./deploy/eks/eks-spark.sh`). The shelf lists packs whether or not that pool is up; Start refuses when the pool has no Ready node. Open labs are `finalized: true` with setup + grade; the rest stay `finalized: false` until those land. YARN labs (`yarn-2`) use a one-node HDFS on `ds-spark-01` plus ResourceManager / NodeManager boot steps (not Master / Workers). Shared helpers live in `backend/challenges/spark/_lib/lab.sh` (`yarn_bootstrap`, capacity queues, jps-based daemon checks). Image: `SPARK_YARN_LAB_IMAGE` / `devsetu/spark-yarn-lab:v0.1`.

## Chapter 1 — Foundations of a Spark Cluster

Shape: `spark-2` (master + two workers).

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| spark-01 | Stand Up the Cluster and Find Everything on Disk | orientation | L0 | Open (`finalized: true`, setup + grade) |
| spark-02 | Stabilize Flaky Workers on the Master UI | orientation | L0 | Open (`finalized: true`, kill + stretched timeout plant + grade) |
| spark-03 | Trace a Job From Submission to Last Task | orientation | L0 | Open (`finalized: true`, warm cluster + join seed + grade) |
| spark-04 | Find Where the Data Actually Lives | multi-step-bug | L1 | Pack + Investigation only |
| spark-05 | The Executor Memory Map | orientation | L0 | Pack + Investigation only |
| spark-06 | Diagnose an Executor Lost to Memory Pressure | multi-step-bug | L1 | Open (`finalized: true`, heterogeneous Workers + right-size/relocate hold) |
| spark-07 | FetchFailed Under Local Disk Pressure | capstone | L2 | Open (`finalized: true`, FetchFailed + shuffle-local disk pressure) |
| spark-08 | Post-Maintenance Mess | multi-step-bug | L2 | Open (`finalized: true`, stale Master URL + locked work + broken eventlogs) |

Drain-a-Worker (`spark-08-drain-…`) is **removed** from Chapter 1 (pack may remain on disk, not on the shelf).

**spark-14** (DNS, Memory, and Disk Triple) lives in the **Backlog** chapter — not Chapter 1.

### spark-06

`daemonMode: manual` — **heterogeneous** Workers: `ds-spark-02` = **1 core / 768m**, `ds-spark-03` = **2 cores / 2048m**. Plants `team-b-debug-hold` at **1024m** (only fits B; Storage footprint tiny) and a failed `store-rollup-mem` (also 1024m) that dies sharing B. Fix: right-size hold (any ≤768m), place on A (briefly stop B if needed), re-run victim on B alone; keep hold running. Grade checks hold on small Worker + victim `STATUS=ok` (not an exact MB value).

### spark-07

`daemonMode: manual` — warm Workers with `SPARK_LOCAL_DIRS=$SPARK_HOME/work/spark-local`. Plants capped `DISK_FILLER` plus a **shuffle janitor** wiping `blockmgr`/shuffle files (disk-pressure cleanup). `store-rollup-shuffle` goes healthy → shuffle → **FetchFailed**. Fix: stop janitor, remove filler, re-run to `STATUS=ok`. Platform local-dir remediation — not Lab 6 placement, not app `cache()` edits.

### spark-08

`daemonMode: manual` — Master up; weekend maintenance left **three** faults: stale Master URL (`~/lab/MAINTENANCE_MASTER`), `chmod 000` on Worker `$SPARK_HOME/work`, and `/opt/spark/work/eventlogs` as a **file**. Fix all three, then `store-rollup-probe` → `STATUS=ok`.

### spark-14

`daemonMode: manual` — warm cluster with **three** stacked faults: `spark.driver.host=broken-host.quickbite.invalid`, `spark.executor.memoryOverhead=48m`, and `DISK_FILLER` under `spark-local`. Peel host → overhead → disk; `store-rollup-triple` → `STATUS=ok`.

## Chapter 2 — Spark on YARN

Shape: `yarn-2` (ResourceManager on `ds-spark-01` + NodeManagers on `02`/`03` + shell). Image: `SPARK_YARN_LAB_IMAGE` / `devsetu/spark-yarn-lab:v0.1` (`images/spark-yarn-lab`).

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| spark-09 | Submit the Same Workload on YARN | orientation | L0 | Open (`finalized: true`, migrate wrapper + client/cluster proof + grade) |
| spark-10 | Read the RM and NM as Instruments | orientation | L0 | Open (`finalized: true`, UNHEALTHY NM plant + starved probe + grade) |
| spark-11 | Land in the Right Capacity Queue | multi-step-bug | L1 | Open (`finalized: true`, A+C wrapper + capacity math + grade) |
| spark-12 | Client Mode Driver Is on the Wrong Host | multi-step-bug | L1 | Open (`finalized: true`, stacked client SPOF + shared-mount data) |
| spark-13 | Design a Queue for the Analytics Team | multi-step-bug | L2 | Open (`finalized: true`, design analytics leaf + refreshQueues) |

### spark-09

`daemonMode: auto` — `yarn_bootstrap` starts one-node HDFS on `ds-spark-01`, then RM + both NMs. Brief opens on **YARN forensics** (same hosts, new roles), then a **fix**: planted `~/lab/submit-store-rollup.sh` still uses `$SPARK_MASTER_URL` / `--total-executor-cores`. Learner repairs it to `--master yarn`, 2×1×512m, `$1`-driven deploy mode/name, then launches `store-rollup-client` and `store-rollup-cluster`. Investigation: forensics → fix → client → cluster → lesson. Grade checks the repaired wrapper and both FINISHED apps. Separate from Lab 10 instruments, Lab 11 queues, Lab 12 driver-loss. Local e2e: `solution/validate-local.sh`.

### spark-10

Incident lab (Lab 1.2 shape on YARN). Setup seeds conf, plants a **0.9%** disk-health threshold on `ds-spark-03` only, starts HDFS + RM + both NMs, waits for `02` RUNNING / `03` UNHEALTHY, then starts client-mode `store-rollup-probe` from `shell`. Probe stays **RUNNING** with an AM on the one healthy 1536 MB NM and no room for a 1024 MB executor. Learner verifies the RM health report on the node (`jps` / `df` / `yarn-site.xml`), restores a sane threshold, restarts that NM. Grade: both NMs RUNNING, checker still enabled and threshold below 100%, a `store-rollup-probe` FINISHED/SUCCEEDED, Investigation in story order. Shortcuts (checker off / 100%) fail. Local e2e: `solution/validate-local.sh`.

### spark-11

A+C incident lab. Setup writes capacity queues (default 10 / production 70 / adhoc 20), plants `~/lab/submit-store-rollup.sh` still on `--queue default`, and runs it. Morning `store-rollup` sits **ACCEPTED** because the AM ask (~1024 MB) does not fit default's absolute share while production has spare room. Platform policy (notes) says store-rollup → production. Learner does RM forensics (state/queue/capacity math), repairs the lasting wrapper, proves a FINISHED run in production. Grade rejects raising default capacity and one-off answers without the wrapper fix. Distinct from Lab 13 (design a new leaf queue). Local e2e: `solution/validate-local.sh`.

### spark-12

Stacked incident. Setup plants CSVs only under `~/lab/edge-data` on shell, a `store_rollup.py` that reads those paths, a client-mode wrapper, and kills an overnight client-mode driver mid-job (FAILED). `/mnt/lab-shared` is the cluster-wide mount (K8s hostPath colocated with the RM; Docker volume in local e2e). Learner (1) moves lasting path to `--deploy-mode cluster`, (2) hits FileNotFound on edge paths once the driver is on an NM, (3) copies CSVs to `/mnt/lab-shared/rollup/` and updates the job. Grade: cluster wrapper, shared-mount job paths, data on an NM, FINISHED app, AM on `ds-spark-02`/`03`. Local e2e: `solution/validate-local.sh`.

### spark-13

Chapter 2 capstone — **design**, not borrow. Setup starts default 10 / production 70 / adhoc 20 with **no** `analytics` leaf. Plants ticket notes, a broken `~/lab/capacity-draft.xml` (adds analytics but capacities sum to 120), and `~/lab/submit-analytics-probe.sh` already on `--queue analytics` (first submit logged as queue-missing). Learner edits `capacity-scheduler.xml` on `ds-spark-01`, rebalances siblings (analytics ≥ 20% with max-capacity 100 and user-limit-factor ≥ 2, production ≥ 50%, sum 100), applies with `yarn rmadmin -refreshQueues`, proves a FINISHED `analytics-probe` in `analytics`. Grade rejects borrowing production/adhoc and inflating default. Local e2e: `solution/validate-local.sh`.

## Chapter 3 — Spark on Kubernetes

Shape: `spark-k8s` (shell + in-cluster API in `sp-<user>`; driver/executor pods are ephemeral). Image: `SPARK_K8S_LAB_IMAGE` / `devsetu/spark-k8s-lab:v0.1`. Design: `SPARK_K8S_RUNTIME_SHAPE.md`.

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| spark-15 | Driver and Executor Pods on Kubernetes | orientation | L0 | Open (`finalized: true`, incomplete wrapper + Succeeded driver) |
| spark-16 | Namespace Quota Blocks the Submit | orientation | L0 | Open (`finalized: true`, ResourceQuota + hog / prod ns) |
| spark-17 | Wrong Image, Missing Dependency | multi-step-bug | L1 | Open (`finalized: true`, apache/spark → team image + pullSecrets) |
| spark-18 | Dynamic Allocation Without the Shuffle Service | multi-step-bug | L1 | Open (`finalized: true`, disable dyn-alloc pass path) |
| spark-19 | Driver OOMKilled — Spark Memory vs K8s Limits | multi-step-bug | L1 | Open (`finalized: true`, overhead + raised limit) |
| spark-20 | Multi-Fault K8s Submit | capstone | L2 | Open (`finalized: true`, ns → image → memory) |

### spark-15

`daemonMode: auto` — shell with SA `spark-lab`, kubectl, NetPol allowing API :443. Plants `~/lab/submit-store-rollup-k8s.sh` with `spark.executor.instances=0`. Learner sets 2×1×512m, submits cluster mode, optionally kills an executor, waits for Succeeded. Grade: wrapper + Succeeded `store-rollup-k8s-…` driver + Investigation. Cluster e2e: `solution/validate-cluster.sh`.

### spark-16

ResourceQuota `team-spark-quota` + `debug-memory-hog`. Sibling prod ns via `k8s_ensure_sibling`. Fix: delete hog or retarget submit to prod. Grade keeps quota object. Cluster e2e: `solution/validate-cluster.sh`.

### spark-17

Wrong image `apache/spark:3.5.3`; job uploads `store_join_team.py` (imports `quickbite_utils`). Correct: `$SPARK_K8S_IMAGE` + `pullSecrets=quickbite-registry-pull` (dummy secret planted). Requires image rebuild with `/opt/lab/python/quickbite_utils.py`.

### spark-18

`dynamicAllocation.enabled=true` without ESS. Graded fix: `enabled=false` + `spark.executor.instances≥2` (no DaemonSet on baseline PSA).

### spark-19

Driver `memory=512m` and `limit.memory=512m` with no overhead → OOMKilled. Fix: set `memoryOverhead` and raise limit ≥ heap + overhead.

### spark-20

Capstone: staging quota-blocked → switch to prod; team image + pullSecrets; executor overhead + raised limit. Grade Succeeded driver in prod.

## Chapters 4–6 — placeholders

The Spark Play shelf is a **chapter card grid** (`panel.chapters` in `playCatalog.ts`). Chapters 4–6 list planned lab titles as locked rows until packs exist. Optional pack stubs `spark-ch04`…`ch06` may still exist on disk but are not on the shelf.

Chapter 4 (Platform Automations) planned shelf rows (all placeholders until packs exist):

1. Infra-as-Code for the Cluster Shape
2. Automated Environment and Dependency Provision
3. Guardrail: Refuse the Bad Request
4. Detect Drift, Then Reconcile
5. Self-Service Job Request API
6. Auto-Tuner: Right-Size From the Physical Plan — write a program that checks allocated resources/params, validates the physical plan, and applies lasting right-size changes
7. Submit Through Livy Instead of SSH

Packs not built yet.

## Backlog pool

Shelf chapter `backlog` (“Backlog pool”) holds labs that are built (or partly built) but not in the active chapter sequence. Currently:

| Lab | Title | Notes |
| --- | --- | --- |
| spark-14 | DNS, Memory, and Disk Triple | Pulled out of Chapter 1; pack + setup/grade ready |

Adhoc (CSV bucket 7) is not on the shelf yet.
