#!/usr/bin/env bash
# Projects-module infrastructure on the devlabs cluster. Idempotent. Same shape as
# eks-linux.sh / eks-docker.sh: an always-on managed node group (labs-projects) plus a
# Karpenter NodePool for overflow (labs-projects-elastic). Instance type: t4g.small.
#
#   base     create labs-projects + launch template if missing, scale to 1
#            (AWS admin for the NG; kubectl for the spike later)
#   up       apply labs-projects-elastic only (needs Karpenter from eks-karpenter.sh)
#   sleep    park Projects capacity: elastic limit → 0 and its nodes removed, labs-projects → 0
#   wake     labs-projects → 1, then `up` (restores elastic)
#   spike    base + start the phase-0 spike box (deploy/eks/projects/spike.yaml), then check
#   check    re-run the capability checks against the running spike box
#   down     delete the spike box and labs-projects-elastic; labs-projects → 0
#
# Needs kubeconfig from eks-kubeconfig.sh. Spike needs the image
#   ./images/build-all.sh projects-lab
#   (or a local docker build + kind/minikube load — see images/projects-lab/README.md)
#
# Usage (repo root) — YOU run these once the cluster is up; do not auto-run from agents:
#   ./deploy/eks/eks-projects.sh base
#   ./deploy/eks/eks-projects.sh up
#   ./deploy/eks/eks-projects.sh spike
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=env.sh
source "$ROOT/env.sh"

export KUBECONFIG="${KUBECONFIG:-$EKS_KUBECONFIG_OUT}"
NS=dl-projects-spike
PODS=(box-projects)
POOL=labs-projects-elastic

base() {
  eks_need_aws
  # shellcheck source=nodegroups.sh
  source "$ROOT/nodegroups.sh"
  ensure_nodegroup labs-projects
  EKS_WAKE_NODEGROUPS=labs-projects "$ROOT/eks-wake.sh"
  echo "==> waiting for a Ready labs-projects node"
  kubectl wait --for=condition=Ready node -l devlabs.io/pool=projects --timeout=10m
  echo "==> labs-projects base node"
  kubectl get nodes -l eks.amazonaws.com/nodegroup=labs-projects \
    -L devlabs.io/pool,devlabs.io/tier,node.kubernetes.io/instance-type
}

up() {
  local kind
  for kind in nodepool ec2nodeclass; do
    if [[ -n "$(kubectl get "$kind" "$POOL" -o jsonpath='{.metadata.deletionTimestamp}' 2>/dev/null)" ]]; then
      echo "==> waiting for $kind $POOL to finish deleting"
      kubectl wait --for=delete "$kind/$POOL" --timeout=10m
    fi
  done
  echo "==> EC2NodeClass + NodePool $POOL"
  kubectl apply -f "$ROOT/karpenter/nodepool-projects.yaml"
  kubectl get ec2nodeclass "$POOL"
  kubectl get nodepool "$POOL"
}

park_elastic() {
  if kubectl get nodepool "$POOL" >/dev/null 2>&1; then
    echo "==> NodePool $POOL: cpu limit → 0, remove its nodes"
    kubectl patch nodepool "$POOL" --type merge -p '{"spec":{"limits":{"cpu":"0"}}}'
    kubectl delete nodeclaims -l "karpenter.sh/nodepool=$POOL" --wait=true --timeout=10m
  fi
}

sleep_projects() {
  eks_need_aws
  park_elastic
  EKS_NODEGROUPS=labs-projects "$ROOT/eks-sleep.sh"
}

wake_projects() {
  eks_need_aws
  EKS_WAKE_NODEGROUPS=labs-projects "$ROOT/eks-wake.sh"
  echo "==> waiting for a Ready labs-projects node"
  kubectl wait --for=condition=Ready node -l devlabs.io/pool=projects --timeout=10m
  up
}

# name|command (runs as learner inside the box)
CHECKS=(
  "runs as learner|[ \"\$(id -un)\" = learner ]"
  "go toolchain|go version | grep -q go1"
  "python3|python3 -c 'print(1)'"
  "g++|g++ --version >/dev/null"
  "make|make --version >/dev/null"
  "work dir writable|touch /home/learner/work/.spike && rm -f /home/learner/work/.spike"
  "go compile|d=\$(mktemp -d) && (cd \$d && go mod init spike >/dev/null && printf '%s\n' 'package main' 'func main() {}' > main.go && go build -o /tmp/spike-go .) && rm -rf \$d /tmp/spike-go"
  "c++ compile|d=\$(mktemp -d) && printf '%s\n' 'int main(){return 0;}' > \$d/m.cc && g++ -std=c++17 -o /tmp/spike-cpp \$d/m.cc && rm -rf \$d /tmp/spike-cpp"
  "public internet blocked (needs NetworkPolicy agent)|! curl -s --max-time 5 -o /dev/null https://example.com"
)

check_pod() {
  local pod="$1" entry name cmd
  if ! kubectl -n "$NS" get pod "$pod" -o jsonpath='{.status.containerStatuses[0].state.running}' 2>/dev/null | grep -q .; then
    echo "--- $pod: not running"
    kubectl -n "$NS" get pod "$pod" -o wide || true
    kubectl -n "$NS" logs "$pod" --tail=30 2>/dev/null || true
    return
  fi
  echo "--- $pod ($(kubectl -n "$NS" get pod "$pod" -o jsonpath='{.spec.nodeName}'))"
  for entry in "${CHECKS[@]}"; do
    name="${entry%%|*}"
    cmd="${entry#*|}"
    # Image USER is learner (uid 1000); no -u needed.
    if kubectl -n "$NS" exec "$pod" -- bash -lc "$cmd" >/dev/null 2>&1; then
      printf '  PASS  %s\n' "$name"
    else
      printf '  FAIL  %s\n' "$name"
    fi
  done
  echo "  go:      $(kubectl -n "$NS" exec "$pod" -- go version 2>/dev/null || echo n/a)"
  echo "  python:  $(kubectl -n "$NS" exec "$pod" -- python3 --version 2>/dev/null || echo n/a)"
  echo "  memory:  $(kubectl -n "$NS" top pod "$pod" --no-headers 2>/dev/null | awk '{print $3}' || echo n/a)"
}

check() {
  local pod
  for pod in "${PODS[@]}"; do
    check_pod "$pod"
  done
}

spike() {
  base
  echo "==> spike box ($NS)"
  kubectl apply -f "$ROOT/projects/spike.yaml"
  echo "==> waiting for the box (image pull on first run — push projects-lab first)"
  local pod
  for pod in "${PODS[@]}"; do
    kubectl -n "$NS" wait --for=condition=Ready "pod/$pod" --timeout=6m || true
  done
  check
}

down() {
  echo "==> delete spike box"
  kubectl delete namespace "$NS" --ignore-not-found --wait=true
  if kubectl get crd nodepools.karpenter.sh >/dev/null 2>&1; then
    echo "==> delete NodePool $POOL (Karpenter terminates its nodes)"
    kubectl delete nodepool "$POOL" --ignore-not-found --wait=true --timeout=10m
    kubectl delete ec2nodeclass "$POOL" --ignore-not-found --wait=true --timeout=10m
  else
    echo "==> Karpenter is not installed; no NodePool to delete"
  fi
  if eks_cluster_exists 2>/dev/null; then
    EKS_NODEGROUPS=labs-projects "$ROOT/eks-sleep.sh"
  fi
}

case "${1:-}" in
  base) base ;;
  up) up ;;
  sleep) sleep_projects ;;
  wake) wake_projects ;;
  spike) spike ;;
  check) check ;;
  down) down ;;
  *) echo "usage: $0 base|up|sleep|wake|spike|check|down" >&2; exit 2 ;;
esac
