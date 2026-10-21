#!/usr/bin/env bash
# Spark Labs capacity on the devlabs cluster. Idempotent. Same shape as eks-docker.sh:
# an always-on managed node group (labs-spark, t4g.medium) plus a Karpenter NodePool
# for overflow (labs-spark-elastic).
#
#   base   create the labs-spark managed node group + launch template if missing, scale to 1
#          (AWS admin creds: EKS + EC2 launch templates)
#   up     apply labs-spark-elastic (kubectl; needs Karpenter from eks-karpenter.sh)
#   sleep  park Spark capacity: elastic limit → 0 and its nodes removed, labs-spark → 0
#   wake   labs-spark → 1, then `up`
#   down   delete labs-spark-elastic; labs-spark → 0
#
# Not in EKS_NODEGROUPS, so eks-sleep.sh / eks-wake.sh skip it. Pods must select and
# tolerate devlabs.io/pool=spark.
#
# Usage (repo root, kubeconfig from eks-kubeconfig.sh):
#   ./deploy/eks/eks-spark.sh base && ./deploy/eks/eks-spark.sh up
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=env.sh
source "$ROOT/env.sh"

export KUBECONFIG="${KUBECONFIG:-$EKS_KUBECONFIG_OUT}"
POOL=labs-spark-elastic

base() {
  eks_need_aws
  # shellcheck source=nodegroups.sh
  source "$ROOT/nodegroups.sh"
  ensure_nodegroup labs-spark
  EKS_WAKE_NODEGROUPS=labs-spark "$ROOT/eks-wake.sh"
  echo "==> labs-spark base node"
  kubectl get nodes -l eks.amazonaws.com/nodegroup=labs-spark \
    -L devlabs.io/pool,devlabs.io/tier,node.kubernetes.io/instance-type
}

up() {
  # Applying while a previous `down` is still finalizing leaves the NodePool pointing at
  # a deleted EC2NodeClass (pods stay Pending with "NodeClass not found").
  local kind
  for kind in nodepool ec2nodeclass; do
    if [[ -n "$(kubectl get "$kind" "$POOL" -o jsonpath='{.metadata.deletionTimestamp}' 2>/dev/null)" ]]; then
      echo "==> waiting for $kind $POOL to finish deleting"
      kubectl wait --for=delete "$kind/$POOL" --timeout=10m
    fi
  done
  echo "==> EC2NodeClass + NodePool $POOL"
  kubectl apply -f "$ROOT/karpenter/nodepool-spark.yaml"
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

sleep_spark() {
  eks_need_aws
  park_elastic
  EKS_NODEGROUPS=labs-spark "$ROOT/eks-sleep.sh"
}

wake_spark() {
  eks_need_aws
  EKS_WAKE_NODEGROUPS=labs-spark "$ROOT/eks-wake.sh"
  up
}

down() {
  echo "==> delete NodePool $POOL (Karpenter terminates its nodes)"
  kubectl delete nodepool "$POOL" --ignore-not-found --wait=true --timeout=10m
  kubectl delete ec2nodeclass "$POOL" --ignore-not-found --wait=true --timeout=10m
  if eks_cluster_exists 2>/dev/null; then
    EKS_NODEGROUPS=labs-spark "$ROOT/eks-sleep.sh"
  fi
}

case "${1:-}" in
  base) base ;;
  up) up ;;
  sleep) sleep_spark ;;
  wake) wake_spark ;;
  down) down ;;
  *) echo "usage: $0 base|up|sleep|wake|down" >&2; exit 2 ;;
esac
