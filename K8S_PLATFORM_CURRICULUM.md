# Kubernetes Platform Engineering Curriculum
## CKA-Aligned Design Specifications

**Theme:** Running and operating Kubernetes clusters as a platform engineer. Move from reactive troubleshooting to proactive cluster management, understanding the control plane, networking, storage, and building automation around shared infrastructure.

**Philosophy:** This curriculum is aligned with the **Certified Kubernetes Administrator (CKA)** exam domains. You are the admin of the cluster—not a tenant deploying apps. You understand how the cluster works, how to install and upgrade it, how to troubleshoot it, and how to build platform tooling around it.

**Tech Stack:** `kubectl`, `kubeadm`, `etcdctl`, `crictl`, Helm, Kustomize, Python for automation, Bash for operational wrappers. CNI (Calico/Flannel), CSI, CRI (containerd).

**Story:** QuickBite's Kubernetes platform serves multiple teams: orders, payments, notifications, settlement. You are the platform engineer who keeps the cluster healthy, provisions namespaces, enforces quotas, and responds to incidents.

---

## CKA Domain Weights (Reference)

| Domain | Weight |
| --- | --- |
| Cluster Architecture, Installation & Configuration | 25% |
| Workloads & Scheduling | 15% |
| Services & Networking | 20% |
| Storage | 10% |
| Troubleshooting | 30% |

---

## Chapter 1 — Cluster Architecture, Installation & Configuration
### CKA Domain Weight: 25%

**Arc:** RBAC → pre-kubeadm prep → kubeadm init/join → lifecycle/upgrade → HA control plane → Helm/Kustomize → extension interfaces → CRDs/operators.

**Philosophy:** Before you can troubleshoot a cluster, you must understand how it is built. This chapter takes you from a blank machine to a production-grade HA cluster, with proper access control and declarative component installation.

---

### Lab K8s-Platform-01
**Difficulty:** L1  
**Title:** "Bind the Settlement Team to Their Namespace"  
**CKA Competency:** Manage role based access control (RBAC)  
**Setup:** Multi-node cluster with namespaces `orders`, `payments`, `notifications`, `settlement`.

#### SITUATION
The settlement team was given `cluster-admin` during an emergency last month. That grant is still live. Platform policy says each team gets a Role in their own namespace—not cluster-wide admin. The settlement team should be able to create/update/delete Deployments, Services, ConfigMaps, and Secrets in `settlement` only. They should not be able to touch `payments` or read cluster-wide resources.

Security audit is tomorrow. Fix the RBAC before then.

#### PLANTED SETUP
- Cluster with four namespaces: `orders`, `payments`, `notifications`, `settlement`.
- ServiceAccount `settlement-deployer` in `settlement` namespace.
- ClusterRoleBinding `settlement-admin-legacy` binding `settlement-deployer` to `cluster-admin`.
- No Role or RoleBinding in `settlement` namespace.
- Test pod `~/lab/test-access.yaml` that runs as `settlement-deployer` and tries various operations.

#### INVESTIGATION (light)
- List ClusterRoleBindings; find the legacy binding.
- Use `kubectl auth can-i` as `settlement-deployer` to confirm cluster-admin access.
- Predict what operations should succeed/fail after the fix.

#### TASKS (heavy)
1. Open the Guide. Understand Role vs ClusterRole, RoleBinding vs ClusterRoleBinding.
2. Create a Role `settlement-developer` in `settlement` namespace with:
   - Deployments: get, list, watch, create, update, patch, delete
   - Services: get, list, watch, create, update, patch, delete
   - ConfigMaps: get, list, watch, create, update, patch, delete
   - Secrets: get, list, watch, create, update, patch, delete
   - Pods: get, list, watch
3. Create a RoleBinding `settlement-developer-binding` in `settlement` binding `settlement-deployer` to the new Role.
4. Delete the ClusterRoleBinding `settlement-admin-legacy`.
5. Verify with `kubectl auth can-i`:
   - ✓ `create deployment -n settlement --as=system:serviceaccount:settlement:settlement-deployer`
   - ✗ `create deployment -n payments --as=system:serviceaccount:settlement:settlement-deployer`
   - ✗ `get nodes --as=system:serviceaccount:settlement:settlement-deployer`
6. Run the test pod and confirm it can deploy to settlement but cannot touch payments.
7. Investigation: Why is a namespace-scoped Role safer than cluster-admin? What is the principle of least privilege?
8. Submit.

#### GRADING
- ClusterRoleBinding `settlement-admin-legacy` deleted.
- Role `settlement-developer` exists in `settlement` with correct permissions.
- RoleBinding exists binding `settlement-deployer` to the Role.
- `kubectl auth can-i` tests pass (settlement yes, payments no, nodes no).
- Investigation answers coherent.

#### LEARNING OBJECTIVES
- Understand the difference between Role/ClusterRole and RoleBinding/ClusterRoleBinding.
- Apply principle of least privilege to team access.
- Audit and remove overly-permissive legacy bindings.

#### IMPLEMENTATION NOTES
- Use `kubectl create role` and `kubectl create rolebinding` or YAML manifests.
- `kubectl auth can-i --list` shows all permissions for a subject.
- The `--as` flag impersonates a service account for testing.

---

### Lab K8s-Platform-02
**Difficulty:** L1  
**Title:** "Prepare a Machine for kubeadm"  
**CKA Competency:** Prepare underlying infrastructure for installing a Kubernetes cluster  
**Setup:** Fresh VM with nothing installed.

#### SITUATION
A new bare-metal machine arrived for the QuickBite cluster expansion. Before you can run `kubeadm init` or `kubeadm join`, the machine must be prepared:
- Swap must be off (kubelet refuses to start with swap on by default)
- Required kernel modules must be loaded (`overlay`, `br_netfilter`)
- Sysctl settings for networking must be configured
- Container runtime (containerd) must be installed and running
- Required ports must be open

The machine is vanilla. Your job is to make it kubeadm-ready.

#### PLANTED SETUP
- Fresh VM with Ubuntu 22.04.
- Swap enabled (default).
- No container runtime installed.
- Firewall enabled blocking all ports.
- No kernel modules loaded for container networking.
- Skeleton script `~/lab/prepare-node.sh`.

#### INVESTIGATION (light)
- Check `free -h` for swap status.
- Check `lsmod` for missing modules.
- Check `sysctl net.bridge.bridge-nf-call-iptables`.
- Check if containerd is installed/running.

#### TASKS (heavy)
1. Open the Guide. Understand pre-kubeadm requirements.
2. Disable swap:
   - `swapoff -a`
   - Comment out swap line in `/etc/fstab` for persistence.
3. Load kernel modules:
   ```bash
   cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
   overlay
   br_netfilter
   EOF
   modprobe overlay
   modprobe br_netfilter
   ```
4. Configure sysctl:
   ```bash
   cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
   net.bridge.bridge-nf-call-iptables  = 1
   net.bridge.bridge-nf-call-ip6tables = 1
   net.ipv4.ip_forward                 = 1
   EOF
   sysctl --system
   ```
5. Install containerd:
   - Install from apt or download binary.
   - Configure with `containerd config default > /etc/containerd/config.toml`.
   - Set `SystemdCgroup = true` in the config.
   - Enable and start containerd.
6. Open required ports (or disable firewall for the lab):
   - Control plane: 6443 (API), 2379-2380 (etcd), 10250-10252 (kubelet, scheduler, controller-manager)
   - Worker: 10250 (kubelet), 30000-32767 (NodePort)
7. Verify:
   - `free -h` shows no swap
   - `lsmod | grep br_netfilter` shows module loaded
   - `sysctl net.ipv4.ip_forward` shows 1
   - `systemctl status containerd` shows active
8. Investigation: Why does kubelet refuse to start with swap? Why `bridge-nf-call-iptables`?
9. Submit.

#### GRADING
- Swap is off and stays off after reboot (fstab edited).
- Kernel modules loaded and persistent.
- Sysctl settings correct.
- containerd running with SystemdCgroup enabled.
- Required ports open.
- Investigation answers explain swap and bridge networking.

#### LEARNING OBJECTIVES
- Understand the prerequisites for a Kubernetes node.
- Configure a container runtime (containerd) for Kubernetes.
- Understand why each prerequisite exists (not just how to set it).

#### IMPLEMENTATION NOTES
- `crictl` can verify containerd is working after install.
- The `SystemdCgroup = true` setting is critical for kubelet compatibility.
- Use `ss -tlnp` or `netstat -tlnp` to verify ports.

---

### Lab K8s-Platform-03
**Difficulty:** L2  
**Title:** "Bootstrap a Cluster with kubeadm"  
**CKA Competency:** Create and manage Kubernetes clusters using kubeadm  
**Setup:** Two prepared VMs (control plane + worker).

#### SITUATION
The machines are prepped (Lab 02). Now bootstrap an actual cluster:
1. Initialize the control plane with `kubeadm init`
2. Install a CNI (Calico or Flannel)
3. Join the worker node
4. Verify both nodes are Ready

This is the moment the cluster comes to life.

#### PLANTED SETUP
- Two VMs: `cp-01` (control plane), `worker-01`.
- Both have containerd, kernel modules, sysctl, no swap.
- kubeadm, kubelet, kubectl installed but cluster not initialized.
- Skeleton `~/lab/init-cluster.sh` on cp-01.
- Pod network CIDR: `10.244.0.0/16` (for Flannel) or `192.168.0.0/16` (for Calico).

#### INVESTIGATION (light)
- Run `kubectl get nodes` — should fail (no cluster yet).
- Check `kubeadm version`.
- Review `kubeadm init --help` for required flags.

#### TASKS (heavy)
1. Open the Guide. Understand kubeadm init phases.
2. On `cp-01`, initialize the control plane:
   ```bash
   kubeadm init --pod-network-cidr=10.244.0.0/16 --apiserver-advertise-address=<cp-01-ip>
   ```
3. Set up kubectl for the root user:
   ```bash
   mkdir -p $HOME/.kube
   cp /etc/kubernetes/admin.conf $HOME/.kube/config
   ```
4. Install the CNI (Flannel):
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
   ```
5. Get the join command from kubeadm output (or regenerate with `kubeadm token create --print-join-command`).
6. On `worker-01`, run the join command.
7. On `cp-01`, verify:
   - `kubectl get nodes` shows both Ready
   - `kubectl get pods -n kube-system` shows all system pods Running
8. Deploy a test pod and verify it gets an IP from the pod network.
9. Investigation: What does `kubeadm init` actually create? What is the role of the CNI?
10. Submit.

#### GRADING
- Control plane initialized; `kubectl get nodes` works.
- CNI installed; CoreDNS pods are Running (not Pending).
- Worker node joined and Ready.
- Test pod gets an IP and can reach the API server.
- Investigation answers cover kubeadm phases and CNI role.

#### LEARNING OBJECTIVES
- Bootstrap a Kubernetes cluster from scratch.
- Understand the relationship between kubeadm, kubelet, and the CNI.
- Join worker nodes to an existing cluster.

#### IMPLEMENTATION NOTES
- Save the join command; it has a token that expires in 24h.
- If join command is lost: `kubeadm token create --print-join-command`.
- CNI must match the `--pod-network-cidr` used in init.

---

### Lab K8s-Platform-04
**Difficulty:** L2  
**Title:** "Upgrade the Cluster Without Dropping Workloads"  
**CKA Competency:** Manage the lifecycle of Kubernetes clusters  
**Setup:** Running cluster at version X, target version X+1.

#### SITUATION
Kubernetes 1.29 is out. QuickBite is on 1.28. Platform policy requires staying within one minor version of latest. The upgrade must happen without dropping `order-processor` (running on the worker).

The upgrade process:
1. Take an etcd snapshot (disaster recovery)
2. Upgrade the control plane
3. Drain and upgrade each worker one at a time
4. Uncordon workers

`order-processor` must stay Running throughout.

#### PLANTED SETUP
- Cluster at Kubernetes 1.28.x.
- Control plane `cp-01`, worker `worker-01`.
- `order-processor` Deployment with 2 replicas on `worker-01`.
- kubeadm 1.29.x available in apt but not installed.
- Skeleton `~/lab/upgrade-cluster.sh`.

#### INVESTIGATION (light)
- Check current version: `kubectl get nodes`, `kubeadm version`.
- Check available versions: `apt-cache madison kubeadm`.
- Confirm `order-processor` is running.

#### TASKS (heavy)
1. Open the Guide. Understand upgrade order: control plane first, then workers.
2. **Backup etcd** (before any upgrade):
   ```bash
   ETCDCTL_API=3 etcdctl snapshot save /tmp/etcd-backup.db \
     --endpoints=https://127.0.0.1:2379 \
     --cacert=/etc/kubernetes/pki/etcd/ca.crt \
     --cert=/etc/kubernetes/pki/etcd/server.crt \
     --key=/etc/kubernetes/pki/etcd/server.key
   ```
3. **Upgrade control plane**:
   ```bash
   apt-mark unhold kubeadm && apt-get update && apt-get install -y kubeadm=1.29.x-*
   apt-mark hold kubeadm
   kubeadm upgrade plan
   kubeadm upgrade apply v1.29.x
   apt-mark unhold kubelet kubectl && apt-get install -y kubelet=1.29.x-* kubectl=1.29.x-*
   apt-mark hold kubelet kubectl
   systemctl daemon-reload && systemctl restart kubelet
   ```
4. **Upgrade worker**:
   ```bash
   # On control plane:
   kubectl drain worker-01 --ignore-daemonsets --delete-emptydir-data
   # On worker-01:
   apt-mark unhold kubeadm && apt-get install -y kubeadm=1.29.x-*
   kubeadm upgrade node
   apt-mark unhold kubelet kubectl && apt-get install -y kubelet=1.29.x-* kubectl=1.29.x-*
   systemctl daemon-reload && systemctl restart kubelet
   # On control plane:
   kubectl uncordon worker-01
   ```
5. Verify:
   - `kubectl get nodes` shows both at 1.29.x
   - `order-processor` pods are Running (may have been rescheduled)
   - etcd backup file exists and is valid: `etcdctl snapshot status /tmp/etcd-backup.db`
6. Investigation: Why drain before upgrade? What does `kubeadm upgrade apply` actually do?
7. Submit.

#### GRADING
- etcd snapshot exists and is valid.
- Both nodes at target version.
- `order-processor` pods Running throughout (downtime < 30s acceptable during reschedule).
- Investigation answers cover drain purpose and kubeadm upgrade phases.

#### LEARNING OBJECTIVES
- Perform a zero-downtime cluster upgrade.
- Backup etcd before risky operations.
- Understand the upgrade order and why it matters.

#### IMPLEMENTATION NOTES
- Always upgrade control plane before workers.
- `--delete-emptydir-data` is needed if any pod uses emptyDir.
- PodDisruptionBudgets can block drains if misconfigured.

---

### Lab K8s-Platform-05
**Difficulty:** L2  
**Title:** "Three Control Planes and a Failed Node"  
**CKA Competency:** Implement and configure a highly-available control plane  
**Setup:** Three control plane nodes with stacked etcd.

#### SITUATION
QuickBite's production cluster needs high availability. A single control plane means the API goes down if that node dies. The fix: three control plane nodes with stacked etcd (etcd runs on each control plane node).

Your task: verify the HA setup works by killing one control plane and confirming the API still responds and workloads keep running.

#### PLANTED SETUP
- Three control plane nodes: `cp-01`, `cp-02`, `cp-03`.
- One worker: `worker-01`.
- Stacked etcd (etcd on each control plane, not external).
- `payment-handler` Deployment running on worker.
- Load balancer fronting the API servers (or haproxy on each node).

#### INVESTIGATION (light)
- `kubectl get nodes` — all four nodes Ready.
- Check etcd members: `etcdctl member list`.
- Identify which control plane is the etcd leader.

#### TASKS (heavy)
1. Open the Guide. Understand stacked vs external etcd, quorum requirements.
2. Verify HA setup:
   - `kubectl get endpoints kubernetes` shows multiple IPs.
   - `etcdctl member list` shows three members.
3. Stop one control plane (not the current API target):
   ```bash
   # On cp-02:
   systemctl stop kubelet
   # Or more dramatically: shutdown the node
   ```
4. Verify cluster survives:
   - `kubectl get nodes` still works (may take a few seconds).
   - `payment-handler` pods still Running.
   - etcd quorum maintained (2 of 3 members up).
5. Check etcd health:
   ```bash
   etcdctl endpoint health --endpoints=https://cp-01:2379,https://cp-03:2379
   ```
6. Bring cp-02 back:
   ```bash
   systemctl start kubelet
   ```
7. Verify full recovery: all three control planes Ready, etcd has three healthy members.
8. Investigation: What is etcd quorum? Why three nodes (not two)? What happens if two of three die?
9. Submit.

#### GRADING
- Cluster survives one control plane failure.
- API responds throughout.
- `payment-handler` never goes down.
- etcd quorum maintained during failure.
- Full recovery after bringing node back.
- Investigation answers explain quorum and odd-number requirement.

#### LEARNING OBJECTIVES
- Understand HA control plane architecture.
- Verify HA works under failure conditions.
- Understand etcd quorum and its implications.

#### IMPLEMENTATION NOTES
- Stacked etcd: etcd runs as a static pod on each control plane.
- External etcd: separate etcd cluster (more resilient, more complex).
- Quorum = (n/2)+1, so 3 nodes tolerate 1 failure.

---

### Lab K8s-Platform-06
**Difficulty:** L1  
**Title:** "Install Components with Helm and Kustomize"  
**CKA Competency:** Use Helm and Kustomize to install cluster components  
**Setup:** Cluster without metrics-server or ingress controller.

#### SITUATION
QuickBite needs:
1. `metrics-server` for `kubectl top` and HPA (install with Helm)
2. `ingress-nginx` for external traffic (install with Kustomize)

Platform policy: never `kubectl apply -f` raw manifests for cluster components. Use package managers for repeatability and upgrades.

#### PLANTED SETUP
- Running cluster, no metrics-server, no ingress controller.
- Helm 3 installed.
- Kustomize installed (or `kubectl kustomize`).
- Skeleton `~/lab/install-components.sh`.
- Kustomization base for ingress-nginx at `~/lab/ingress-base/`.

#### INVESTIGATION (light)
- `kubectl top nodes` fails (no metrics-server).
- `kubectl get pods -n ingress-nginx` — namespace doesn't exist.
- `helm repo list` — no repos added yet.

#### TASKS (heavy)
1. Open the Guide. Understand Helm charts vs Kustomize overlays.
2. **Install metrics-server with Helm**:
   ```bash
   helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
   helm repo update
   helm install metrics-server metrics-server/metrics-server -n kube-system \
     --set args[0]="--kubelet-insecure-tls"  # for lab certs
   ```
3. Wait for metrics-server to be Running:
   ```bash
   kubectl wait --for=condition=available deployment/metrics-server -n kube-system --timeout=120s
   ```
4. Verify: `kubectl top nodes` returns data.
5. **Install ingress-nginx with Kustomize**:
   ```bash
   # ~/lab/ingress-base/kustomization.yaml already has the remote base
   kubectl apply -k ~/lab/ingress-base/
   ```
6. Wait for ingress controller:
   ```bash
   kubectl wait --for=condition=available deployment/ingress-nginx-controller -n ingress-nginx --timeout=120s
   ```
7. Verify: `kubectl get pods -n ingress-nginx` shows controller Running.
8. Create a test Ingress and verify it's picked up by the controller.
9. Investigation: When would you choose Helm vs Kustomize? What are the tradeoffs?
10. Submit.

#### GRADING
- metrics-server installed via Helm, `kubectl top nodes` works.
- ingress-nginx installed via Kustomize, controller Running.
- No raw `kubectl apply -f <url>` used.
- Investigation answers compare Helm and Kustomize appropriately.

#### LEARNING OBJECTIVES
- Install cluster components declaratively.
- Understand Helm charts and values.
- Understand Kustomize bases and overlays.

#### IMPLEMENTATION NOTES
- Helm: `helm list -A` shows installed releases.
- Kustomize: `kubectl kustomize <dir>` renders without applying.
- `--kubelet-insecure-tls` is needed in labs without proper kubelet certs.

---

### Lab K8s-Platform-07
**Difficulty:** L1  
**Title:** "CNI, CSI, CRI: The Extension Interfaces"  
**CKA Competency:** Understand extension interfaces (CNI, CSI, CRI, etc.)  
**Setup:** Cluster with pods stuck in ContainerCreating.

#### SITUATION
New pods are stuck in `ContainerCreating` with no IP assigned. The CNI plugin was accidentally deleted during a cleanup. Additionally, you need to document:
- Which CRI (Container Runtime Interface) the cluster uses
- Which CSI (Container Storage Interface) driver backs the default StorageClass

This lab teaches you what these extension interfaces are and how to diagnose when they're broken.

#### PLANTED SETUP
- Cluster with CNI plugin removed (or misconfigured).
- Pods in `ContainerCreating` state.
- containerd as CRI.
- A CSI driver installed (e.g., local-path-provisioner or EBS CSI).
- Answer file `~/lab/answers.txt` to fill in.

#### INVESTIGATION (light)
- `kubectl describe pod <stuck-pod>` — look for network plugin errors.
- Check `/etc/cni/net.d/` — probably empty.
- `kubectl get nodes -o wide` — INTERNAL-IP but pods have no IP.

#### TASKS (heavy)
1. Open the Guide. Understand CNI, CSI, CRI roles.
2. **Diagnose CNI issue**:
   - `kubectl describe pod` shows "network plugin not ready" or similar.
   - `/etc/cni/net.d/` is empty (no CNI config).
3. **Install CNI** (Flannel or Calico):
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
   ```
4. Wait for CNI pods to be Running:
   ```bash
   kubectl wait --for=condition=ready pod -l app=flannel -n kube-flannel --timeout=120s
   ```
5. Verify stuck pods now have IPs and are Running.
6. **Document CRI**:
   - Check kubelet config or `kubectl get node -o yaml | grep containerRuntime`.
   - Or: `crictl info` on a node.
   - Write to `~/lab/answers.txt`: `CRI=containerd`
7. **Document CSI**:
   - `kubectl get storageclass` — find the default.
   - `kubectl get storageclass <name> -o yaml | grep provisioner`.
   - Write to `~/lab/answers.txt`: `CSI=<provisioner-name>`
8. Investigation: What does CNI do? What does CSI do? Why are they plugins, not built-in?
9. Submit.

#### GRADING
- CNI installed; stuck pods now Running with IPs.
- `CRI` correctly identified in answers.txt.
- `CSI` correctly identified in answers.txt.
- Investigation answers explain each interface's purpose.

#### LEARNING OBJECTIVES
- Diagnose CNI failures (pods with no network).
- Understand the plugin architecture of Kubernetes.
- Identify which implementations are in use on a cluster.

#### IMPLEMENTATION NOTES
- CNI binaries: `/opt/cni/bin/`
- CNI configs: `/etc/cni/net.d/`
- `crictl` talks to the CRI; `ctr` is containerd-specific.

---

### Lab K8s-Platform-08
**Difficulty:** L2  
**Title:** "Install an Operator and Manage Custom Resources"  
**CKA Competency:** Understand CRDs, install and configure operators  
**Setup:** Cluster without the operator; CRD not installed.

#### SITUATION
QuickBite wants to manage databases declaratively. Instead of creating Deployments, Services, and PVCs manually, they want to create a `Database` custom resource and have an operator do the work.

Install the operator. Create a custom resource. Verify the operator creates the underlying Deployment. Delete the custom resource and verify cleanup.

#### PLANTED SETUP
- Cluster without the database operator.
- Operator manifests at `~/lab/database-operator/`.
- Sample `Database` CR at `~/lab/sample-database.yaml`.
- No CRD for `databases.quickbite.io` exists yet.

#### INVESTIGATION (light)
- `kubectl get crd` — no `databases.quickbite.io`.
- `kubectl apply -f ~/lab/sample-database.yaml` — fails (unknown resource).

#### TASKS (heavy)
1. Open the Guide. Understand CRDs and the operator pattern.
2. **Install the operator**:
   ```bash
   kubectl apply -f ~/lab/database-operator/
   ```
3. Verify CRD is created:
   ```bash
   kubectl get crd databases.quickbite.io
   ```
4. Verify operator pod is Running:
   ```bash
   kubectl get pods -n database-operator-system
   ```
5. **Create a Database custom resource**:
   ```bash
   kubectl apply -f ~/lab/sample-database.yaml
   ```
6. Verify the operator created resources:
   ```bash
   kubectl get deployment -l app.kubernetes.io/managed-by=database-operator
   kubectl get service -l app.kubernetes.io/managed-by=database-operator
   kubectl get pvc -l app.kubernetes.io/managed-by=database-operator
   ```
7. **Delete the custom resource**:
   ```bash
   kubectl delete -f ~/lab/sample-database.yaml
   ```
8. Verify cleanup: Deployment, Service, and PVC are deleted.
9. Investigation: What is the difference between a CRD and a controller? What makes something an "operator"?
10. Submit.

#### GRADING
- CRD `databases.quickbite.io` exists.
- Operator pod Running.
- Creating CR triggers Deployment/Service/PVC creation.
- Deleting CR triggers cleanup.
- Investigation answers distinguish CRD from controller and define operator.

#### LEARNING OBJECTIVES
- Install and use Kubernetes operators.
- Understand the CRD + controller = operator pattern.
- Manage application lifecycle through custom resources.

#### IMPLEMENTATION NOTES
- Operators often use finalizers for cleanup.
- `kubectl get <cr> -o yaml` shows status set by the operator.
- Popular operator frameworks: kubebuilder, operator-sdk.

---

## Chapter 2 — Workloads & Scheduling
### CKA Domain Weight: 15%

**Arc:** Rolling updates/rollbacks → ConfigMaps/Secrets → HPA autoscaling → self-healing primitives → admission and scheduling (limits, affinity, taints).

**Philosophy:** Workloads run on nodes. This chapter teaches you how Kubernetes decides where to put them, how to update them safely, and how to keep them running.

---

### Lab K8s-Platform-09
**Difficulty:** L1  
**Title:** "Roll Forward, Then Roll Back"  
**CKA Competency:** Understand application deployments and how to perform rolling update and rollbacks  
**Setup:** Deployment at v1.0, need to update to v1.1, then rollback.

#### SITUATION
`order-processor` is at `v1.0`. A new image `v1.1` is ready. Roll forward. But `v1.1` crashloops (bad image). Roll back to `v1.0`. The running image at the end must be `v1.0`.

#### PLANTED SETUP
- `order-processor` Deployment at `devsetu/order-processor:v1.0`, 3 replicas, all Running.
- Image `devsetu/order-processor:v1.1` exists but has a bug (crashes on startup).
- No rollout history beyond the current revision.

#### INVESTIGATION (light)
- `kubectl rollout status deployment/order-processor` — shows current status.
- `kubectl rollout history deployment/order-processor` — shows revisions.

#### TASKS (heavy)
1. Open the Guide. Understand rolling update strategy and revision history.
2. **Roll forward to v1.1**:
   ```bash
   kubectl set image deployment/order-processor order-processor=devsetu/order-processor:v1.1
   ```
3. Watch the rollout:
   ```bash
   kubectl rollout status deployment/order-processor
   ```
4. Observe crashlooping pods (v1.1 is broken).
5. **Roll back to v1.0**:
   ```bash
   kubectl rollout undo deployment/order-processor
   ```
6. Verify rollback:
   - All pods Running with `v1.0` image.
   - `kubectl rollout history` shows the rollback as a new revision.
7. Investigation: What is a ReplicaSet? How does rollback work (hint: it's not "downgrade" — it's a new rollout to the old ReplicaSet)?
8. Submit.

#### GRADING
- Deployment went to v1.1, then back to v1.0.
- All pods Running with v1.0 at the end.
- Rollout history shows multiple revisions.
- Investigation explains ReplicaSet role in rollouts.

#### LEARNING OBJECTIVES
- Perform rolling updates safely.
- Roll back a failed deployment.
- Understand the relationship between Deployments and ReplicaSets.

#### IMPLEMENTATION NOTES
- `kubectl rollout undo deployment/<name> --to-revision=<n>` for specific revision.
- `spec.revisionHistoryLimit` controls how many old ReplicaSets to keep.

---

### Lab K8s-Platform-10
**Difficulty:** L1  
**Title:** "Config from ConfigMaps, Credentials from Secrets"  
**CKA Competency:** Use ConfigMaps and Secrets to configure applications  
**Setup:** Application hardcoding config that should come from ConfigMap/Secret.

#### SITUATION
`payment-handler` has config baked into its image:
- Database host: hardcoded
- API key: hardcoded (security risk!)

Platform policy: config comes from ConfigMaps, credentials come from Secrets. Neither is baked into the image.

Update `payment-handler` to read:
- `DB_HOST` from ConfigMap `payment-config`
- `API_KEY` from Secret `payment-secret`

#### PLANTED SETUP
- `payment-handler` Deployment with hardcoded env vars.
- ConfigMap `payment-config` exists with `DB_HOST=orders-db.orders.svc.cluster.local`.
- Secret `payment-secret` exists with `API_KEY=<base64-encoded>`.
- The application reads `DB_HOST` and `API_KEY` from environment variables.

#### INVESTIGATION (light)
- `kubectl get configmap payment-config -o yaml`
- `kubectl get secret payment-secret -o yaml` (note: base64 encoded, not encrypted)

#### TASKS (heavy)
1. Open the Guide. Understand ConfigMap vs Secret, envFrom vs env.
2. Update the Deployment to reference ConfigMap:
   ```yaml
   env:
     - name: DB_HOST
       valueFrom:
         configMapKeyRef:
           name: payment-config
           key: DB_HOST
   ```
3. Update the Deployment to reference Secret:
   ```yaml
   env:
     - name: API_KEY
       valueFrom:
         secretKeyRef:
           name: payment-secret
           key: API_KEY
   ```
4. Apply the updated Deployment.
5. Verify the pod has the correct values:
   ```bash
   kubectl exec <pod> -- printenv DB_HOST API_KEY
   ```
6. Verify the values are NOT in the image or Deployment spec directly.
7. Investigation: Why Secrets instead of ConfigMaps for credentials? (Hint: it's not encryption — what is it?)
8. Submit.

#### GRADING
- `payment-handler` pods read `DB_HOST` from ConfigMap.
- `payment-handler` pods read `API_KEY` from Secret.
- No hardcoded values in Deployment spec.
- Investigation explains Secret vs ConfigMap purpose (access control, audit, not encryption).

#### LEARNING OBJECTIVES
- Externalize configuration from images.
- Use ConfigMaps for non-sensitive config.
- Use Secrets for sensitive data (with understanding of their limitations).

#### IMPLEMENTATION NOTES
- Secrets are base64 encoded, not encrypted at rest (unless you enable encryption).
- `envFrom` loads all keys from a ConfigMap/Secret as env vars.
- Secrets can be mounted as files too.

---

### Lab K8s-Platform-11
**Difficulty:** L1  
**Title:** "Autoscale Notifications Under Load"  
**CKA Competency:** Configure workload autoscaling  
**Setup:** Deployment without HPA, metrics-server installed.

#### SITUATION
`notification-service` has 2 replicas. During flash sales, it gets overwhelmed. Platform wants it to scale automatically from 2 to 10 replicas based on CPU.

Create an HPA. Generate load. Watch it scale up. Remove load. Watch it scale down.

#### PLANTED SETUP
- `notification-service` Deployment, 2 replicas, Running.
- `resources.requests.cpu: 100m` set on the container.
- metrics-server installed and working (`kubectl top pods` works).
- Load generator script `~/lab/generate-load.sh`.

#### INVESTIGATION (light)
- `kubectl top pods -n <namespace>` — see current CPU usage.
- Confirm no HPA exists: `kubectl get hpa`.

#### TASKS (heavy)
1. Open the Guide. Understand HPA, metrics-server, and target utilization.
2. Create the HPA:
   ```bash
   kubectl autoscale deployment notification-service --min=2 --max=10 --cpu-percent=50
   ```
3. Verify HPA:
   ```bash
   kubectl get hpa notification-service
   ```
4. Generate load:
   ```bash
   ~/lab/generate-load.sh &
   ```
5. Watch scaling:
   ```bash
   kubectl get hpa -w
   # Also: kubectl get pods -w
   ```
6. Confirm replicas increased (may take 1-2 minutes).
7. Stop load: kill the load generator.
8. Watch scale down (takes longer due to stabilization window).
9. Investigation: Why does scale-down take longer than scale-up? What is the stabilization window?
10. Submit.

#### GRADING
- HPA exists with correct min/max/target.
- Under load, replicas increased beyond 2.
- After load removed, replicas decreased back toward 2.
- Investigation explains scale-down delay (stabilization window, cooldown).

#### LEARNING OBJECTIVES
- Configure Horizontal Pod Autoscaler.
- Understand the relationship between HPA and metrics-server.
- Understand scale-up vs scale-down behavior.

#### IMPLEMENTATION NOTES
- HPA checks metrics every 15 seconds by default.
- Scale-down stabilization window: 5 minutes by default.
- `kubectl describe hpa` shows scaling events.

---

### Lab K8s-Platform-12
**Difficulty:** L1  
**Title:** "Self-Healing: Replicas, Probes, and Recovery"  
**CKA Competency:** Understand the primitives used to create robust, self-healing, application deployments  
**Setup:** Deployment missing probes.

#### SITUATION
`order-processor` has 3 replicas but no probes. When a container hangs (doesn't crash, just stops responding), it stays in the Service and receives traffic → customer errors.

Add:
- Liveness probe: restart the container if it's stuck
- Readiness probe: remove it from the Service if it can't serve traffic

Then simulate a failure and verify self-healing.

#### PLANTED SETUP
- `order-processor` Deployment, 3 replicas, no probes.
- The application has `/healthz` (liveness) and `/ready` (readiness) endpoints.
- A way to make one pod "unhealthy" (e.g., `kubectl exec` to touch a file that breaks the health endpoint).

#### INVESTIGATION (light)
- `kubectl get pods` — all Running, but are they actually healthy?
- `kubectl describe pod` — no probe events.
- Hit the pods directly; confirm they respond.

#### TASKS (heavy)
1. Open the Guide. Understand liveness vs readiness probes.
2. Update the Deployment with probes:
   ```yaml
   livenessProbe:
     httpGet:
       path: /healthz
       port: 8000
     initialDelaySeconds: 5
     periodSeconds: 10
   readinessProbe:
     httpGet:
       path: /ready
       port: 8000
     initialDelaySeconds: 5
     periodSeconds: 5
   ```
3. Apply and wait for rollout.
4. **Test liveness**: Make one pod's `/healthz` fail.
   - Watch: the container gets restarted.
   - Check events: `kubectl describe pod` shows "Liveness probe failed".
5. **Test readiness**: Make one pod's `/ready` fail.
   - Watch: pod stays Running but becomes NotReady.
   - Check endpoints: `kubectl get endpoints` — the unready pod is removed.
6. Restore the pod; verify it rejoins the Service.
7. Investigation: When would you use a startup probe? What happens if liveness fails during a deployment?
8. Submit.

#### GRADING
- Probes added to Deployment.
- Liveness failure → container restart.
- Readiness failure → removed from endpoints (but pod not restarted).
- Pod recovers and rejoins Service.
- Investigation answers cover startup probe use case and liveness during deployment.

#### LEARNING OBJECTIVES
- Implement health checks for self-healing applications.
- Understand the difference between liveness and readiness.
- Verify probe behavior under failure conditions.

#### IMPLEMENTATION NOTES
- Liveness: "Is this container alive?" → restart if no.
- Readiness: "Can this container serve traffic?" → remove from Service if no.
- Startup probe: for slow-starting containers, prevents liveness from killing during boot.

---

### Lab K8s-Platform-13
**Difficulty:** L2  
**Title:** "Admission, Limits, Affinity, and Taints"  
**CKA Competency:** Configure Pod admission and scheduling (limits, node affinity, etc.)  
**Setup:** Cluster with multiple nodes and resource constraints.

#### SITUATION
QuickBite's cluster has:
- A `pci` node for payment workloads (tainted `pci=true:NoSchedule`)
- A `general` node for everything else
- Namespace quotas to prevent resource exhaustion

Configure:
1. A LimitRange that sets default requests for pods without them
2. `payment-handler` to tolerate the `pci` taint and prefer the `pci` node
3. A ResourceQuota so no namespace can request more than 4Gi memory
4. Verify a pod that violates the quota stays Pending

#### PLANTED SETUP
- Two nodes: `general-01`, `pci-01` (tainted).
- `payment-handler` Deployment scheduled on `general-01` (wrong).
- No LimitRange or ResourceQuota in the `payments` namespace.
- A "greedy" deployment manifest that requests 8Gi memory.

#### INVESTIGATION (light)
- `kubectl describe node pci-01` — see the taint.
- `kubectl get pods -o wide` — payment-handler on general-01.
- Try to deploy without requests; see it uses node resources unbounded.

#### TASKS (heavy)
1. Open the Guide. Understand LimitRange, ResourceQuota, taints/tolerations, nodeAffinity.
2. **Create LimitRange** in `payments` namespace:
   ```yaml
   apiVersion: v1
   kind: LimitRange
   metadata:
     name: default-limits
     namespace: payments
   spec:
     limits:
       - default:
           memory: 256Mi
           cpu: 200m
         defaultRequest:
           memory: 128Mi
           cpu: 100m
         type: Container
   ```
3. **Create ResourceQuota** in `payments` namespace:
   ```yaml
   apiVersion: v1
   kind: ResourceQuota
   metadata:
     name: memory-quota
     namespace: payments
   spec:
     hard:
       requests.memory: 4Gi
       limits.memory: 8Gi
   ```
4. **Update payment-handler** with toleration and affinity:
   ```yaml
   tolerations:
     - key: "pci"
       operator: "Equal"
       value: "true"
       effect: "NoSchedule"
   affinity:
     nodeAffinity:
       requiredDuringSchedulingIgnoredDuringExecution:
         nodeSelectorTerms:
           - matchExpressions:
               - key: node-type
                 operator: In
                 values:
                   - pci
   ```
5. Apply and verify `payment-handler` moves to `pci-01`.
6. **Test quota**: Apply the greedy deployment (8Gi request). Verify it stays Pending with quota error.
7. Investigation: What's the difference between `required` and `preferred` affinity? What happens if no node matches a required affinity?
8. Submit.

#### GRADING
- LimitRange creates default requests/limits.
- ResourceQuota enforced; greedy pod Pending.
- `payment-handler` on `pci-01` with correct toleration/affinity.
- Investigation answers explain required vs preferred affinity.

#### LEARNING OBJECTIVES
- Control default resource allocation with LimitRange.
- Prevent resource exhaustion with ResourceQuota.
- Schedule workloads to specific nodes with taints/tolerations and affinity.

#### IMPLEMENTATION NOTES
- Taints repel; tolerations allow.
- Affinity attracts; anti-affinity repels.
- LimitRange applies to new pods; existing pods unchanged.

---

## Chapter 3 — Services & Networking
### CKA Domain Weight: 20%

**Arc:** Pod-to-pod connectivity → NetworkPolicies → Service types → Gateway API → Ingress → CoreDNS.

**Philosophy:** Networking is often the most confusing part of Kubernetes. This chapter demystifies how pods talk to each other, how Services provide stable endpoints, and how traffic enters the cluster.

---

### Lab K8s-Platform-14
**Difficulty:** L1  
**Title:** "Pod-to-Pod: The Flat Network"  
**CKA Competency:** Understand connectivity between Pods  
**Setup:** Multi-node cluster with pods on different nodes.

#### SITUATION
`order-processor` runs on `node-a`. `payment-handler` runs on `node-b`. They need to communicate by pod IP (not through a Service, for this lab). Verify the flat network works.

#### PLANTED SETUP
- Two nodes: `node-a`, `node-b`.
- `order-processor` pod on `node-a`.
- `payment-handler` pod on `node-b`.
- CNI installed and working.

#### INVESTIGATION (light)
- Get pod IPs: `kubectl get pods -o wide`.
- Note they're on different nodes.

#### TASKS (heavy)
1. Open the Guide. Understand the Kubernetes network model (flat network, every pod can reach every pod).
2. Get the IP of `payment-handler` pod.
3. Exec into `order-processor` and ping/curl `payment-handler` by IP:
   ```bash
   kubectl exec order-processor -- curl http://<payment-handler-ip>:8000/health
   ```
4. Verify it works without any Service or special config.
5. Now try from the node itself (SSH to `node-a`, curl the pod IP on `node-b`).
6. Document:
   - Pod CIDR range (from `kubectl cluster-info dump | grep -i cidr` or CNI config)
   - How the CNI enables cross-node pod communication
7. Investigation: What makes Kubernetes networking "flat"? How is this different from Docker's default bridge network?
8. Submit.

#### GRADING
- Cross-node pod-to-pod communication works by IP.
- Documented pod CIDR.
- Investigation explains flat network vs Docker bridge.

#### LEARNING OBJECTIVES
- Understand the Kubernetes network model.
- Verify pod-to-pod connectivity without Services.
- Understand the CNI's role in cross-node communication.

#### IMPLEMENTATION NOTES
- Every pod gets a unique IP from the pod CIDR.
- CNI handles routing between nodes.
- No NAT for pod-to-pod traffic (flat network).

---

### Lab K8s-Platform-15
**Difficulty:** L1  
**Title:** "NetworkPolicy: Only Orders Can Call Payments"  
**CKA Competency:** Define and enforce Network Policies  
**Setup:** All pods can reach all pods (default allow-all).

#### SITUATION
By default, every pod can reach every pod. Security requires that only `order-processor` can reach `payment-handler`. No other pod (including `notification-service`) should be able to call payments.

#### PLANTED SETUP
- `order-processor`, `payment-handler`, `notification-service` pods.
- No NetworkPolicies exist.
- All pods can currently reach all others.

#### INVESTIGATION (light)
- From `notification-service`, curl `payment-handler` — works (bad).
- `kubectl get networkpolicy` — none.

#### TASKS (heavy)
1. Open the Guide. Understand NetworkPolicy syntax (podSelector, ingress, egress).
2. Create a default-deny ingress policy for `payments` namespace:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: default-deny-ingress
     namespace: payments
   spec:
     podSelector: {}
     policyTypes:
       - Ingress
   ```
3. Verify: all ingress to payments is now blocked.
4. Create an allow policy for `order-processor`:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: allow-from-orders
     namespace: payments
   spec:
     podSelector:
       matchLabels:
         app: payment-handler
     ingress:
       - from:
           - namespaceSelector:
               matchLabels:
                 name: orders
             podSelector:
               matchLabels:
                 app: order-processor
         ports:
           - port: 8000
   ```
5. Verify:
   - `order-processor` CAN reach `payment-handler` ✓
   - `notification-service` CANNOT reach `payment-handler` ✗
6. Investigation: How do NetworkPolicies interact (union vs intersection)? What if CNI doesn't support NetworkPolicy?
7. Submit.

#### GRADING
- Default deny in place.
- `order-processor` can reach `payment-handler`.
- `notification-service` is blocked.
- Investigation explains policy union and CNI dependency.

#### LEARNING OBJECTIVES
- Implement network segmentation with NetworkPolicies.
- Understand default-deny patterns.
- Verify policy enforcement.

#### IMPLEMENTATION NOTES
- NetworkPolicies are additive (OR).
- Not all CNIs support NetworkPolicy (Flannel doesn't by default; Calico does).
- Labels on namespaces must exist for namespaceSelector to work.

---

### Lab K8s-Platform-16
**Difficulty:** L1  
**Title:** "ClusterIP, NodePort, LoadBalancer, and Endpoints"  
**CKA Competency:** Use ClusterIP NodePort LoadBalancer service types and endpoints  
**Setup:** Application with no Services.

#### SITUATION
`payment-handler` needs:
- **ClusterIP** for internal cluster access
- **NodePort** for QA team access (from outside cluster, via node IP)
- **LoadBalancer** for partner API access (external LB)

Also, an external database (not in K8s) needs to be reachable via a Service with manually-defined Endpoints.

#### PLANTED SETUP
- `payment-handler` Deployment, no Services.
- External database at `192.168.1.100:5432`.
- Cloud provider or MetalLB for LoadBalancer support.

#### INVESTIGATION (light)
- No Services exist for payment-handler.
- How would you reach it from inside the cluster? From outside?

#### TASKS (heavy)
1. Open the Guide. Understand Service types and when to use each.
2. **Create ClusterIP Service**:
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: payment-handler
   spec:
     type: ClusterIP
     selector:
       app: payment-handler
     ports:
       - port: 80
         targetPort: 8000
   ```
3. **Create NodePort Service** for QA:
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: payment-handler-qa
   spec:
     type: NodePort
     selector:
       app: payment-handler
     ports:
       - port: 80
         targetPort: 8000
         nodePort: 30080
   ```
4. **Create LoadBalancer Service** for partners:
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: payment-handler-external
   spec:
     type: LoadBalancer
     selector:
       app: payment-handler
     ports:
       - port: 80
         targetPort: 8000
   ```
5. **Create headless Service with manual Endpoints** for external DB:
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: external-db
   spec:
     clusterIP: None
     ports:
       - port: 5432
   ---
   apiVersion: v1
   kind: Endpoints
   metadata:
     name: external-db
   subsets:
     - addresses:
         - ip: 192.168.1.100
       ports:
         - port: 5432
   ```
6. Verify each Service works.
7. Investigation: When would you use headless Services? What are Endpoints vs EndpointSlices?
8. Submit.

#### GRADING
- ClusterIP Service works (curl from another pod).
- NodePort accessible on node IP:30080.
- LoadBalancer gets external IP.
- External DB reachable via `external-db` service name.
- Investigation explains headless and Endpoints.

#### LEARNING OBJECTIVES
- Understand and create all Service types.
- Use manual Endpoints for external resources.
- Choose the right Service type for each use case.

#### IMPLEMENTATION NOTES
- ClusterIP: internal only.
- NodePort: allocates a port on every node (30000-32767).
- LoadBalancer: creates external LB (cloud-dependent).
- Headless (clusterIP: None): DNS returns pod IPs, not a virtual IP.

---

### Lab K8s-Platform-17
**Difficulty:** L1  
**Title:** "Gateway API: The Modern Ingress"  
**CKA Competency:** Use the Gateway API to manage Ingress traffic  
**Setup:** Cluster with Gateway API CRDs installed.

#### SITUATION
Gateway API is the modern replacement for Ingress. It's more expressive and role-oriented (infra team manages Gateways, app teams manage HTTPRoutes).

Create a Gateway and HTTPRoutes so:
- `/pay` → `payment-handler`
- `/orders` → `order-processor`

#### PLANTED SETUP
- Gateway API CRDs installed.
- Gateway controller (e.g., Envoy Gateway, Istio) installed.
- `payment-handler` and `order-processor` Services exist.
- No Gateway or HTTPRoutes exist.

#### INVESTIGATION (light)
- `kubectl get gatewayclasses` — see available implementations.
- `kubectl get gateways` — none.

#### TASKS (heavy)
1. Open the Guide. Understand Gateway vs HTTPRoute vs Ingress.
2. **Create Gateway**:
   ```yaml
   apiVersion: gateway.networking.k8s.io/v1
   kind: Gateway
   metadata:
     name: quickbite-gateway
   spec:
     gatewayClassName: <available-class>
     listeners:
       - name: http
         port: 80
         protocol: HTTP
   ```
3. **Create HTTPRoute for payments**:
   ```yaml
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: payment-route
   spec:
     parentRefs:
       - name: quickbite-gateway
     rules:
       - matches:
           - path:
               type: PathPrefix
               value: /pay
         backendRefs:
           - name: payment-handler
             port: 80
   ```
4. **Create HTTPRoute for orders** (similar).
5. Get the Gateway's external address.
6. Test:
   - `curl http://<gateway-ip>/pay` → payment-handler
   - `curl http://<gateway-ip>/orders` → order-processor
7. Investigation: How is Gateway API different from Ingress? What's the role separation?
8. Submit.

#### GRADING
- Gateway created and has an address.
- HTTPRoutes attached to Gateway.
- Routing works correctly.
- Investigation explains Gateway API benefits over Ingress.

#### LEARNING OBJECTIVES
- Use Gateway API for external traffic routing.
- Understand the role-based model (Gateway vs HTTPRoute).
- Compare with traditional Ingress.

#### IMPLEMENTATION NOTES
- Gateway = load balancer + TLS termination (infra team).
- HTTPRoute = routing rules (app team).
- Gateway API is more powerful: traffic splitting, header matching, etc.

---

### Lab K8s-Platform-18
**Difficulty:** L1  
**Title:** "Ingress Controller and Ingress Resources"  
**CKA Competency:** Know how to use Ingress controllers and Ingress resources  
**Setup:** Cluster without an Ingress controller.

#### SITUATION
(Classic Ingress approach, still widely used)

Install `ingress-nginx`. Create an Ingress for `order-processor` so external traffic on `orders.quickbite.local` reaches the app.

#### PLANTED SETUP
- `order-processor` Service exists.
- No Ingress controller installed.
- `orders.quickbite.local` should route to `order-processor`.

#### INVESTIGATION (light)
- `kubectl get pods -n ingress-nginx` — nothing.
- `kubectl get ingress` — none, and even if there were, nothing would serve them.

#### TASKS (heavy)
1. Open the Guide. Understand Ingress vs Ingress Controller.
2. **Install ingress-nginx**:
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
   ```
3. Wait for controller:
   ```bash
   kubectl wait --for=condition=available deployment/ingress-nginx-controller -n ingress-nginx --timeout=120s
   ```
4. **Create Ingress**:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: order-processor-ingress
   spec:
     ingressClassName: nginx
     rules:
       - host: orders.quickbite.local
         http:
           paths:
             - path: /
               pathType: Prefix
               backend:
                 service:
                   name: order-processor
                   port:
                     number: 80
   ```
5. Get Ingress controller's external IP.
6. Test (with /etc/hosts or curl Host header):
   ```bash
   curl -H "Host: orders.quickbite.local" http://<ingress-ip>/
   ```
7. Investigation: Why does an Ingress resource do nothing without a controller?
8. Submit.

#### GRADING
- Ingress controller Running.
- Ingress created with correct host/path.
- Traffic routed correctly.
- Investigation explains the controller/resource relationship.

#### LEARNING OBJECTIVES
- Install and configure an Ingress controller.
- Create Ingress resources for external traffic.
- Understand that Ingress is just config; the controller does the work.

#### IMPLEMENTATION NOTES
- `ingressClassName` matches the controller (nginx, traefik, etc.).
- Without a controller, Ingress resources are ignored.
- TLS can be added with `spec.tls` and a Secret.

---

### Lab K8s-Platform-19
**Difficulty:** L1  
**Title:** "CoreDNS: When Service Names Don't Resolve"  
**CKA Competency:** Understand and use CoreDNS  
**Setup:** Cluster with broken CoreDNS config.

#### SITUATION
Service names don't resolve. Pods can reach each other by IP but not by name. CoreDNS is running, but its ConfigMap has the wrong cluster domain.

Fix it so `payment-handler.payments.svc.cluster.local` resolves.

#### PLANTED SETUP
- CoreDNS running but misconfigured.
- ConfigMap `coredns` in `kube-system` has `kubernetes internal.local` instead of `cluster.local`.
- DNS lookups from pods fail.

#### INVESTIGATION (light)
- `kubectl exec <pod> -- nslookup payment-handler.payments.svc.cluster.local` — fails.
- `kubectl get configmap coredns -n kube-system -o yaml` — spot the wrong domain.

#### TASKS (heavy)
1. Open the Guide. Understand CoreDNS, the Corefile, and how pods use cluster DNS.
2. Check current CoreDNS config:
   ```bash
   kubectl get configmap coredns -n kube-system -o yaml
   ```
3. Identify the problem: `kubernetes internal.local` should be `kubernetes cluster.local`.
4. Fix the ConfigMap:
   ```bash
   kubectl edit configmap coredns -n kube-system
   # Or patch
   ```
5. Restart CoreDNS pods to pick up the change:
   ```bash
   kubectl rollout restart deployment/coredns -n kube-system
   ```
6. Verify:
   ```bash
   kubectl exec <pod> -- nslookup payment-handler.payments.svc.cluster.local
   ```
7. Investigation: What is the full DNS name of a Service? What is `/etc/resolv.conf` in a pod?
8. Submit.

#### GRADING
- CoreDNS ConfigMap has correct domain.
- DNS lookups work for Services.
- Investigation explains Service DNS format and pod resolv.conf.

#### LEARNING OBJECTIVES
- Troubleshoot CoreDNS issues.
- Understand the Corefile syntax.
- Know the full DNS format for Services.

#### IMPLEMENTATION NOTES
- Service DNS: `<service>.<namespace>.svc.<cluster-domain>`
- Default cluster domain: `cluster.local`
- Pods inherit DNS from CoreDNS via `nameserver` in `/etc/resolv.conf`.

---

## Chapter 4 — Storage
### CKA Domain Weight: 10%

**Arc:** StorageClasses and dynamic provisioning → volume types and access modes → PV/PVC management.

**Philosophy:** Stateful workloads need storage. This chapter teaches you how Kubernetes abstracts storage through PVs, PVCs, and StorageClasses.

---

### Lab K8s-Platform-20
**Difficulty:** L1  
**Title:** "Dynamic Provisioning with StorageClass"  
**CKA Competency:** Implement storage classes and dynamic volume provisioning  
**Setup:** Cluster with a CSI driver but no dynamic provisioning.

#### SITUATION
The `order-archive` needs a volume. Currently, an admin has to manually create PVs. Platform wants dynamic provisioning: create a PVC, get a PV automatically.

Create a StorageClass backed by the CSI driver. Create a PVC using that class. Verify a PV is created automatically.

#### PLANTED SETUP
- CSI driver installed (e.g., local-path-provisioner, EBS CSI).
- No StorageClass exists (or none is default).
- `order-archive` pod waiting for a volume.

#### INVESTIGATION (light)
- `kubectl get storageclass` — none or no default.
- `kubectl get pv` — empty.
- `kubectl describe pod order-archive` — waiting for volume.

#### TASKS (heavy)
1. Open the Guide. Understand StorageClass, provisioner, PV, PVC.
2. **Create StorageClass**:
   ```yaml
   apiVersion: storage.k8s.io/v1
   kind: StorageClass
   metadata:
     name: quickbite-storage
   provisioner: <csi-driver-name>  # e.g., rancher.io/local-path
   reclaimPolicy: Delete
   volumeBindingMode: WaitForFirstConsumer
   ```
3. Make it the default (optional):
   ```bash
   kubectl patch storageclass quickbite-storage -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
   ```
4. **Create PVC**:
   ```yaml
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: order-archive-pvc
   spec:
     storageClassName: quickbite-storage
     accessModes:
       - ReadWriteOnce
     resources:
       requests:
         storage: 1Gi
   ```
5. Verify PV created:
   ```bash
   kubectl get pv
   kubectl get pvc
   ```
6. Mount in pod and write data.
7. Investigation: What is `WaitForFirstConsumer`? What is `reclaimPolicy` and why does it matter?
8. Submit.

#### GRADING
- StorageClass created with correct provisioner.
- PVC created and Bound.
- PV created automatically.
- Pod can mount and use the volume.
- Investigation explains binding mode and reclaim policy.

#### LEARNING OBJECTIVES
- Set up dynamic volume provisioning.
- Understand the StorageClass abstraction.
- Configure reclaim policies appropriately.

#### IMPLEMENTATION NOTES
- `WaitForFirstConsumer`: PV created on the node where pod is scheduled.
- `Immediate`: PV created as soon as PVC is created.
- `reclaimPolicy: Retain` keeps data after PVC delete.

---

### Lab K8s-Platform-21
**Difficulty:** L1  
**Title:** "Access Modes and Reclaim Policies"  
**CKA Competency:** Configure volume types access modes and reclaim policies  
**Setup:** PVC with wrong access mode.

#### SITUATION
The archive volume needs:
- `ReadWriteOnce`: only one node can mount it
- `Retain` reclaim policy: data survives PVC deletion

Currently, the PVC has wrong settings. Fix it. Then demonstrate that deleting the PVC leaves the PV and data intact.

#### PLANTED SETUP
- PVC `archive-pvc` with `accessModes: [ReadWriteMany]` (wrong).
- StorageClass with `reclaimPolicy: Delete` (wrong for archives).
- Data in the volume we can't afford to lose.

#### INVESTIGATION (light)
- `kubectl get pvc archive-pvc -o yaml` — wrong access mode.
- `kubectl get storageclass` — Delete policy.

#### TASKS (heavy)
1. Open the Guide. Understand access modes (RWO, ROX, RWX) and reclaim policies.
2. Create a new StorageClass with `Retain`:
   ```yaml
   reclaimPolicy: Retain
   ```
3. Create a new PVC with `ReadWriteOnce` using the new StorageClass.
4. Migrate data from old volume to new (or recreate the pod with new PVC).
5. Delete the old PVC; verify its PV is also deleted (Delete policy).
6. Delete the new PVC; verify its PV is retained (Retain policy).
7. Verify the data is still on the PV:
   ```bash
   kubectl get pv <pv-name> -o yaml
   # status.phase: Released, data still there
   ```
8. Investigation: What are the use cases for each access mode? When would you use Retain vs Delete?
9. Submit.

#### GRADING
- New StorageClass with Retain.
- New PVC with ReadWriteOnce.
- Delete policy PVC: PV deleted.
- Retain policy PVC: PV retained after PVC delete.
- Investigation covers access modes and reclaim use cases.

#### LEARNING OBJECTIVES
- Choose appropriate access modes.
- Understand reclaim policy implications.
- Protect important data with Retain.

#### IMPLEMENTATION NOTES
- RWO: single node read/write (most common).
- ROX: multi-node read-only.
- RWX: multi-node read/write (needs shared storage).
- Released PV can be manually reclaimed and reused.

---

### Lab K8s-Platform-22
**Difficulty:** L1  
**Title:** "Static Provisioning: Create the PV First"  
**CKA Competency:** Manage persistent volumes and persistent volume claims  
**Setup:** Pre-existing storage that needs to be exposed as a PV.

#### SITUATION
An NFS share exists at `nfs.quickbite.local:/exports/data`. It has important data. Create a PV manually, then a PVC that binds to it. Mount it in a pod and verify the data is accessible.

This is "static provisioning" — the admin creates the PV; the PVC claims it.

#### PLANTED SETUP
- NFS server with data at `/exports/data`.
- No PV or PVC exists.
- Pod needs to read the data.

#### INVESTIGATION (light)
- NFS share accessible from nodes.
- `kubectl get pv` — empty.

#### TASKS (heavy)
1. Open the Guide. Understand static vs dynamic provisioning.
2. **Create PV**:
   ```yaml
   apiVersion: v1
   kind: PersistentVolume
   metadata:
     name: nfs-data-pv
   spec:
     capacity:
       storage: 10Gi
     accessModes:
       - ReadWriteMany
     persistentVolumeReclaimPolicy: Retain
     nfs:
       server: nfs.quickbite.local
       path: /exports/data
   ```
3. **Create PVC**:
   ```yaml
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: nfs-data-pvc
   spec:
     accessModes:
       - ReadWriteMany
     resources:
       requests:
         storage: 10Gi
     storageClassName: ""  # Important for static binding
   ```
4. Verify binding:
   ```bash
   kubectl get pvc nfs-data-pvc  # Should be Bound
   kubectl get pv nfs-data-pv    # Should show claim
   ```
5. Mount in pod and verify data access:
   ```yaml
   volumes:
     - name: nfs-data
       persistentVolumeClaim:
         claimName: nfs-data-pvc
   ```
6. Read a file from the mount.
7. Investigation: When would you use static provisioning? Why `storageClassName: ""`?
8. Submit.

#### GRADING
- PV created with NFS details.
- PVC binds to PV.
- Pod mounts and reads data.
- Investigation explains static provisioning use cases.

#### LEARNING OBJECTIVES
- Manually create PersistentVolumes.
- Bind PVCs to specific PVs.
- Access pre-existing data through Kubernetes.

#### IMPLEMENTATION NOTES
- `storageClassName: ""` prevents dynamic provisioning.
- PV capacity should match or exceed PVC request.
- Access modes must match between PV and PVC.

---

## Chapter 5 — Troubleshooting
### CKA Domain Weight: 30%

**Arc:** Node issues → control plane issues → resource usage → container logs → service/network issues.

**Philosophy:** 30% of the CKA is troubleshooting. This chapter is intensive: broken clusters, failing components, unhealthy nodes. You learn to diagnose systematically.

---

### Lab K8s-Platform-23
**Difficulty:** L1  
**Title:** "A Node Won't Join: Fix NotReady"  
**CKA Competency:** Troubleshoot clusters and nodes  
**Setup:** Node in NotReady state.

#### SITUATION
`node-b` is `NotReady`. The API is fine (other nodes work). Pods are stuck on other nodes because they need to schedule on node-b. Bring it back to Ready without deleting the Node object.

#### PLANTED SETUP
- Control plane `cp-01` healthy.
- `node-a` Ready, `node-b` NotReady.
- kubelet on `node-b` is stopped (or misconfigured).
- `order-processor` pods Pending because they need node-b.

#### INVESTIGATION (light)
- `kubectl get nodes` — node-b NotReady.
- `kubectl describe node node-b` — check Conditions, look for kubelet errors.
- SSH to node-b: `systemctl status kubelet`.

#### TASKS (heavy)
1. Open the Guide. Understand node conditions and kubelet role.
2. Check node conditions:
   ```bash
   kubectl describe node node-b | grep -A5 Conditions
   ```
3. SSH to node-b.
4. Check kubelet:
   ```bash
   systemctl status kubelet
   journalctl -u kubelet -n 50
   ```
5. Identify and fix the issue (stopped service, bad config, cert expired, etc.):
   ```bash
   systemctl start kubelet  # if stopped
   # Or fix config and restart
   ```
6. Wait for Ready:
   ```bash
   kubectl wait --for=condition=Ready node/node-b --timeout=120s
   ```
7. Verify pods schedule on node-b.
8. Investigation: What are the main reasons a node goes NotReady? How does the control plane detect it?
9. Submit.

#### GRADING
- node-b is Ready.
- Did not delete the Node object.
- Pods schedule on node-b.
- Investigation lists common NotReady causes (kubelet, network, disk pressure, memory pressure).

#### LEARNING OBJECTIVES
- Diagnose NotReady nodes.
- Understand kubelet's role in node health.
- Restore nodes without cluster disruption.

#### IMPLEMENTATION NOTES
- Common causes: kubelet stopped, cert expired, disk pressure, memory pressure.
- Node heartbeats: kubelet reports status every 10s; NotReady after 40s of silence.
- `kubectl get nodes -o yaml` shows detailed conditions.

---

### Lab K8s-Platform-24
**Difficulty:** L2  
**Title:** "The Scheduler Is Down: Nothing New Runs"  
**CKA Competency:** Troubleshoot cluster components  
**Setup:** Broken scheduler static pod.

#### SITUATION
New pods stay `Pending` with "no nodes available to schedule." Existing pods keep running. The scheduler static pod is crashlooping due to a bad flag in its manifest.

Fix the scheduler without touching running workloads.

#### PLANTED SETUP
- Control plane with static pods.
- `kube-scheduler` static pod crashlooping.
- `/etc/kubernetes/manifests/kube-scheduler.yaml` has a typo in a flag.
- New pods Pending, existing pods Running.

#### INVESTIGATION (light)
- `kubectl get pods -n kube-system` — scheduler pods crashlooping.
- `kubectl describe pod kube-scheduler-cp-01 -n kube-system` — error in args.
- `kubectl logs kube-scheduler-cp-01 -n kube-system` — flag error.

#### TASKS (heavy)
1. Open the Guide. Understand static pods and control plane components.
2. Check scheduler status:
   ```bash
   kubectl get pods -n kube-system | grep scheduler
   ```
3. Get the error:
   ```bash
   kubectl logs kube-scheduler-cp-01 -n kube-system
   # Look for "unknown flag" or similar
   ```
4. SSH to control plane.
5. Check the manifest:
   ```bash
   cat /etc/kubernetes/manifests/kube-scheduler.yaml
   ```
6. Find and fix the typo (e.g., `--kubeconfig` vs `--kube-config`).
7. kubelet will automatically restart the static pod.
8. Wait for scheduler to be Running.
9. Verify Pending pods get scheduled.
10. Investigation: What are static pods? Why does editing the manifest restart the pod?
11. Submit.

#### GRADING
- Scheduler Running.
- Did not restart kubelet or reboot (just fixed manifest).
- Pending pods scheduled.
- Investigation explains static pods and manifest watching.

#### LEARNING OBJECTIVES
- Troubleshoot control plane component failures.
- Understand static pods and their manifests.
- Fix issues without cluster-wide disruption.

#### IMPLEMENTATION NOTES
- Static pods: kubelet watches `/etc/kubernetes/manifests/`.
- Changes to manifest trigger pod recreation.
- Control plane components: api-server, scheduler, controller-manager, etcd (all static pods).

---

### Lab K8s-Platform-25
**Difficulty:** L1  
**Title:** "OOMKilled: Reading Resource Usage"  
**CKA Competency:** Monitor cluster and application resource usage  
**Setup:** Pod being OOMKilled.

#### SITUATION
`payment-handler` keeps restarting. `kubectl describe pod` shows `OOMKilled`. The memory limit is too low. Use `kubectl top` to see actual usage, then raise the limit to the value in the ticket.

#### PLANTED SETUP
- `payment-handler` pod with `limits.memory: 64Mi` (too low).
- Actual usage: ~120Mi.
- metrics-server installed.
- Pod restarting with OOMKilled.

#### INVESTIGATION (light)
- `kubectl get pods` — payment-handler with multiple restarts.
- `kubectl describe pod` — Last State: OOMKilled.
- `kubectl top pod payment-handler` — shows ~120Mi usage.

#### TASKS (heavy)
1. Open the Guide. Understand OOMKilled, limits vs requests.
2. Check pod status:
   ```bash
   kubectl describe pod payment-handler | grep -A3 "Last State"
   ```
3. Check actual usage:
   ```bash
   kubectl top pod payment-handler
   ```
4. Update the Deployment to set `limits.memory: 256Mi` (from ticket).
5. Wait for rollout.
6. Verify pod is stable (no restarts).
7. Monitor usage to ensure it's well below the new limit.
8. Investigation: What's the difference between requests and limits? When is a pod OOMKilled vs evicted?
9. Submit.

#### GRADING
- Memory limit raised to 256Mi.
- Pod stable without OOMKilled.
- Investigation explains requests vs limits and OOM vs eviction.

#### LEARNING OBJECTIVES
- Use metrics-server to monitor resource usage.
- Diagnose OOMKilled containers.
- Right-size resource limits.

#### IMPLEMENTATION NOTES
- `kubectl top` requires metrics-server.
- Requests: scheduler uses for placement.
- Limits: hard cap; OOMKilled if exceeded.
- Eviction: kubelet removes pods when node is under pressure.

---

### Lab K8s-Platform-26
**Difficulty:** L1  
**Title:** "Read the Logs: Crashloop Diagnosis"  
**CKA Competency:** Manage and evaluate container output streams  
**Setup:** Crashlooping pod with multi-container setup.

#### SITUATION
`notification-service` is crashlooping. The main container fails. A sidecar container logs to a separate stream. Find the crash reason in the previous container's logs.

#### PLANTED SETUP
- `notification-service` pod with two containers: `app` (crashing) and `logger` (sidecar).
- `app` container exits with error after a few seconds.
- Error message only visible in logs.

#### INVESTIGATION (light)
- `kubectl get pods` — CrashLoopBackOff.
- `kubectl describe pod` — container restarting.

#### TASKS (heavy)
1. Open the Guide. Understand container logs and `--previous` flag.
2. Get logs from the crashing container:
   ```bash
   kubectl logs notification-service -c app
   ```
3. If container already restarted, get previous logs:
   ```bash
   kubectl logs notification-service -c app --previous
   ```
4. Find the error (e.g., "FATAL: Cannot connect to database").
5. Check the sidecar logs too (separate stream):
   ```bash
   kubectl logs notification-service -c logger
   ```
6. Fix the issue (if it's config-related, update ConfigMap/Secret; otherwise, document the root cause).
7. Verify pod is stable.
8. Investigation: What happens to logs when a container restarts? How long are they retained?
9. Submit.

#### GRADING
- Identified root cause from logs.
- Used `--previous` correctly.
- Distinguished between container streams.
- Investigation explains log retention and multi-container logging.

#### LEARNING OBJECTIVES
- Read container logs effectively.
- Use `--previous` for crashed containers.
- Understand multi-container pod log streams.

#### IMPLEMENTATION NOTES
- Each container has its own log stream.
- `--previous`: logs from the last terminated container.
- Logs retained until pod is deleted (kubelet keeps 2 terminated containers).

---

### Lab K8s-Platform-27
**Difficulty:** L1  
**Title:** "Service Has No Endpoints"  
**CKA Competency:** Troubleshoot services and networking  
**Setup:** Service with selector that doesn't match any pods.

#### SITUATION
`payment-handler` Service exists. Pods are Running. But traffic doesn't reach the pods. The Service has no Endpoints because the selector label doesn't match.

Find and fix the selector mismatch.

#### PLANTED SETUP
- `payment-handler` pods with label `app: payment-handler`.
- `payment-handler` Service with selector `app: payment-handlers` (typo: extra 's').
- Endpoints resource is empty.

#### INVESTIGATION (light)
- `kubectl get endpoints payment-handler` — empty.
- `kubectl get pods -l app=payment-handler` — pods exist.
- `kubectl get svc payment-handler -o yaml | grep selector` — wrong label.

#### TASKS (heavy)
1. Open the Guide. Understand Service selectors and Endpoints.
2. Check Endpoints:
   ```bash
   kubectl get endpoints payment-handler
   # No endpoints listed
   ```
3. Check Service selector:
   ```bash
   kubectl get svc payment-handler -o yaml | grep -A2 selector
   ```
4. Check pod labels:
   ```bash
   kubectl get pods --show-labels
   ```
5. Find the mismatch (selector vs pod labels).
6. Fix the Service selector:
   ```bash
   kubectl patch svc payment-handler -p '{"spec":{"selector":{"app":"payment-handler"}}}'
   ```
7. Verify Endpoints populated:
   ```bash
   kubectl get endpoints payment-handler
   ```
8. Test connectivity.
9. Investigation: What are the three main causes of "Service not working"? (selector, NetworkPolicy, DNS)
10. Submit.

#### GRADING
- Identified selector mismatch.
- Fixed selector.
- Endpoints populated.
- Traffic works.
- Investigation lists three Service failure causes.

#### LEARNING OBJECTIVES
- Debug empty Endpoints.
- Understand the selector → Endpoints relationship.
- Systematic Service troubleshooting.

#### IMPLEMENTATION NOTES
- No Endpoints = selector matches nothing.
- Check: selector, pod labels, pod readiness.
- Also check: NetworkPolicy blocking traffic, DNS issues.

---

## Chapter 6 — Platform Automations
### Control Plane / Automation Labs

**Arc:** Apply namespace from request → refuse bad request → node report → pending pod report → access template → quota → detect drift → reconcile → drain helper → namespace request API.

**Philosophy:** Previous chapters taught you to operate manually. This chapter teaches you to **automate** provisioning, validation, and remediation so the platform runs itself.

---

### Lab K8s-Platform-C1
**Difficulty:** L1  
**Title:** "Apply the Namespace from the Request File"  
**CKA Competency:** Platform automation — declarative namespace provisioning

#### SITUATION
A ticket arrives with a request file for a new team namespace. The file specifies:
- Namespace name
- ResourceQuota (CPU, memory, pod count)
- LimitRange (default requests/limits)
- RBAC (team ServiceAccount + RoleBinding)

Build a tool that reads the request and creates the namespace to spec. Running it twice should be idempotent.

#### PLANTED SETUP
- Request file `~/lab/requests/settlement-request.yaml`.
- Skeleton `~/platform/nsctl.py` with `apply` subcommand stubbed.
- Existing namespaces: `orders`, `payments`, `notifications`.

#### TASKS (heavy)
1. Open the Guide. Understand the request schema.
2. Implement `nsctl apply <request-file>`:
   - Create Namespace
   - Create ResourceQuota
   - Create LimitRange
   - Create ServiceAccount
   - Create Role + RoleBinding
3. Run `apply` for settlement.
4. Run again — should be idempotent ("No changes needed").
5. Verify all resources exist.
6. Investigation: Why a tool instead of raw `kubectl apply`? What does idempotency buy you?
7. Submit.

#### GRADING
- Namespace created with quota, limitrange, RBAC.
- Second run is idempotent.
- Existing namespaces untouched.
- Investigation answers cover tooling benefits.

---

### Lab K8s-Platform-C2
**Difficulty:** L1  
**Title:** "Refuse the Bad Request"  
**CKA Competency:** Platform automation — validation and guardrails

#### SITUATION
Same tool, but now validate requests before applying:
- Reject if requesting `cluster-admin` (only namespace-scoped roles allowed)
- Reject if no ResourceQuota specified (platform policy)
- Reject if memory limit > 4Gi (cluster capacity)

Bad requests must be refused with a clear error. The cluster must be unchanged.

#### PLANTED SETUP
- Valid request: `~/lab/requests/settlement-request.yaml`
- Bad requests:
  - `bad-admin.yaml`: requests cluster-admin
  - `bad-no-quota.yaml`: missing ResourceQuota
  - `bad-too-much-memory.yaml`: requests 16Gi limit

#### TASKS (heavy)
1. Implement validation in `nsctl apply`.
2. On invalid request: print error, exit 1, touch nothing.
3. Test all bad requests — all rejected.
4. Test valid request — applies successfully.
5. Investigation: Why fail closed? What's the cost of a bad namespace getting through?
6. Submit.

#### GRADING
- Bad requests rejected with clear errors.
- Cluster unchanged on rejection.
- Valid request still works.
- Investigation explains fail-closed importance.

---

### Lab K8s-Platform-C3
**Difficulty:** L1  
**Title:** "Ship a Node Health Report"  
**CKA Competency:** Platform automation — monitoring tools

#### SITUATION
Build a CLI that checks node health:
- List any NotReady nodes
- Exit 0 if all healthy, exit 1 if any unhealthy
- Silent on success (for cron/alerting)

This is the on-call check for node health.

#### PLANTED SETUP
- Cluster with 3 nodes, one will be made NotReady.
- Skeleton `~/platform/node-report.py`.

#### TASKS (heavy)
1. Implement `node-report`:
   - Query nodes via API
   - Check Ready condition
   - Print NotReady nodes with reason
   - Exit code based on health
2. Make one node NotReady (stop kubelet).
3. Run report — shows the unhealthy node, exits 1.
4. Fix the node.
5. Run report — silent, exits 0.
6. Submit.

#### GRADING
- Report lists NotReady nodes.
- Exit codes correct.
- Silent when healthy.

---

### Lab K8s-Platform-C4
**Difficulty:** L1  
**Title:** "Ship a Pending Pod Report"  
**CKA Competency:** Platform automation — monitoring tools

#### SITUATION
Build a CLI that checks for Pending pods:
- List Pending pods with reason (Unschedulable, quota exceeded, etc.)
- Exit 0 if none Pending, exit 1 if any Pending
- Include pod name, namespace, and reason

#### PLANTED SETUP
- Cluster with capacity for Pending to happen.
- Skeleton `~/platform/pending-report.py`.
- A deployment that will be scaled beyond capacity.

#### TASKS (heavy)
1. Implement `pending-report`:
   - Query pods across namespaces
   - Filter for Pending
   - Parse conditions for reason
   - Print structured output
2. Create Pending pods (scale beyond capacity or violate quota).
3. Run report — lists them.
4. Fix the Pending state.
5. Run report — silent, exits 0.
6. Submit.

#### GRADING
- Report lists Pending pods with reasons.
- Exit codes correct.
- Handles multiple namespaces.

---

### Lab K8s-Platform-C5
**Difficulty:** L1–L2  
**Title:** "RBAC from the Team Template"  
**CKA Competency:** Platform automation — access control provisioning

#### SITUATION
Build a tool that applies access from a template file:
- `deploy-bot` can update Deployments in `orders`
- `settlement-team` can work in `settlement` only
- Attempting forbidden actions is denied

#### PLANTED SETUP
- Template file `~/platform/access-template.yaml`.
- ServiceAccounts and Roles to create.
- Test cases for allowed/denied operations.

#### TASKS (heavy)
1. Implement template-based RBAC provisioning.
2. Apply template.
3. Verify `deploy-bot` can update Deployments in `orders`.
4. Verify `settlement-team` can work in `settlement`.
5. Verify `deploy-bot` cannot delete Secrets in `payments`.
6. Verify access checks with `kubectl auth can-i`.
7. Submit.

#### GRADING
- RBAC resources created correctly.
- Allowed operations succeed.
- Denied operations fail.

---

### Lab K8s-Platform-C6
**Difficulty:** L1  
**Title:** "Quota the Runaway Namespace"  
**CKA Competency:** Platform automation — resource governance

#### SITUATION
The `replay` namespace is creating pods with no limits and starving the node. Put a ResourceQuota on that namespace only. Don't affect other namespaces.

#### PLANTED SETUP
- `replay` namespace with unlimited pod creation.
- Other namespaces running production workloads.

#### TASKS (heavy)
1. Identify the problem (replay creating unbounded pods).
2. Create ResourceQuota for `replay` only.
3. Verify new pods in `replay` are subject to quota.
4. Verify other namespaces unaffected.
5. Submit.

#### GRADING
- Quota applied to `replay` only.
- Pod creation in `replay` is limited.
- Other namespaces unchanged.

---

### Lab K8s-Platform-C7
**Difficulty:** L1  
**Title:** "Detect Drift Without Fixing It"  
**CKA Competency:** Platform automation — drift detection

#### SITUATION
The desired file says `settlement` has:
- Pod quota: 10
- Default memory limit: 256Mi

The cluster was left without the limit. Build a tool that prints the difference **without changing anything**.

#### PLANTED SETUP
- Desired state file `~/platform/desired/settlement.yaml`.
- Actual state missing the LimitRange.
- Skeleton `~/platform/drift-detect.py`.

#### TASKS (heavy)
1. Implement `drift-detect <namespace>`:
   - Load desired state
   - Query actual state
   - Compare and print differences
   - Do NOT apply changes
2. Run on `settlement` — shows missing LimitRange.
3. Verify nothing was created.
4. Investigation: Why separate detect from reconcile?
5. Submit.

#### GRADING
- Drift detected correctly.
- No changes made to cluster.
- Investigation explains detect/reconcile separation.

---

### Lab K8s-Platform-C8
**Difficulty:** L1  
**Title:** "Reconcile to Desired State"  
**CKA Competency:** Platform automation — drift reconciliation

#### SITUATION
Same drift as C7. Now build `drift-reconcile` that applies the fix and waits until the namespace matches the desired state.

#### PLANTED SETUP
- Same as C7.
- Skeleton `~/platform/drift-reconcile.py`.

#### TASKS (heavy)
1. Implement `drift-reconcile <namespace>`:
   - Detect drift
   - Apply missing/different resources
   - Wait for convergence
   - Exit 0 when clean
2. Run on `settlement` — creates the LimitRange.
3. Run again — "No reconciliation needed".
4. Submit.

#### GRADING
- LimitRange created.
- Second run is idempotent.
- Namespace matches desired state.

---

### Lab K8s-Platform-C9
**Difficulty:** L1–L2  
**Title:** "Drain Helper: Safe Node Evacuation"  
**CKA Competency:** Platform automation — operational tooling

#### SITUATION
Build a drain helper that:
- Cordons the target node
- Drains workloads (respecting PDBs)
- Leaves `payment-handler` serving on other nodes
- **Refuses to drain control plane nodes**

#### PLANTED SETUP
- 3-node cluster (1 CP, 2 workers).
- `payment-handler` with replicas on both workers.
- Skeleton `~/platform/drain-helper.py`.

#### TASKS (heavy)
1. Implement `drain-helper <node>`:
   - Check if node is control plane → refuse
   - Cordon node
   - Drain (ignore DaemonSets, delete local data)
   - Verify workloads rescheduled
2. Test on worker node — succeeds.
3. Test on control plane node — refused.
4. Verify `payment-handler` still serving.
5. Submit.

#### GRADING
- Worker drain succeeds.
- Control plane drain refused.
- Workloads rescheduled.
- `payment-handler` availability maintained.

---

### Lab K8s-Platform-C10
**Difficulty:** L2  
**Title:** "Namespace Request API"  
**CKA Competency:** Platform automation — self-service interface

#### SITUATION
Build a small local API (Flask) that other teams call to request a namespace:
- POST `/namespaces` with request body
- Validates against the same rules as C2
- Creates the namespace with all resources
- Returns success or error

Self-service for app teams, with guardrails.

#### PLANTED SETUP
- Flask installed.
- Skeleton `~/platform/ns-api/app.py`.
- Test client script `~/lab/test-api.sh`.

#### TASKS (heavy)
1. Implement Flask API:
   - `POST /namespaces` — validate + create
   - `GET /namespaces` — list created namespaces
2. Bad request body → 400 with error.
3. Good request body → 201, namespace created.
4. Test with curl/script.
5. Investigation: Why an API instead of kubectl access? Who is the audience?
6. Submit.

#### GRADING
- API accepts valid requests.
- API rejects invalid requests with clear errors.
- Namespaces created correctly.
- Investigation explains self-service value.

---

## Summary of Curriculum

### Chapter Progression

| Chapter | Domain | Weight | Labs | Focus |
| --- | --- | --- | --- | --- |
| 1 | Cluster Architecture, Installation & Configuration | 25% | 8 | RBAC, kubeadm, HA, Helm/Kustomize, CRDs |
| 2 | Workloads & Scheduling | 15% | 5 | Rollouts, ConfigMaps, HPA, probes, affinity |
| 3 | Services & Networking | 20% | 6 | Pod network, NetworkPolicy, Services, Ingress, DNS |
| 4 | Storage | 10% | 3 | StorageClass, PV/PVC, access modes |
| 5 | Troubleshooting | 30% | 5 | Nodes, control plane, resources, logs, services |
| 6 | Platform Automations | — | 10 | Declarative tools, drift detection, self-service |

### Design Principles

- **CKA-aligned**: Every lab maps to a CKA competency.
- **Investigation + Tasks**: Light forensics, heavy hands-on.
- **Coding-heavy in Chapter 6**: Build durable tools, not one-off fixes.
- **Progressive difficulty**: L1 foundations → L2 integration.
- **QuickBite story**: Realistic multi-tenant platform scenarios.

---

**Next steps for implementation:** Hand this file to the implementing agent for packs (`setup.sh`, `grade.sh`, GUIDE, skeletons).
