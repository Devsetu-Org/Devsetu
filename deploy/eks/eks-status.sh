#!/usr/bin/env bash
# Print a compact snapshot of the live EKS + IAM wiring (for docs / drift check).
# Usage: ./deploy/eks/eks-status.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=env.sh
source "$ROOT/env.sh"
eks_need_aws

echo "region=$AWS_REGION cluster=$EKS_CLUSTER_NAME"
if ! eks_cluster_exists; then
  echo "status=MISSING"
  exit 0
fi

aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" \
  --query 'cluster.{status:status,version:version,endpoint:endpoint}' --output table

echo ""
echo "nodegroups:"
# Every group on the cluster, not only EKS_NODEGROUPS. Docker and Spark stay out of that
# list so default sleep/wake/destroy leave them alone, but a status check must still show them.
have=","
while IFS= read -r ng; do
  [[ -z "$ng" ]] && continue
  have="${have}${ng},"
  aws eks describe-nodegroup \
    --cluster-name "$EKS_CLUSTER_NAME" \
    --nodegroup-name "$ng" \
    --region "$AWS_REGION" \
    --query 'nodegroup.{name:nodegroupName,status:status,desired:scalingConfig.desiredSize,min:scalingConfig.minSize,max:scalingConfig.maxSize,types:instanceTypes}' \
    --output table
done < <(aws eks list-nodegroups --cluster-name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" \
  --query 'nodegroups[]' --output text | tr '\t' '\n' | sed '/^[[:space:]]*$/d')
while IFS= read -r ng; do
  [[ -z "$ng" ]] && continue
  if [[ "$have" != *",${ng},"* ]]; then
    echo "  $ng: missing"
  fi
done < <(eks_csv_to_lines "$EKS_NODEGROUPS")

echo ""
echo "access entries:"
aws eks list-access-entries --cluster-name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --output table

echo ""
echo "addons:"
aws eks list-addons --cluster-name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" --output table
