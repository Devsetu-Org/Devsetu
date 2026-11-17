#!/usr/bin/env bash
# K8s Platform track — shared helpers for setup.sh and grade.sh
# Source this file from lab scripts: source "$(dirname "$0")/../_lib/lab.sh"

set -euo pipefail

###############################################################################
# Environment variables expected by labs
###############################################################################
: "${LEARNER_NS:?LEARNER_NS required}"       # e.g., kp-<user>
: "${CHALLENGE_ID:?CHALLENGE_ID required}"   # e.g., k8s-platform-01

###############################################################################
# kubectl wrapper scoped to learner namespace
###############################################################################
k() { kubectl -n "$LEARNER_NS" "$@"; }

###############################################################################
# Wait helpers
###############################################################################

# Wait for a deployment to be available
wait_deployment_available() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  local timeout="${3:-120s}"
  kubectl wait --for=condition=available "deployment/$name" -n "$ns" --timeout="$timeout"
}

# Wait for a pod to be ready
wait_pod_ready() {
  local selector="$1"
  local ns="${2:-$LEARNER_NS}"
  local timeout="${3:-120s}"
  kubectl wait --for=condition=ready pod -l "$selector" -n "$ns" --timeout="$timeout"
}

# Wait for a node to be ready
wait_node_ready() {
  local name="$1"
  local timeout="${2:-120s}"
  kubectl wait --for=condition=Ready "node/$name" --timeout="$timeout"
}

###############################################################################
# Node helpers
###############################################################################

# Check if a node is ready
is_node_ready() {
  local name="$1"
  local status
  status=$(kubectl get node "$name" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
  [[ "$status" == "True" ]]
}

# Get node role (control-plane or worker)
get_node_role() {
  local name="$1"
  if kubectl get node "$name" -o jsonpath='{.metadata.labels}' | grep -q 'node-role.kubernetes.io/control-plane'; then
    echo "control-plane"
  else
    echo "worker"
  fi
}

# List all control plane nodes
list_control_plane_nodes() {
  kubectl get nodes -l 'node-role.kubernetes.io/control-plane' -o jsonpath='{.items[*].metadata.name}'
}

# List all worker nodes
list_worker_nodes() {
  kubectl get nodes -l '!node-role.kubernetes.io/control-plane' -o jsonpath='{.items[*].metadata.name}'
}

###############################################################################
# RBAC helpers
###############################################################################

# Check if a subject can perform an action
can_i() {
  local verb="$1"
  local resource="$2"
  local ns="${3:-}"
  local as="${4:-}"
  
  local args=("auth" "can-i" "$verb" "$resource")
  [[ -n "$ns" ]] && args+=("-n" "$ns")
  [[ -n "$as" ]] && args+=("--as=$as")
  
  kubectl "${args[@]}" 2>/dev/null | grep -q "yes"
}

# Get all ClusterRoleBindings for a subject
get_clusterrolebindings_for_subject() {
  local subject="$1"
  kubectl get clusterrolebindings -o json | jq -r ".items[] | select(.subjects[]?.name == \"$subject\") | .metadata.name"
}

###############################################################################
# Resource existence checks
###############################################################################

resource_exists() {
  local kind="$1"
  local name="$2"
  local ns="${3:-$LEARNER_NS}"
  kubectl get "$kind" "$name" -n "$ns" &>/dev/null
}

resource_exists_cluster() {
  local kind="$1"
  local name="$2"
  kubectl get "$kind" "$name" &>/dev/null
}

###############################################################################
# Pod helpers
###############################################################################

# Get pod status (Running, Pending, etc.)
get_pod_status() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl get pod "$name" -n "$ns" -o jsonpath='{.status.phase}' 2>/dev/null
}

# Get container image from a deployment
get_deployment_image() {
  local name="$1"
  local container="${2:-}"
  local ns="${3:-$LEARNER_NS}"
  
  if [[ -n "$container" ]]; then
    kubectl get deployment "$name" -n "$ns" -o jsonpath="{.spec.template.spec.containers[?(@.name==\"$container\")].image}" 2>/dev/null
  else
    kubectl get deployment "$name" -n "$ns" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null
  fi
}

# Get restart count for a pod's container
get_restart_count() {
  local pod="$1"
  local container="${2:-}"
  local ns="${3:-$LEARNER_NS}"
  
  if [[ -n "$container" ]]; then
    kubectl get pod "$pod" -n "$ns" -o jsonpath="{.status.containerStatuses[?(@.name==\"$container\")].restartCount}" 2>/dev/null
  else
    kubectl get pod "$pod" -n "$ns" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null
  fi
}

###############################################################################
# Service helpers
###############################################################################

# Get endpoints count for a service
get_endpoints_count() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl get endpoints "$name" -n "$ns" -o jsonpath='{.subsets[*].addresses}' 2>/dev/null | jq -r 'length // 0'
}

# Check if service has endpoints
service_has_endpoints() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  local count
  count=$(kubectl get endpoints "$name" -n "$ns" -o jsonpath='{.subsets[0].addresses}' 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
  [[ "$count" -gt 0 ]]
}

###############################################################################
# Storage helpers
###############################################################################

# Get PVC status (Bound, Pending, etc.)
get_pvc_status() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl get pvc "$name" -n "$ns" -o jsonpath='{.status.phase}' 2>/dev/null
}

# Get PV status
get_pv_status() {
  local name="$1"
  kubectl get pv "$name" -o jsonpath='{.status.phase}' 2>/dev/null
}

###############################################################################
# kubeadm helpers
###############################################################################

# Get Kubernetes version from a node
get_node_version() {
  local name="$1"
  kubectl get node "$name" -o jsonpath='{.status.nodeInfo.kubeletVersion}' 2>/dev/null
}

# Check if kubeadm cluster is initialized
is_cluster_initialized() {
  kubectl cluster-info &>/dev/null
}

# Get etcd member count (for HA checks)
get_etcd_member_count() {
  local endpoints="${1:-https://127.0.0.1:2379}"
  ETCDCTL_API=3 etcdctl member list \
    --endpoints="$endpoints" \
    --cacert=/etc/kubernetes/pki/etcd/ca.crt \
    --cert=/etc/kubernetes/pki/etcd/server.crt \
    --key=/etc/kubernetes/pki/etcd/server.key 2>/dev/null | wc -l
}

###############################################################################
# Grading helpers
###############################################################################

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
  exit 0
}

warn() {
  echo "WARN: $*" >&2
}

info() {
  echo "INFO: $*"
}

###############################################################################
# Cleanup helpers
###############################################################################

# Delete resources quietly
quiet_delete() {
  local kind="$1"
  local name="$2"
  local ns="${3:-$LEARNER_NS}"
  kubectl delete "$kind" "$name" -n "$ns" --ignore-not-found --grace-period=1 --wait=false &>/dev/null || true
}

quiet_delete_cluster() {
  local kind="$1"
  local name="$2"
  kubectl delete "$kind" "$name" --ignore-not-found --grace-period=1 --wait=false &>/dev/null || true
}

###############################################################################
# Namespace helpers
###############################################################################

# Ensure a namespace exists
ensure_namespace() {
  local ns="$1"
  kubectl get namespace "$ns" &>/dev/null || kubectl create namespace "$ns"
}

# Get resource quota usage
get_quota_used() {
  local resource="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl get resourcequota -n "$ns" -o jsonpath="{.items[0].status.used.$resource}" 2>/dev/null
}

###############################################################################
# Control plane component helpers
###############################################################################

# Check if a control plane component is running
is_component_running() {
  local component="$1"  # e.g., kube-scheduler, kube-controller-manager
  kubectl get pods -n kube-system -l "component=$component" -o jsonpath='{.items[0].status.phase}' 2>/dev/null | grep -q "Running"
}

# Get static pod manifest path
get_static_pod_manifest() {
  local component="$1"
  echo "/etc/kubernetes/manifests/${component}.yaml"
}

###############################################################################
# Metrics helpers (requires metrics-server)
###############################################################################

# Get node CPU usage
get_node_cpu() {
  local name="$1"
  kubectl top node "$name" --no-headers 2>/dev/null | awk '{print $2}'
}

# Get node memory usage
get_node_memory() {
  local name="$1"
  kubectl top node "$name" --no-headers 2>/dev/null | awk '{print $4}'
}

# Get pod CPU usage
get_pod_cpu() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl top pod "$name" -n "$ns" --no-headers 2>/dev/null | awk '{print $2}'
}

# Get pod memory usage
get_pod_memory() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl top pod "$name" -n "$ns" --no-headers 2>/dev/null | awk '{print $3}'
}

###############################################################################
# HPA helpers
###############################################################################

# Get HPA current replicas
get_hpa_replicas() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl get hpa "$name" -n "$ns" -o jsonpath='{.status.currentReplicas}' 2>/dev/null
}

# Get HPA desired replicas
get_hpa_desired() {
  local name="$1"
  local ns="${2:-$LEARNER_NS}"
  kubectl get hpa "$name" -n "$ns" -o jsonpath='{.status.desiredReplicas}' 2>/dev/null
}

###############################################################################
# CoreDNS helpers
###############################################################################

# Get CoreDNS cluster domain from ConfigMap
get_coredns_domain() {
  kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}' 2>/dev/null | grep -oP 'kubernetes \K[^ ]+' | head -1
}

# Test DNS resolution from a pod
test_dns_resolution() {
  local service="$1"
  local ns="${2:-default}"
  local test_pod="${3:-dns-test}"
  
  kubectl run "$test_pod" --image=busybox:1.36 --rm --restart=Never -it --command -- nslookup "$service.$ns.svc.cluster.local" 2>/dev/null
}

###############################################################################
# Investigation answer file helpers
###############################################################################

ANSWERS_FILE="${ANSWERS_FILE:-/home/learner/lab/answers.txt}"

write_answer() {
  local key="$1"
  local value="$2"
  echo "$key=$value" >> "$ANSWERS_FILE"
}

read_answer() {
  local key="$1"
  grep "^$key=" "$ANSWERS_FILE" 2>/dev/null | cut -d= -f2-
}

check_answer() {
  local key="$1"
  local expected="$2"
  local actual
  actual=$(read_answer "$key")
  [[ "$actual" == "$expected" ]]
}

###############################################################################
# Print helpers for setup scripts
###############################################################################

setup_ok() {
  echo "setup ok: $*"
}

setup_fail() {
  echo "setup failed: $*" >&2
  exit 1
}
