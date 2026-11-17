# Kubernetes Platform track — Platforms Engineer

Platforms Engineer, Kubernetes panel. Packs live in `backend/challenges/packs/k8s-platform-*.json` and are listed on the Kubernetes (Platform) shelf in `frontend/src/constants/playCatalog.ts`.

Curriculum design: `K8S_PLATFORM_CURRICULUM.md` (CKA-aligned).

Runtime: `sandboxType: k8s-platform` → `workspace/k8sPlatformBox.ts` in namespace `kp-<user>`. Pods select and tolerate `devlabs.io/pool=k8s-platform`. Image: `KUBEADM_LAB_IMAGE` / `devsetu/kubeadm-lab:v0.1`. Helpers: `backend/challenges/k8s-platform/_lib/lab.sh`.

**Story.** QuickBite's Kubernetes platform serves multiple teams: orders, payments, notifications, settlement. The learner is the platform engineer — not a tenant. They run the cluster, provision namespaces, enforce policies, and respond to incidents.

**CKA Alignment.** Labs map to CKA exam domains:
- Cluster Architecture, Installation & Configuration (25%)
- Workloads & Scheduling (15%)
- Services & Networking (20%)
- Storage (10%)
- Troubleshooting (30%)

Plus Platform Automations (Chapter 6) for control-plane tooling.

## Chapter 1 — Cluster Architecture, Installation & Configuration
### CKA Weight: 25%

Shape: varies by lab (`kubeadm-2` for multi-node, `kubeadm-3` for HA).

| Lab | Title | CKA Competency | Diff | Status |
| --- | --- | --- | --- | --- |
| k8s-platform-01 | Bind the Settlement Team to Their Namespace | RBAC | L1 | Planned |
| k8s-platform-02 | Prepare a Machine for kubeadm | Infrastructure prep | L1 | Planned |
| k8s-platform-03 | Bootstrap a Cluster with kubeadm | kubeadm init/join | L2 | Planned |
| k8s-platform-04 | Upgrade the Cluster Without Dropping Workloads | Lifecycle management | L2 | Planned |
| k8s-platform-05 | Three Control Planes and a Failed Node | HA control plane | L2 | Planned |
| k8s-platform-06 | Install Components with Helm and Kustomize | Helm/Kustomize | L1 | Planned |
| k8s-platform-07 | CNI, CSI, CRI: The Extension Interfaces | Extension interfaces | L1 | Planned |
| k8s-platform-08 | Install an Operator and Manage Custom Resources | CRDs/Operators | L2 | Planned |

### k8s-platform-01

RBAC foundation. Settlement team has `cluster-admin` legacy binding. Fix: namespace-scoped Role + RoleBinding, delete the ClusterRoleBinding. Grade checks `kubectl auth can-i` patterns: settlement yes, payments no, nodes no.

### k8s-platform-02

Pre-kubeadm prep. Fresh VM with swap on, no containerd, no modules. Setup script plants a broken state. Learner disables swap, loads modules, configures sysctl, installs containerd with SystemdCgroup. Grade: `free -h` shows no swap, `lsmod` shows br_netfilter, containerd running.

### k8s-platform-03

kubeadm bootstrap. Two prepared VMs. Learner runs `kubeadm init`, installs CNI (Flannel), joins worker. Grade: both nodes Ready, CoreDNS Running, test pod gets IP.

### k8s-platform-04

Cluster upgrade with zero downtime. Etcd backup, kubeadm upgrade on control plane, drain/upgrade/uncordon worker. `order-processor` stays Running. Grade: etcd snapshot exists, both nodes at target version, pods survived.

### k8s-platform-05

HA validation. Three control planes with stacked etcd. Kill one, verify API survives, etcd quorum maintained, `payment-handler` Running. Bring it back, verify full recovery. Grade: cluster survives failure, investigation explains quorum.

### k8s-platform-06

Helm + Kustomize. Install metrics-server with Helm, ingress-nginx with Kustomize. No raw `kubectl apply -f <url>`. Grade: `kubectl top nodes` works, ingress controller Running.

### k8s-platform-07

Extension interfaces diagnosis. Pods stuck ContainerCreating — CNI missing. Install CNI, document CRI and CSI. Grade: pods Running with IPs, answers.txt has correct CRI/CSI.

### k8s-platform-08

Operator pattern. Install database operator, create CR, verify it creates Deployment/Service/PVC. Delete CR, verify cleanup. Grade: operator Running, CR creates resources, delete triggers cleanup.

## Chapter 2 — Workloads & Scheduling
### CKA Weight: 15%

Shape: `k8s-2` (control plane + worker).

| Lab | Title | CKA Competency | Diff | Status |
| --- | --- | --- | --- | --- |
| k8s-platform-09 | Roll Forward, Then Roll Back | Rolling updates/rollbacks | L1 | Planned |
| k8s-platform-10 | Config from ConfigMaps, Credentials from Secrets | ConfigMaps/Secrets | L1 | Planned |
| k8s-platform-11 | Autoscale Notifications Under Load | HPA | L1 | Planned |
| k8s-platform-12 | Self-Healing: Replicas, Probes, and Recovery | Probes/self-healing | L1 | Planned |
| k8s-platform-13 | Admission, Limits, Affinity, and Taints | Pod admission/scheduling | L2 | Planned |

### k8s-platform-09

Rollout/rollback. Update to v1.1 (crashloops), roll back to v1.0. Grade: final image is v1.0, rollout history shows multiple revisions.

### k8s-platform-10

ConfigMap/Secret injection. `payment-handler` reads DB_HOST from ConfigMap, API_KEY from Secret. Grade: values from external sources, not hardcoded.

### k8s-platform-11

HPA. Create HPA for `notification-service`, generate load, watch scale-up/down. Grade: HPA exists, replicas increased under load, decreased after.

### k8s-platform-12

Probes. Add liveness (restart on stuck) and readiness (remove from Service). Simulate failures. Grade: liveness failure → restart, readiness failure → removed from endpoints.

### k8s-platform-13

Comprehensive admission. LimitRange defaults, ResourceQuota enforcement, toleration + affinity for PCI node. Grade: `payment-handler` on PCI node, greedy pod Pending.

## Chapter 3 — Services & Networking
### CKA Weight: 20%

Shape: `k8s-2` or `k8s-3` (multi-node for cross-node testing).

| Lab | Title | CKA Competency | Diff | Status |
| --- | --- | --- | --- | --- |
| k8s-platform-14 | Pod-to-Pod: The Flat Network | Pod connectivity | L1 | Planned |
| k8s-platform-15 | NetworkPolicy: Only Orders Can Call Payments | NetworkPolicy | L1 | Planned |
| k8s-platform-16 | ClusterIP, NodePort, LoadBalancer, and Endpoints | Service types | L1 | Planned |
| k8s-platform-17 | Gateway API: The Modern Ingress | Gateway API | L1 | Planned |
| k8s-platform-18 | Ingress Controller and Ingress Resources | Ingress | L1 | Planned |
| k8s-platform-19 | CoreDNS: When Service Names Don't Resolve | CoreDNS | L1 | Planned |

### k8s-platform-14

Flat network verification. Pods on different nodes reach each other by IP. Grade: cross-node connectivity works, documented pod CIDR.

### k8s-platform-15

NetworkPolicy. Default-deny ingress for payments, allow only from orders. Grade: `order-processor` can reach `payment-handler`, `notification-service` cannot.

### k8s-platform-16

Service types. ClusterIP (internal), NodePort (QA), LoadBalancer (partners), manual Endpoints (external DB). Grade: all four patterns work.

### k8s-platform-17

Gateway API. Create Gateway + HTTPRoutes for /pay and /orders. Grade: routing works, investigation compares to Ingress.

### k8s-platform-18

Ingress. Install ingress-nginx, create Ingress for `orders.quickbite.local`. Grade: controller Running, traffic routed.

### k8s-platform-19

CoreDNS troubleshooting. ConfigMap has wrong cluster domain. Fix and verify `nslookup` works. Grade: DNS resolves Services.

## Chapter 4 — Storage
### CKA Weight: 10%

Shape: `k8s-2` with CSI driver.

| Lab | Title | CKA Competency | Diff | Status |
| --- | --- | --- | --- | --- |
| k8s-platform-20 | Dynamic Provisioning with StorageClass | StorageClass/dynamic provisioning | L1 | Planned |
| k8s-platform-21 | Access Modes and Reclaim Policies | Volume config | L1 | Planned |
| k8s-platform-22 | Static Provisioning: Create the PV First | PV/PVC management | L1 | Planned |

### k8s-platform-20

Dynamic provisioning. Create StorageClass, PVC auto-creates PV. Grade: PVC Bound, PV created automatically.

### k8s-platform-21

Access modes and reclaim. RWO vs RWX, Retain vs Delete. Grade: Retain policy PV survives PVC deletion.

### k8s-platform-22

Static provisioning. Create PV for NFS, bind PVC. Grade: PVC binds to specific PV, data accessible.

## Chapter 5 — Troubleshooting
### CKA Weight: 30%

Shape: varies by fault type.

| Lab | Title | CKA Competency | Diff | Status |
| --- | --- | --- | --- | --- |
| k8s-platform-23 | A Node Won't Join: Fix NotReady | Node troubleshooting | L1 | Planned |
| k8s-platform-24 | The Scheduler Is Down: Nothing New Runs | Control plane troubleshooting | L2 | Planned |
| k8s-platform-25 | OOMKilled: Reading Resource Usage | Resource monitoring | L1 | Planned |
| k8s-platform-26 | Read the Logs: Crashloop Diagnosis | Container logs | L1 | Planned |
| k8s-platform-27 | Service Has No Endpoints | Service/networking troubleshooting | L1 | Planned |

### k8s-platform-23

NotReady node. kubelet stopped on node-b. SSH, diagnose, fix. Grade: node Ready, did not delete Node object.

### k8s-platform-24

Broken scheduler. Static pod manifest has typo. Fix manifest, scheduler restarts automatically. Grade: Pending pods scheduled.

### k8s-platform-25

OOMKilled. `kubectl top` shows actual usage, raise limit. Grade: pod stable, no OOMKilled.

### k8s-platform-26

Crashloop diagnosis. Multi-container pod, error in previous logs. Use `--previous` and container name. Grade: identified root cause.

### k8s-platform-27

Empty Endpoints. Selector typo. Fix selector, Endpoints populate. Grade: traffic works.

## Chapter 6 — Platform Automations

Shape: `k8s-2` with Python/Flask.

| Lab | Title | Kind | Diff | Status |
| --- | --- | --- | --- | --- |
| k8s-platform-C1 | Apply the Namespace from the Request File | provisioning | L1 | Planned |
| k8s-platform-C2 | Refuse the Bad Request | guardrails | L1 | Planned |
| k8s-platform-C3 | Ship a Node Health Report | monitoring | L1 | Planned |
| k8s-platform-C4 | Ship a Pending Pod Report | monitoring | L1 | Planned |
| k8s-platform-C5 | RBAC from the Team Template | access control | L1–L2 | Planned |
| k8s-platform-C6 | Quota the Runaway Namespace | governance | L1 | Planned |
| k8s-platform-C7 | Detect Drift Without Fixing It | drift detection | L1 | Planned |
| k8s-platform-C8 | Reconcile to Desired State | reconciliation | L1 | Planned |
| k8s-platform-C9 | Drain Helper: Safe Node Evacuation | operational tooling | L1–L2 | Planned |
| k8s-platform-C10 | Namespace Request API | self-service | L2 | Planned |

### k8s-platform-C1

Declarative namespace provisioning. Request file → Namespace + Quota + LimitRange + RBAC. Idempotent.

### k8s-platform-C2

Guardrails. Reject cluster-admin, missing quota, excessive limits. Fail closed.

### k8s-platform-C3

Node health CLI. List NotReady nodes, exit 0/1. For cron/alerting.

### k8s-platform-C4

Pending pod CLI. List Pending pods with reasons. Same pattern.

### k8s-platform-C5

RBAC from template. Apply roles for deploy-bot and settlement-team. Verify allowed/denied.

### k8s-platform-C6

Quota governance. Apply ResourceQuota to runaway namespace only.

### k8s-platform-C7

Drift detection. Print diff without changing cluster.

### k8s-platform-C8

Drift reconciliation. Apply changes, wait for convergence, idempotent.

### k8s-platform-C9

Drain helper. Cordon, drain, refuse control plane. Verify workload availability.

### k8s-platform-C10

Self-service API. Flask endpoint for namespace requests. Validates, creates, returns status.

## Summary

### Lab counts by domain

| Domain | CKA Weight | Labs |
| --- | --- | --- |
| Cluster Architecture | 25% | 8 |
| Workloads & Scheduling | 15% | 5 |
| Services & Networking | 20% | 6 |
| Storage | 10% | 3 |
| Troubleshooting | 30% | 5 |
| Platform Automations | — | 10 |
| **Total** | 100% | **37** |

### Design principles

- CKA-aligned competencies in every lab.
- Investigation stays light; tasks are heavy.
- Every automation lab ships a durable tool.
- QuickBite multi-tenant story throughout.
- Progressive difficulty: L1 → L2.

---

**Next steps for implementation:** Hand this file plus `K8S_PLATFORM_CURRICULUM.md` to the implementing agent for packs (`setup.sh`, `grade.sh`, GUIDE, skeletons).
