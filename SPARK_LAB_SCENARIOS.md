# Spark Lab Scenarios — Design Specs

## SPARK ON YARN — Chapter 2 Additional Lab

### Lab spark-14-yarn (tentative numbering)
**Recommended placement:** Between spark-12 and spark-13  
**Difficulty:** L1 (multi-step-bug)  
**Title:** "The History Server Shows Nothing After a Successful Run"

#### SITUATION
The morning `store-rollup-history` job ran successfully according to the ResourceManager — FINISHED/SUCCEEDED status, no errors in the final AM log snippet visible through the RM web UI. But when the team opens the Spark History Server to review stage timings and executor metrics for capacity planning, the application is **not there**. The History Server UI is up and reachable, but it shows zero completed applications.

Platform operations wants this fixed as a **lasting platform capability**, not a one-off log export. The History Server should automatically show every finished YARN application without manual intervention.

#### PLANTED FAULTS
1. **YARN log aggregation is disabled** (`yarn.log-aggregation-enable=false` in `yarn-site.xml` on the RM).
2. **History Server is pointed at a local directory** (e.g., `file:///opt/spark/history`) instead of the HDFS aggregated-logs path.
3. **spark.eventLog.enabled=false** in the client's `spark-defaults.conf` (or missing entirely).

#### INVESTIGATION CHAIN (what the user needs to discover)
1. **Reproduce the gap:** Submit `store-rollup-history` → FINISHED. Open History Server UI → empty. Gap confirmed.
2. **Check Spark event log:** Is `spark.eventLog.enabled` true in the submit? Is `spark.eventLog.dir` pointing somewhere?
   - Learner finds `spark.eventLog.enabled=false` or missing in shell's `spark-defaults.conf`.
3. **Enable event logging and retry:** Set `spark.eventLog.enabled=true` and `spark.eventLog.dir=hdfs://ds-spark-01:9000/spark-logs` in `spark-defaults.conf`. Resubmit.
   - History Server **still** shows nothing.
4. **Check YARN log aggregation:** Is YARN actually aggregating logs to HDFS? Check `yarn.log-aggregation-enable` in RM's `yarn-site.xml`.
   - Learner finds it's `false`.
5. **Enable aggregation:** Set `yarn.log-aggregation-enable=true` in `yarn-site.xml`, restart RM (or refresh config if supported).
6. **Point History Server at aggregated location:** Update History Server config to read from `hdfs://ds-spark-01:9000/spark-logs` (or wherever event logs land). Restart History Server.
7. **Resubmit and verify:** Run `store-rollup-history` again → FINISHED. Open History Server → application appears with full stage/task breakdown.

#### TASKS (brief form for the pack)
1. Open the **Guide**. Reproduce the History Server gap.
2. Enable Spark event logging in the client config.
3. Enable YARN log aggregation on the cluster.
4. Point the History Server at the correct HDFS directory.
5. Restart necessary services and resubmit the probe.
6. Fill **Investigation** (what was missing in order: event logging, aggregation, history config), then Submit.

#### GRADING CHECKLIST
- `spark.eventLog.enabled=true` in shell's `spark-defaults.conf`.
- `spark.eventLog.dir` points to a valid HDFS path (e.g., `hdfs://ds-spark-01:9000/spark-logs`).
- `yarn.log-aggregation-enable=true` in RM's `yarn-site.xml`.
- History Server config points to the same HDFS path (check `spark.history.fs.logDirectory` in History Server's `spark-defaults.conf` or startup args).
- At least one `store-rollup-history` application visible in History Server UI (HTTP check or REST API `/api/v1/applications`).
- Investigation answers match the discovered sequence.

#### FORENSICS + FIX EMPHASIS
- **Forensics:** YARN application succeeded but no history. Check three config layers: Spark client (`spark-defaults.conf`), YARN cluster (`yarn-site.xml`), History Server process.
- **Fix:** Enable event logging at submit time, enable log aggregation at platform level, configure History Server to read the aggregated location.
- **Platform thinking:** This is not a per-job workaround (don't just download logs manually). The fix makes the History Server work for **all** future applications.

#### LEARNING OBJECTIVES
- Understand the Spark event log as the source of truth for the History Server.
- Understand YARN's log aggregation feature and how it moves container logs (including Spark event logs) to HDFS.
- Learn the three-part config chain: client → cluster → history server.
- Practice systematic troubleshooting when a downstream service (History Server) is missing data that an upstream service (RM) says exists.

---

## SPARK ON KUBERNETES — Chapter 3 Full Design (5-6 Labs)

### Lab spark-k8s-01
**Difficulty:** L0 (orientation)  
**Title:** "Driver and Executor Pods on Kubernetes"

#### SITUATION
You've been running Spark on standalone (Chapter 1) and YARN (Chapter 2). Now QuickBite's platform team is migrating to **Spark on Kubernetes**. The same `store-rollup` join job from earlier chapters needs to run on the new K8s cluster.

Your task: submit the job using `spark-submit` with `--master k8s://...`, then **trace every pod** the job creates. You need to know where the driver lives, where each executor lives, which nodes they landed on, and what happens when an executor pod is manually killed.

#### PLANTED SETUP
- K8s cluster already running (3 nodes, e.g., `k8s-node-01`, `k8s-node-02`, `k8s-node-03`).
- `quickbite-spark` namespace pre-created.
- Service account with RBAC permissions to create/list/delete pods in `quickbite-spark`.
- Spark 3.x image with the `store-rollup` jar and dependencies already baked in (or mounted via ConfigMap).
- A starter submit script `~/lab/submit-store-rollup-k8s.sh` with `--master k8s://https://<API_SERVER>` and `--deploy-mode cluster` pre-filled, but **executor count and resources commented out** for the learner to uncomment/configure.

#### TASKS
1. Open the **Guide**. Review the K8s cluster nodes and namespace.
2. Uncomment or set `--conf spark.executor.instances=2`, `spark.executor.memory=512m`, `spark.executor.cores=1` in the submit script.
3. Submit `store-rollup` in **cluster** deploy mode.
4. Use `kubectl get pods -n quickbite-spark` to list driver and executor pods.
5. Use `kubectl describe pod <driver-pod>` and `kubectl logs <driver-pod>` to see the Spark driver output.
6. Record which node each executor pod is on (`kubectl get pods -o wide`).
7. **Kill one executor pod** with `kubectl delete pod <executor-pod> -n quickbite-spark`.
8. Wait and observe a **replacement executor pod** appearing automatically (Spark's built-in pod retry).
9. Confirm the job completes successfully (SUCCEEDED status).
10. Fill **Investigation** (driver pod name, executor pod names, node placement, what happened after killing an executor), then Submit.

#### GRADING CHECKLIST
- At least one successful `store-rollup` run in `quickbite-spark` namespace (check K8s events or Spark driver logs for SUCCEEDED).
- Investigation answers: driver pod name matches the expected pattern (`<app-name>-<random>-driver`), executor pod names listed, node placement recorded, replacement executor behavior described.

#### LEARNING OBJECTIVES
- Understand Spark-on-K8s architecture: driver pod and executor pods are K8s native workloads.
- Learn `kubectl` commands to inspect Spark pods, logs, and events.
- Observe that executor pod loss is handled automatically by Spark (similar to Worker restart in Chapter 1, but now pod-based).
- Distinguish between `client` and `cluster` deploy mode in K8s context (driver pod vs. driver on submit client).

---

### Lab spark-k8s-02
**Difficulty:** L0 (orientation)  
**Title:** "Namespace Quota Blocks the Submit"

#### SITUATION
You submitted `store-rollup-quota` in cluster mode. The submit command returned successfully, but the job **never starts**. The driver pod stays in **Pending** state indefinitely. No executors appear. The Spark submit client doesn't error out—it's just waiting.

Platform notes say the `quickbite-spark` namespace has a **ResourceQuota** for memory and CPU. A leftover debug application `debug-memory-hog` is still running in the namespace and consuming most of the quota.

Your task: investigate why the driver pod can't schedule, find what's blocking it, and **free the quota** so the driver and executors can start. **Do not raise the cluster-wide quota** or delete the namespace's ResourceQuota object. The fix is operational—clean up the blocker or use the correct namespace.

#### PLANTED FAULTS
1. **Namespace ResourceQuota** (`quickbite-spark` namespace) with limits like `requests.memory: 4Gi, requests.cpu: 4` (total across all pods).
2. **Leftover debug app** (`debug-memory-hog` deployment or pod) running in `quickbite-spark`, consuming e.g., 3Gi memory and 3 CPU.
3. **Driver pod** requests 1Gi memory, 1 CPU → Pending because quota would be exceeded.
4. **Alternative namespace** mentioned in platform notes: `quickbite-spark-prod` (higher quota, or no quota, or empty).

#### TASKS
1. Open the **Guide**. Submit `store-rollup-quota` and observe Pending driver pod.
2. Use `kubectl describe pod <driver-pod> -n quickbite-spark` to see **Events** (likely: "exceeded quota").
3. Check the namespace ResourceQuota: `kubectl describe resourcequota -n quickbite-spark`.
4. List all pods in `quickbite-spark`: `kubectl get pods -n quickbite-spark -o wide`. Identify `debug-memory-hog`.
5. Check its resource requests: `kubectl describe pod debug-memory-hog -n quickbite-spark`.
6. **Option A (cleanup):** Delete the debug pod if platform notes say it's no longer needed: `kubectl delete pod debug-memory-hog -n quickbite-spark`.
7. **Option B (use prod namespace):** Re-submit `store-rollup-quota` to `--conf spark.kubernetes.namespace=quickbite-spark-prod`.
8. Verify the driver pod moves to **Running** and executors appear.
9. Confirm the job completes successfully.
10. Fill **Investigation** (quota blocked, blocker identified, fix chosen), then Submit.

#### GRADING CHECKLIST
- Driver pod for `store-rollup-quota` in Running or Completed state (not Pending).
- Job finishes successfully (Spark SUCCEEDED status).
- Investigation answers: identified ResourceQuota as blocker, named the debug pod, chose cleanup or namespace switch.
- `debug-memory-hog` pod deleted **OR** new submission uses `quickbite-spark-prod` namespace.

#### LEARNING OBJECTIVES
- Understand K8s ResourceQuotas and how they block pod scheduling.
- Learn to inspect pod Events and describe ResourceQuota objects.
- Practice operational cleanup vs. namespace isolation as quota management strategies.
- Recognize that Spark-on-K8s is subject to K8s-native resource constraints (quotas, limits, node capacity).

---

### Lab spark-k8s-03
**Difficulty:** L1 (multi-step-bug)  
**Title:** "Wrong Image, Missing Dependency"

#### SITUATION
The morning `store-rollup-deps` job is failing. The driver pod starts successfully, but **all executor pods crashloop** with `ClassNotFoundException: org.example.quickbite.StoreRollup` in the logs. The same job ran fine on standalone and YARN because the cluster-wide `$SPARK_HOME/jars` directory included the team's custom libraries.

On Kubernetes, **the image is the environment**. The current submit script is using the base Spark image (`spark:3.5.0`), which only contains Apache Spark JARs—no QuickBite-specific dependencies.

Platform notes mention a team image: `quickbite-registry.internal/spark-quickbite:v2.1` with all dependencies baked in. But there's a second catch: the service account running the job doesn't have permission to pull from the private registry yet.

Your task: update the submit script to use the correct image, fix RBAC/ImagePullSecrets if needed, and prove the job runs to completion.

#### PLANTED FAULTS
1. **Submit script** uses `--conf spark.kubernetes.container.image=spark:3.5.0` (base image, no team deps).
2. **Correct image** is `quickbite-registry.internal/spark-quickbite:v2.1` (includes `StoreRollup` class and dependencies).
3. **ImagePullSecret** not attached to the Spark service account, or not created in the namespace → `ImagePullBackOff` when learner tries the private image initially.
4. **Platform notes** include a pre-created secret `quickbite-registry-pull` in the namespace, and instructions to attach it to the service account or use `--conf spark.kubernetes.container.image.pullSecrets=quickbite-registry-pull`.

#### TASKS
1. Open the **Guide**. Submit `store-rollup-deps` and observe executor crashloop.
2. Check executor pod logs: `kubectl logs <executor-pod> -n quickbite-spark`. Find `ClassNotFoundException`.
3. Inspect the current image in the submit script: `spark:3.5.0` (base image).
4. Read platform notes: correct image is `quickbite-registry.internal/spark-quickbite:v2.1`.
5. Update the submit script: `--conf spark.kubernetes.container.image=quickbite-registry.internal/spark-quickbite:v2.1`.
6. Resubmit → observe `ImagePullBackOff` on executor pods.
7. Check pod Events: `kubectl describe pod <executor-pod>` → "failed to pull image" or "authentication required".
8. Read platform notes again: use `quickbite-registry-pull` secret.
9. Add `--conf spark.kubernetes.container.image.pullSecrets=quickbite-registry-pull` to the submit script.
10. Resubmit → executors pull the image successfully, job runs to completion.
11. Fill **Investigation** (base image missing deps, private image needs pull secret, both fixed), then Submit.

#### GRADING CHECKLIST
- Submit script uses `quickbite-registry.internal/spark-quickbite:v2.1` image.
- Submit script includes `spark.kubernetes.container.image.pullSecrets=quickbite-registry-pull` (or service account patched with imagePullSecrets).
- Job completes successfully (SUCCEEDED).
- Investigation answers: identified ClassNotFoundException, switched image, resolved ImagePullBackOff.

#### LEARNING OBJECTIVES
- Understand that **on Kubernetes, the image is the runtime environment** (no shared `$SPARK_HOME/jars` directory).
- Learn to diagnose `ClassNotFoundException` by checking executor logs.
- Practice handling private container registries with ImagePullSecrets.
- Recognize the two-step failure: missing dependency → wrong image → image pull auth.

---

### Lab spark-k8s-04
**Difficulty:** L1 (multi-step-bug)  
**Title:** "Dynamic Allocation Without the Shuffle Service"

#### SITUATION
Your team enabled **Dynamic Allocation** for `store-rollup-dynamic` to save resources when the job is idle. The job starts fine with 2 executors, runs the first few stages successfully, then **fails** during a shuffle-heavy stage with errors like:

```
FetchFailedException: Failed to fetch shuffle block
org.apache.spark.shuffle.FetchFailedException: Connection refused
```

The driver logs show executors were **scaled down** to 1 (because earlier stages were light), then the remaining executor couldn't fetch shuffle data from the now-dead executor.

**Root cause:** Spark Dynamic Allocation on Kubernetes requires an **External Shuffle Service** to retain shuffle data after executors are removed. Without it, shuffle blocks are lost when executor pods are deleted.

Platform notes offer two paths:
1. **Deploy the Shuffle Service** as a DaemonSet on all K8s nodes (platform-level fix).
2. **Disable Dynamic Allocation** for this job and use a static executor count (app-level workaround).

Your task: choose and implement one fix, then prove the job completes successfully without shuffle fetch failures.

#### PLANTED FAULTS
1. **`spark.dynamicAllocation.enabled=true`** in the submit script or `spark-defaults.conf`.
2. **No External Shuffle Service** running in the K8s cluster (no DaemonSet, no `spark-shuffle-service` pods).
3. **Job with shuffle stage** (e.g., `groupByKey` or `join` with repartition) that triggers fetch after scale-down.

#### TASKS
1. Open the **Guide**. Submit `store-rollup-dynamic` and observe it fail at shuffle stage.
2. Check driver logs: `kubectl logs <driver-pod> -n quickbite-spark` → `FetchFailedException`.
3. Check executor count over time: `kubectl get pods -n quickbite-spark --watch` → executors scale down from 2 to 1.
4. Read platform notes: Dynamic Allocation needs External Shuffle Service, or disable dynamic allocation.
5. **Option A (Platform fix):** Deploy the External Shuffle Service DaemonSet (YAML provided in notes). Verify shuffle service pods run on all nodes. Resubmit job.
6. **Option B (App workaround):** Set `spark.dynamicAllocation.enabled=false` and `spark.executor.instances=2` in the submit script. Resubmit.
7. Verify the job completes without fetch failures.
8. Fill **Investigation** (dynamic allocation caused executor removal, shuffle service missing or disabled dynamic allocation), then Submit.

#### GRADING CHECKLIST
- Job completes successfully (SUCCEEDED, no FetchFailedException in driver logs).
- **Either:**
  - External Shuffle Service DaemonSet is running (check `kubectl get daemonset -n kube-system` or `quickbite-spark` namespace), **and** `spark.dynamicAllocation.enabled=true` still set.
  - **Or:** `spark.dynamicAllocation.enabled=false` in the submit script, `spark.executor.instances` set to a static value ≥2.
- Investigation answers: identified dynamic allocation + missing shuffle service, chose and applied a fix.

#### LEARNING OBJECTIVES
- Understand the relationship between Dynamic Allocation and the External Shuffle Service.
- Learn to diagnose shuffle fetch failures from driver logs.
- Practice platform-level decision-making: deploy a cluster-wide service vs. app-level workaround.
- Recognize that K8s requires explicit DaemonSet deployment for Spark shuffle service (unlike YARN's built-in NodeManager shuffle handler).

---

### Lab spark-k8s-05
**Difficulty:** L1 (multi-step-bug)  
**Title:** "Driver OOMKilled, Spark Memory vs. K8s Limits"

#### SITUATION
The `store-rollup-driver-mem` job starts, begins processing, then the **driver pod suddenly restarts** after a few minutes. The job fails. Checking `kubectl describe pod <driver-pod>`, you see:

```
Last State: Terminated
  Reason: OOMKilled
  Exit Code: 137
```

The driver was **killed by Kubernetes for exceeding its memory limit**. But the Spark submit script sets `spark.driver.memory=1g`, and the K8s pod spec has `resources.limits.memory=1Gi`. They match, so what's the problem?

**Root cause:** Spark JVM heap (`spark.driver.memory`) is only **part** of the container's total memory usage. The container also uses:
- Off-heap memory (direct buffers, native libraries)
- Python/PySpark overhead (if using PySpark)
- OS-level buffers

Spark's `spark.driver.memoryOverhead` defaults to 10% of heap (or 384 MiB, whichever is higher). If the K8s memory **limit** is set exactly equal to `spark.driver.memory`, the total usage (heap + overhead) exceeds the limit → OOMKilled.

Your task: align Spark's memory config with K8s resource limits, accounting for overhead, and resubmit successfully.

#### PLANTED FAULTS
1. **Submit script:**
   - `spark.driver.memory=1g`
   - `spark.kubernetes.driver.limit.memory=1Gi` (or pod template with `resources.limits.memory: 1Gi`)
2. **No `spark.driver.memoryOverhead` set** → defaults to ~384 MiB.
3. **Total needed:** 1024 MiB (heap) + 384 MiB (overhead) = ~1408 MiB, but K8s limit is 1024 MiB → OOMKilled.

#### TASKS
1. Open the **Guide**. Submit `store-rollup-driver-mem` and observe driver pod restart.
2. Check pod status: `kubectl describe pod <driver-pod> -n quickbite-spark` → Last State: `OOMKilled`.
3. Check Spark config in submit script: `spark.driver.memory=1g`, K8s limit `1Gi`.
4. Read platform notes: Spark memory = heap only. Container memory = heap + overhead. Overhead defaults to 10% of heap or 384 MiB.
5. Calculate required limit: 1g heap + overhead (let's set `spark.driver.memoryOverhead=512m` to be safe) = 1536 MiB total.
6. Update submit script:
   - `spark.driver.memory=1g`
   - `spark.driver.memoryOverhead=512m`
   - `spark.kubernetes.driver.limit.memory=1536Mi`
7. Resubmit → driver pod stays Running, job completes.
8. Fill **Investigation** (OOMKilled, Spark heap vs. container limit mismatch, overhead added), then Submit.

#### GRADING CHECKLIST
- Job completes successfully (SUCCEEDED, driver pod not OOMKilled).
- `spark.driver.memoryOverhead` is explicitly set (≥384m, recommended ≥512m for safety).
- `spark.kubernetes.driver.limit.memory` is greater than `spark.driver.memory` (by at least the overhead amount).
- Investigation answers: identified OOMKilled, explained heap vs. total memory, set overhead and adjusted limit.

#### LEARNING OBJECTIVES
- Understand the difference between Spark JVM heap (`spark.driver.memory`) and container total memory usage.
- Learn about `spark.driver.memoryOverhead` and `spark.executor.memoryOverhead`.
- Practice aligning Spark memory config with Kubernetes resource requests and limits.
- Diagnose OOMKilled pods using `kubectl describe` and container exit codes.

---

### Lab spark-k8s-06
**Difficulty:** L2 (capstone)  
**Title:** "Multi-Fault K8s Submit: Namespace, Image, and Memory"

#### SITUATION
The morning `store-rollup-k8s-capstone` job is down. Platform oncall says it **never started** after yesterday's cluster maintenance. The submit script was updated by another team member during the downtime, but something is wrong.

**Setup planted three faults at once:**

1. **Wrong namespace:** Submit script targets `quickbite-spark-staging`, but the service account and ImagePullSecret are in `quickbite-spark-prod`.
2. **Old image tag:** Image is `quickbite-registry.internal/spark-quickbite:v2.0`, but the team upgraded dependencies yesterday to `v2.1`. Executors crashloop with `NoSuchMethodError` or `ClassNotFoundException` for the new API.
3. **Executor memory under-spec'd:** `spark.executor.memory=256m` with no overhead set → executors get OOMKilled during shuffle write.

**Your task:** Peel the onion. Fix the namespace so the driver can start. Fix the image so executors can run the code. Fix the memory so executors survive the shuffle. Prove the job runs to completion.

#### TASKS
1. Open the **Guide**. Read the layered failure description.
2. Submit `store-rollup-k8s-capstone` → driver pod Pending.
3. **Layer 1 (Namespace):** Check pod Events → ImagePullBackOff because `quickbite-registry-pull` secret not in `quickbite-spark-staging`. Platform notes say production service account is in `quickbite-spark-prod`. Update submit script namespace. Resubmit.
4. **Layer 2 (Image):** Executors start but crashloop with `NoSuchMethodError` or missing class. Platform notes say upgrade to `v2.1`. Update submit script image tag. Resubmit.
5. **Layer 3 (Memory):** Executors run, shuffle starts, then executors get OOMKilled. Check `kubectl describe pod` → `OOMKilled`. Add `spark.executor.memoryOverhead=256m` and raise `spark.kubernetes.executor.limit.memory` to 512Mi. Resubmit.
6. Verify job completes successfully.
7. Fill **Investigation** (which layer was first/second/third, what fixed each), then Submit.

#### GRADING CHECKLIST
- Submit script uses `quickbite-spark-prod` namespace (or correct namespace per notes).
- Submit script uses `quickbite-registry.internal/spark-quickbite:v2.1` image.
- `spark.executor.memoryOverhead` is set (≥256m).
- `spark.kubernetes.executor.limit.memory` is greater than `spark.executor.memory` (by at least overhead).
- Job completes successfully (SUCCEEDED).
- Investigation answers: identified namespace → image → memory in order, explained each fix.

#### LEARNING OBJECTIVES
- Synthesize all Chapter 3 concepts: namespace/quota, image/dependencies, memory overhead.
- Practice layered incident troubleshooting (fixing one fault reveals the next).
- Demonstrate platform engineering judgment: don't guess, investigate each layer systematically.
- Prove mastery of Spark-on-K8s config: namespace, image, RBAC, resource limits, memory overhead.

---

## Summary of Lab Counts

### YARN Chapter 2 (with proposed addition)
- **Current:** 5 labs (spark-09 to spark-13)
- **Proposed addition:** 1 lab (Log Aggregation & History Server)
- **New total:** 6 labs (good arc: orientation → incidents → platform engineering)

### Kubernetes Chapter 3 (full design)
- **Proposed:** 6 labs
  - 2 orientation (L0): Driver/executor pods, Namespace quota
  - 3 multi-step-bug (L1): Image/deps, Dynamic allocation, Memory limits
  - 1 capstone (L2): Multi-fault (namespace + image + memory)
- **Fits the pattern** from Chapters 1 & 2: gentle start → incident investigation → platform decisions → capstone

---

## Design Principles Applied

1. **Not too easy:** Only the first lab in each chapter is pure orientation. All others require investigation + fixing + remediation.
2. **Investigation + Forensics:** Every lab includes a "what did you look at first" and "what was the root cause" investigation section.
3. **Fixing & Remediating:** No lab ends at investigation alone. All require the learner to apply a lasting fix, not a one-off workaround.
4. **Platform Engineering Emphasis:** Labs emphasize durable platform solutions (enable aggregation for all apps, deploy shuffle service cluster-wide, align memory configs as policy).
5. **Realistic Scenarios:** Based on real-world Spark-on-K8s pain points (OOMKilled pods, ImagePullBackOff, missing shuffle service, quota exhaustion).
6. **Progressive Difficulty:** Each chapter follows the arc: L0 → L0 → L1 → L1 → L1 → L2 (or similar), building from orientation to capstone.

---

**Next Steps for Implementation:**
- User will delegate these scenarios to another agent/model for full pack creation (setup.sh, grade.sh, GUIDE.md, etc.).
- These scenarios provide the **theme, situation, tasks, and grading intent** without implementation details.
- Each scenario is self-contained enough to hand off as a spec.
