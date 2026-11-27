#!/usr/bin/env bash
# Data Engineer Spark Labs capacity on the devlabs cluster. Idempotent.
# Same shape as eks-spark.sh (Platforms): always-on managed node group
# labs-spark-de (t4g.medium) plus Karpenter overflow labs-spark-de-elastic.
# Separate pool label (spark-de) so DE and Platforms Spark do not share nodes.
#
#   base   create labs-spark-de managed node group + launch template if missing, scale to 1
#   up     apply labs-spark-de-elastic (kubectl; needs Karpenter from eks-karpenter.sh)
#   sleep  park: elastic limit → 0 and its nodes removed, labs-spark-de → 0
#   wake   labs-spark-de → 1, then `up`
#   down   delete labs-spark-de-elastic; labs-spark-de → 0
#
# Not in EKS_NODEGROUPS, so eks-sleep.sh / eks-wake.sh skip it. Pods must select and
# tolerate devlabs.io/pool=spark-de.
#
# Usage (repo root, kubeconfig from eks-kubeconfig.sh):
#   ./deploy/eks/eks-spark-de.sh base && ./deploy/eks/eks-spark-de.sh up
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=env.sh
source "$ROOT/env.sh"

export KUBECONFIG="${KUBECONFIG:-$EKS_KUBECONFIG_OUT}"
POOL=labs-spark-de-elastic
NG=labs-spark-de

base() {
  eks_need_aws
  # shellcheck source=nodegroups.sh
  source "$ROOT/nodegroups.sh"
  ensure_nodegroup "$NG"
  EKS_WAKE_NODEGROUPS="$NG" "$ROOT/eks-wake.sh"
  echo "==> $NG base node"
  kubectl get nodes -l eks.amazonaws.com/nodegroup="$NG" \
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
  kubectl apply -f "$ROOT/karpenter/nodepool-spark-de.yaml"
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

sleep_spark_de() {
  eks_need_aws
  park_elastic
  EKS_NODEGROUPS="$NG" "$ROOT/eks-sleep.sh"
}

wake_spark_de() {
  eks_need_aws
  EKS_WAKE_NODEGROUPS="$NG" "$ROOT/eks-wake.sh"
  if kubectl get crd nodepools.karpenter.sh >/dev/null 2>&1; then
    up
  else
    echo "==> Karpenter CRDs not installed; $NG base node only"
  fi
}

down() {
  if kubectl get crd nodepools.karpenter.sh >/dev/null 2>&1; then
    echo "==> delete NodePool $POOL (Karpenter terminates its nodes)"
    kubectl delete nodepool "$POOL" --ignore-not-found --wait=true --timeout=10m
    kubectl delete ec2nodeclass "$POOL" --ignore-not-found --wait=true --timeout=10m
  else
    echo "==> Karpenter is not installed; no NodePool to delete"
  fi
  if eks_cluster_exists 2>/dev/null; then
    EKS_NODEGROUPS="$NG" "$ROOT/eks-sleep.sh"
  fi
}

case "${1:-}" in
  base) base ;;
  up) up ;;
  sleep) sleep_spark_de ;;
  wake) wake_spark_de ;;
  down) down ;;
  *) echo "usage: $0 base|up|sleep|wake|down" >&2; exit 2 ;;
esac
