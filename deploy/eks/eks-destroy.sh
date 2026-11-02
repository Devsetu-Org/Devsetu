#!/usr/bin/env bash
# Delete managed node groups + EKS cluster (stops ~$73/mo control plane).
# Preserves: App EC2, S3, IAM users/roles/policies, learner homes on EC2.
#
# Usage:
#   ./deploy/eks/eks-destroy.sh          # interactive confirm
#   ./deploy/eks/eks-destroy.sh --yes    # no prompt
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=env.sh
source "$ROOT/env.sh"
eks_need_aws

YES=0
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]]; then
  YES=1
fi

if ! eks_cluster_exists; then
  echo "cluster $EKS_CLUSTER_NAME already gone in $AWS_REGION"
  exit 0
fi

# Every managed node group on the cluster, not only EKS_NODEGROUPS. Docker, Spark, and
# Kafka stay out of that list so sleep/wake leave them alone, but a cluster delete fails
# while any group is still attached.
eks_live_nodegroups() {
  aws eks list-nodegroups \
    --cluster-name "$EKS_CLUSTER_NAME" \
    --region "$AWS_REGION" \
    --query 'nodegroups[]' \
    --output text | tr '\t' '\n' | sed '/^[[:space:]]*$/d; /^None$/d'
}

LIVE_NODEGROUPS="$(eks_live_nodegroups | paste -sd, -)"
if [[ "$YES" -ne 1 ]]; then
  echo "This will DELETE EKS cluster '$EKS_CLUSTER_NAME' and node groups: ${LIVE_NODEGROUPS:-none}"
  echo "App EC2 / S3 / IAM / kube/homes are NOT deleted."
  read -r -p "Type the cluster name to confirm: " ans
  if [[ "$ans" != "$EKS_CLUSTER_NAME" ]]; then
    echo "aborted"
    exit 1
  fi
fi

# Karpenter nodes are plain EC2 instances outside the node groups, so the cluster
# delete would orphan them. Remove balloons (else draining nodes make them Pending and
# Karpenter buys a node mid-destroy), then NodePools (Karpenter terminates its nodes),
# then the controller.
export KUBECONFIG="${KUBECONFIG:-$EKS_KUBECONFIG_OUT}"
if kubectl get crd nodepools.karpenter.sh >/dev/null 2>&1; then
  echo "==> removing Karpenter capacity (balloons, NodePools, NodeClaims)"
  kubectl -n dl-system delete deploy dl-balloon dl-balloon-reserved --ignore-not-found --wait=true
  kubectl delete nodepools --all --wait=true --timeout=10m
  kubectl wait --for=delete nodeclaims --all --timeout=10m 2>/dev/null || true
  helm uninstall karpenter -n kube-system --wait 2>/dev/null || true
fi
KARPENTER_IDS="$(aws ec2 describe-instances --region "$AWS_REGION" \
  --filters "Name=tag-key,Values=karpenter.sh/nodepool" "Name=tag-key,Values=kubernetes.io/cluster/${EKS_CLUSTER_NAME}" \
            "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].InstanceId' --output text)"
if [[ -n "$KARPENTER_IDS" ]]; then
  echo "==> terminating leftover Karpenter instances: $KARPENTER_IDS"
  # shellcheck disable=SC2086
  aws ec2 terminate-instances --region "$AWS_REGION" --instance-ids $KARPENTER_IDS >/dev/null
fi

echo "==> deleting node groups"
while IFS= read -r ng; do
  [[ -z "$ng" ]] && continue
  status="$(aws eks describe-nodegroup \
    --cluster-name "$EKS_CLUSTER_NAME" \
    --nodegroup-name "$ng" \
    --region "$AWS_REGION" \
    --query 'nodegroup.status' --output text 2>/dev/null || true)"
  if [[ -z "$status" ]]; then
    echo "--> nodegroup $ng already gone"
  elif [[ "$status" == "DELETING" ]]; then
    echo "--> nodegroup $ng already deleting"
  else
    echo "--> delete nodegroup $ng"
    aws eks delete-nodegroup \
      --cluster-name "$EKS_CLUSTER_NAME" \
      --nodegroup-name "$ng" \
      --region "$AWS_REGION" >/dev/null
  fi
done < <(eks_live_nodegroups)

echo "==> waiting for node groups to disappear"
for _ in $(seq 1 80); do
  left="$(eks_live_nodegroups | paste -sd' ' -)"
  if [[ -z "$left" ]]; then
    echo "    all node groups gone"
    break
  fi
  echo "    still present: $left"
  sleep 15
done
left="$(eks_live_nodegroups | paste -sd, -)"
if [[ -n "$left" ]]; then
  echo "node groups still attached: $left" >&2
  exit 1
fi

echo "==> deleting cluster $EKS_CLUSTER_NAME"
aws eks delete-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" >/dev/null
echo "==> waiting for cluster delete"
aws eks wait cluster-deleted --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" 2>/dev/null || true

echo "==> destroyed"
echo "    Recreate later:"
echo "      ./deploy/eks/eks-recreate.sh   # wakes system; Kyverno + admission"
echo "      ./deploy/eks/eks-karpenter.sh  # controller + labs-elastic"
echo "      ./deploy/eks/eks-wake.sh       # labs-k8s + labs-linux as needed"
echo "    App EC2 kubeconfig is refreshed at the end of recreate (unless EKS_SKIP_EC2_KUBECONFIG=1)."
