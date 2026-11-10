# Spark track — Platforms Engineer

Platforms Engineer, Spark panel. Packs live in `backend/challenges/packs/spark-*.json` and are listed on the Spark shelf in `frontend/src/constants/playCatalog.ts`.

Curriculum design: `docs/spark-curriculum-draft.csv`.

Runtime: `sandboxType: spark` → `workspace/sparkBox.ts` in namespace `sp-<user>`. Pods select and tolerate `devlabs.io/pool=spark` (`./deploy/eks/eks-spark.sh`). The shelf lists packs whether or not that pool is up; Start refuses when the pool has no Ready node. Open labs are `finalized: true` with setup + grade; the rest stay `finalized: false` until those land. YARN labs (`yarn-2`) use ResourceManager / NodeManager boot steps, not Master / Workers. Shared YARN helpers live in `backend/challenges/spark/_lib/lab.sh` (`yarn_bootstrap`, capacity queues, jps-based daemon checks).

## Chapter 1 — Foundations of a Spark Cluster

Shape: `spark-2` (master + two workers).

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| spark-01 | Stand Up the Cluster and Find Everything on Disk | orientation | L0 | Open (`finalized: true`, setup + grade) |
| spark-02 | Stabilize Flaky Workers on the Master UI | orientation | L0 | Open (`finalized: true`, kill + stretched timeout plant + grade) |
| spark-03 | Trace a Job From Submission to Last Task | orientation | L0 | Open (`finalized: true`, warm cluster + join seed + grade) |
| spark-04 | Find Where the Data Actually Lives | multi-step-bug | L1 | Pack + Investigation only |
| spark-05 | The Executor Memory Map | orientation | L0 | Pack + Investigation only |
| spark-06 | Diagnose an Executor Lost to Memory Pressure | multi-step-bug | L1 | Pack + Investigation only |
| spark-07 | The Capstone Bug: Slow, Then Dead | capstone | L2 | Pack + Investigation only |
| spark-08 | Drain a Worker Without Breaking Anything | drain | L2 | Pack + Investigation only |

### spark-01

`daemonMode: manual` — procured hosts `ds-spark-01`…`03` with Spark installed (not a running Master/Worker). Boot stepper: Planning → Procuring nodes → Installing Spark → Preparing the lab. Setup seeds `conf/` / `logs/` / `work/`, clears `~/answers`. Bring-up steps are in the Guide tab (`problemStatement.guide`). Learner starts Master on `ds-spark-01`, Workers on `02`/`03`. Grade checks ALIVE workers + processes + Investigation paths. Terminal `?node=` opens a shell on that host.

### spark-02

`daemonMode: manual` — setup seeds conf, starts Master + both Workers, then plants two faults on `ds-spark-02`: (1) **kills** the Worker JVM so the Master shows DEAD / missing; (2) rewrites that host’s `spark.worker.timeout` to **600** while the Master keeps **30**. A bare `start-worker` registers (ALIVE) then flaps DEAD because the Worker heartbeats only every `timeout/4`. Lasting fix: set Worker `spark.worker.timeout` back to **30** and restart. Boot stepper is lab-specific (`platformSpec.boot`): Pulling the Spark image → Starting the master → Starting the workers → Preparing the lab. Grade checks conf, waits past the Master timeout to prove ALIVE sticks, and grades Investigation.

### spark-03

`daemonMode: manual` — same warm-cluster boot as spark-02 (seed conf, start Master + Workers, wait for 2 ALIVE), then seeds three jobs + CSVs on `shell` / Workers under `/opt/spark/lab/`: **Part 1** `orders_narrow.py` (narrow transforms, 0 shuffles / 1 stage), **Part 2** `orders_by_store.py` (one `groupBy` shuffle / 2 stages), **Part 3** `store_rollup_join.py` (join + aggregate, multiple shuffles / ≥3 stages). No fault plant. Learner submits each in **client** mode from the shell, traces Master → Application UI (`shell:4040`), and on Part 3 follows one task to an executor/host. Drivers hold open briefly so the Application UI stays readable. Grade checks three distinct `app-…` ids, stage/shuffle counts, and Investigation.

## Chapter 2 — Spark on YARN

Shape: `yarn-2` (ResourceManager on `ds-spark-01` + NodeManagers on `02`/`03` + shell). Image: `SPARK_YARN_LAB_IMAGE` / `devsetu/spark-yarn-lab:v0.1` (`images/spark-yarn-lab`).

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| spark-09 | Submit the Same Workload on YARN | orientation | L0 | Open (`finalized: true`) |
| spark-10 | Read the RM and NM as Instruments | orientation | L0 | Open (`finalized: true`) |
| spark-11 | Land in the Right Capacity Queue | multi-step-bug | L1 | Open (`finalized: true`) |
| spark-12 | Client Mode Driver Is on the Wrong Host | multi-step-bug | L1 | Open (`finalized: true`) |
| spark-13 | Someone Else's Job Changed Yesterday | multi-step-bug | L2 | Open (`finalized: true`) |

### spark-09

Setup starts RM + both NMs (`yarn_bootstrap`), seeds `~/answers`. Guide teaches client then cluster `spark-submit --master yarn` of `local:/opt/lab/jobs/store_join.py`. Investigation records driver host + RM/NM facts for both runs.

### spark-10

Setup bootstraps YARN and plants a finished `store-rollup-probe` app. Learner reads RM/NM panels (active nodes, available MB, app id/state, container NM host) and cross-checks with `yarn logs` / node local dirs. Investigation treats the UI as a claim.

### spark-11

Multi-queue capacity scheduler (`default` tight, `production` fat, `adhoc` spare). Setup plants `store-rollup-stuck` **Accepted** in `default`. Learner submits into `production` without raising default capacity.

### spark-12

Setup starts a client-mode driver on `shell`, kills it mid-job, leaves the failed app. Learner resubmits `--deploy-mode cluster` so the driver is an AM on a NodeManager.

### spark-13

Setup fills `production` with `team-b-backfill` and leaves `store-rollup-yesterday` **Accepted**. Ticket forbids killing the backfill AM; learner uses `adhoc` (or frees capacity without unauthorized AM kill).

## Chapters 3–6 — placeholders

The Spark Play shelf is a **chapter card grid** (`panel.chapters` in `playCatalog.ts`). Chapters 3–6 list planned lab titles as locked rows until packs exist. Optional pack stubs `spark-ch03`…`ch06` may still exist on disk but are not on the shelf.

Adhoc (CSV bucket 7) is not on the shelf yet.
