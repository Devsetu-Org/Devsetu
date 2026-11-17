# Spark on Kubernetes — Runtime Shape Design

**Status:** design lock needed before Chapter 3 packs  
**Goal:** One reusable shape that can run all Chapter 3 labs (orientation → quota → image → shuffle → memory → capstone) without reinventing the cluster each time.

---

## 1. Recommendation (short)

| Decision | Choice |
| --- | --- |
| Shape id | **`spark-k8s`** (alongside `spark-2`, `yarn-2`) |
| Where Spark runs | **In-cluster** on the real EKS API, inside the learner namespace `sp-<user>` |
| Nested k3s / kind | **No** for production labs (optional later for laptop `validate-local` only) |
| Procured hosts | **None** like `ds-spark-01` — only a **submit shell** plus ephemeral driver/executor pods |
| Image | **`devsetu/spark-k8s-lab:v0.1`** (Spark 3.5.x + kubectl + `/opt/lab` jobs/data) |
| Pool | Same **`devlabs.io/pool=spark`** as Chapters 1–2 |

**Why in-cluster, not nested k3s:** Chapter 3 is about Spark talking to Kubernetes (pods, quotas, images, OOMKilled). Nested k3s burns RAM, breaks NetPol/DNS twice, and teaches a toy API. In-cluster is what platform teams actually run: `spark-submit --master k8s://…` into a shared cluster, scoped to one namespace.

---

## 2. How this differs from existing shapes

| | `spark-2` | `yarn-2` | **`spark-k8s`** |
| --- | --- | --- | --- |
| Illusion | Bare-metal Master/Workers | RM + NodeManagers | Kubernetes as the resource manager |
| Fixed pods | `ds-spark-01..03` + `shell` | RM + 2 NMs + `shell` | **`shell` only** (plus RBAC objects) |
| Workloads | Spark daemons on fixed pods | YARN daemons on fixed pods | **Driver + executor pods** created by Spark |
| Learner SSH targets | shell / master / workers | shell / RM / NMs | **shell only** (kubectl into driver/executors) |
| Token on shell | Off (`automountServiceAccountToken: false`) | Off | **On** — shell must call the API |
| Diagram | Host boxes | Host boxes | Shell + API + ephemeral Spark pods |

Chapter continuity: same Spark job (`store_join` / store-rollup), same QuickBite story, new resource manager — mirrors the YARN chapter jump.

---

## 3. Topology (what the learner sees)

```
┌─────────────────────────────────────────────────────────────┐
│  Namespace: sp-<user>   (fiction: "quickbite-spark")        │
│                                                             │
│   ┌──────────────┐      spark-submit --master k8s://…       │
│   │ shell        │ ─────────────────────────────────────┐   │
│   │ spark-submit │                                      │   │
│   │ kubectl      │                                      ▼   │
│   └──────────────┘                              Kubernetes   │
│                                                 API (EKS)    │
│                                      creates / watches       │
│                           ┌──────────────┐  ┌─────────────┐ │
│                           │ *-driver     │  │ *-exec-1..N │ │
│                           │ (AM / driver)│  │ (executors) │ │
│                           └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Learner-facing names**

- Env `SPARK_K8S_NS` = real namespace (`sp-<user>`).  
- Guides / notes may say team namespace **`quickbite-spark`** as the *role* name, but every command uses `$SPARK_K8S_NS` so grading stays deterministic.  
- Do **not** create a second real namespace named `quickbite-spark` (collides across users).

**Multi-namespace labs (quota / capstone)**

- At provision time, shape may also create a **sibling** namespace `sp-<user>-prod` (or `-staging`) with the same Spark RoleBindings + optional different ResourceQuota.  
- Env: `SPARK_K8S_NS` (default team ns), `SPARK_K8S_NS_PROD` (sibling).  
- Lab scripts and graders only ever touch these two namespaces.  
- If sibling creation is too heavy for v1, Lab 2 can stay single-ns (delete hog in place); capstone gets siblings in a follow-up.

---

## 4. Pods and objects the shape creates

### Always (every `spark-k8s` lab)

1. **Namespace** `sp-<user>` (already ensured by sparkBox) — extend labels/NetPol for API access (below).  
2. **ServiceAccount** `spark-lab` — used by `shell` and by Spark driver/executors (`spark.kubernetes.authenticate.driver.serviceAccountName`).  
3. **Role + RoleBinding** (namespaced) — enough for Spark-on-K8s + learner kubectl forensics (see §5).  
4. **Optional ClusterRoleBinding (read nodes)** — so `kubectl get nodes` works for Lab 1 placement forensics (same idea as DevOps learner storage/nodes read). Scope carefully; prefer a shared ClusterRole + per-ns binding labeled for cleanup.  
5. **Pod `shell`**
   - Image: `SPARK_K8S_LAB_IMAGE` / `devsetu/spark-k8s-lab:v0.1`
   - `serviceAccountName: spark-lab`
   - `automountServiceAccountToken: true`
   - `command: sleep infinity`
   - Resources: ~256Mi–512Mi request (cluster-mode submit is light)
   - Headless Service `shell` (keep pattern; harmless)
6. **Config in shell** (setup or image):
   - `KUBECONFIG` from in-cluster config (or written kubeconfig using SA token)
   - `SPARK_K8S_NS`, `SPARK_K8S_MASTER=k8s://https://kubernetes.default.svc:443`
   - Default `spark-defaults` snippets for namespace + SA + container image (lab may override)

### Not created by the shape

- No `ds-spark-01` / Workers / RM / NM.  
- Driver/executor pods are **created by the learner’s `spark-submit`** (or by setup when planting a failed run).

### Cleanup (critical)

Today `deleteCluster` only deletes `app=spark-lab`. Spark driver/executor pods **won’t** carry that label.

**Required:** on lab end / recreate:

1. Delete all pods in `SPARK_K8S_NS` (and sibling ns if any) **or** delete by label `spark-role in (driver,executor)` plus any leftover Spark services/configmaps.  
2. Then delete shape-owned `app=spark-lab` objects.  
3. Do **not** delete the namespace itself (same as today).

---

## 5. RBAC (minimum)

Spark’s driver SA must be able to create executor pods and a driver service. Learner on `shell` uses the same SA for kubectl.

**Role rules (namespaced) — starting set:**

| Resources | Verbs |
| --- | --- |
| pods, pods/log, pods/status | get, list, watch, create, delete, patch, update |
| services | get, list, watch, create, delete, patch, update |
| configmaps | get, list, watch, create, delete, patch, update |
| secrets | get, list, watch (create only if labs need pull-secret planting via learner — prefer setup-only create) |
| events | get, list, watch |
| resourcequotas, limitranges | get, list, watch |
| serviceaccounts | get, list (driver may need to resolve SA) |

**Not granted:** namespace delete, role bind/escalate, cluster-scoped writes, other users’ namespaces.

**Nodes (Lab 1):** read-only via ClusterRole `get/list/watch` on `nodes`, bound only for `spark-lab` in that ns (mirrors DevOps pattern).

Setup/grader keep using **controller kubectl** from the backend (unchanged) — learners cannot edit grade scripts.

---

## 6. NetworkPolicy (must change for `spark-k8s`)

Current spark NetPol: egress only to same-ns pods + kube-dns. That **blocks the Kubernetes API** and can block registry-related sidecar patterns.

For `spark-k8s` namespace policy:

| Egress | Why |
| --- | --- |
| Same-namespace pods | Driver ↔ executors |
| kube-dns | DNS |
| **Kubernetes API** (kube-system / default `kubernetes` Service CIDR / labeled apiserver) | `kubectl` + Spark scheduler backend |
| Optional: platform registry CIDR / HTTPS egress if labs pull from a private registry **from inside pods** (usually kubelet pulls — often no pod egress needed for images) |

Ingress: same-ns only (unchanged).  
UI proxy / terminal: still controller-side exec; no learner NetPol hole required for that.

Standalone/YARN shapes keep the **strict** NetPol (no API) so Chapters 1–2 don’t suddenly get kubectl.

---

## 7. Image: `devsetu/spark-k8s-lab`

Bake once (like `spark-yarn-lab`):

- Spark 3.5.x (Kubernetes support built-in)
- JDK
- **kubectl** (pinned version compatible with cluster)
- Python 3 for PySpark jobs (reuse `/opt/lab/jobs/store_join.py` + CSVs)
- Tiny editor story (vim/busybox) consistent with other spark images
- No Hadoop/YARN required (keeps image smaller than yarn-lab)

Env override: `SPARK_K8S_LAB_IMAGE=devsetu/spark-k8s-lab:v0.1`

Driver/executor **container image** for submits: same image by default (`spark.kubernetes.container.image=…`). Labs that teach “wrong image” point at a second tag or a slim base image also pre-pulled onto the spark pool (or a public `apache/spark` tag already cached).

---

## 8. Provision flow (`sparkBox.recreate`)

```
shape === 'spark-k8s'
  → boot: "Creating your Kubernetes Spark namespace"
  → ensure ns + NetPol (API egress variant) + SA/Role/RoleBinding (+ node read binding)
  → delete previous spark workloads in ns (drivers/executors) + lab pods
  → apply shell pod
  → wait Ready on shell only
  → boot: "Preparing the lab" → setup.sh
```

`scriptEnv` additions:

- `SPARK_POD=shell`
- `SPARK_K8S_NS=<ns>`
- `SPARK_K8S_MASTER=k8s://https://kubernetes.default.svc:443`
- `SPARK_K8S_IMAGE=<lab image>`
- `SPARK_K8S_SA=spark-lab`
- Drop or ignore `SPARK_MASTER` / YARN_* for this shape (lab.sh should not require standalone master URL when shape is k8s).

Terminal: **shell only** (no host switcher to ds-spark-* ). Diagram: shell + “Kubernetes” + “Spark apps (pods)”.

---

## 9. Capacity / sizing

Rough budget per open lab (cluster mode, 2×512m executors + driver ~1g):

| Component | Memory order |
| --- | --- |
| shell | ~256–512 Mi |
| driver pod | ~1–1.5 Gi (heap + overhead) |
| 2 executors | ~2× (512m + overhead) |

Spark pool nodes must absorb **shell + dynamic pods**. Lab 2 ResourceQuota will intentionally be tight — that’s the lesson, not a platform outage.

`reservePods` / capacity checks: count shell + expected headroom (e.g. reserve for 1 driver + 2 executors) so opens fail closed when the pool is exhausted.

---

## 10. Mapping Chapter 3 labs → shape features

| Lab | Extra plants on top of `spark-k8s` |
| --- | --- |
| 1 Driver & executor pods | Incomplete submit wrapper; learner fills instances/memory; kill one executor |
| 2 Namespace quota | ResourceQuota + `debug-memory-hog` Deployment; optional sibling ns |
| 3 Wrong image / deps | Bad image in wrapper; notes + pull secret; good team image tag preloaded |
| 4 Dynamic allocation / shuffle | Dyn alloc on; no shuffle DaemonSet (or broken); shuffle-heavy job |
| 5 Driver OOMKilled | `limit.memory` == heap, no overhead |
| 6 Capstone | Wrong ns + old image + low executor memory (siblings + secrets) |

All share the same shape; only `setup.sh` / quota / secrets differ.

---

## 11. Local e2e (`validate-local.sh`)

Production path ≠ laptop path:

| Environment | Runtime |
| --- | --- |
| EKS lab | `spark-k8s` shape as above |
| Laptop validate | **kind** or **k3d** cluster + same image + apply SA/Role + run setup/grade |

Do not require nested k3s inside the EKS shell. Optional later: a docker-compose “fake” that only checks script parsing — insufficient for Lab 1 kill/replace.

---

## 12. Frontend / pack contract

- `platformSpec.shape: "spark-k8s"`
- `sandboxType: "spark"` (keep Spark shelf + `K8sLabWorkspace`)
- Boot phases e.g. `Creating your Kubernetes Spark namespace` → `Pulling the Spark-on-K8s image` → `Preparing the lab`
- Cluster diagram: new layout (no Master/RM host strip)
- Investigation wizard: per-lab fields (as with YARN)
- Editor tab: same as K8s labs (file editor into shell home) — useful once wrappers live in `~/lab/`

---

## 13. Locked decisions (2026-11-13)

1. **Sibling namespaces:** only when a lab needs them (not every `spark-k8s` open).  
2. **Node forensics:** `kubectl get pods -o wide` only — **no** `kubectl get nodes` / node ClusterRole for now.  
3. **Shuffle lab:** grade **disable dynamic allocation** (or static `spark.executor.instances`) as the reliable pass path. Guide may mention External Shuffle Service as the platform ideal; do **not** require a hostPath/privileged DaemonSet on baseline PSA.  
4. **Image / pull-secret lab:** wrong image = public `apache/spark` (missing team module); correct = `devsetu/spark-k8s-lab`. Require `spark.kubernetes.container.image.pullSecrets` as **platform policy** on the team image (secret pre-planted by setup). Skip a real private-registry auth failure unless we add an in-ns registry later.  
5. **Shape name:** **`spark-k8s`**.

---

## 14. Implementation order (after lock)

1. Image `images/spark-k8s-lab` + build tag  
2. `sparkBox.ts`: shape `spark-k8s`, SA/RBAC, NetPol variant, shell-only recreate, cleanup of Spark workloads  
3. `lab.sh` helpers: `in_shell`, kubectl wrappers, wait for driver/exec, app success checks  
4. `k8sLifecycle` allow shape; frontend boot/diagram  
5. Lab 1 pack end-to-end  
6. Labs 2…n  

---

## 15. Non-goals

- Reusing DevOps `ns-<user>` sandboxType for Spark Chapter 3 (different shelf, pool, and isolation story)  
- Spark Operator / CRDs in Chapter 3 (that belongs more to Platform Automations controller lab)  
- Giving learners cluster-admin or the ability to break other tenants’ namespaces  
