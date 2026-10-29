#!/usr/bin/env bash
# Kafka-lab capacity on the devlabs cluster. Idempotent. Same shape as eks-spark.sh:
# an always-on managed node group (labs-kafka, t4g.medium) plus a Karpenter NodePool
# for overflow (labs-kafka-elastic).
#
#   base    create the labs-kafka managed node group + launch template if missing, scale to 1
#           (AWS admin creds: EKS + EC2 launch templates)
#   up      apply labs-kafka-elastic (kubectl; needs Karpenter from eks-karpenter.sh)
#   sleep   park Kafka capacity: elastic limit → 0 and its nodes removed, labs-kafka → 0
#   wake    labs-kafka → 1, then `up`
#   down    delete the trial pod and labs-kafka-elastic; labs-kafka → 0
#   trial   base + the three-broker spike (deploy/eks/kafka/trial-kafka3.yaml), then measure
#   measure re-sample the running spike (kubectl top + cgroup working set + one CLI call)
#
# Not in EKS_NODEGROUPS, so eks-sleep.sh / eks-wake.sh / eks-destroy.sh skip it. Pods must
# select and tolerate devlabs.io/pool=kafka. Park it with this script.
#
# Usage (repo root, kubeconfig from eks-kubeconfig.sh):
#   ./deploy/eks/eks-kafka.sh base
#   ./deploy/eks/eks-kafka.sh trial
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=env.sh
source "$ROOT/env.sh"

export KUBECONFIG="${KUBECONFIG:-$EKS_KUBECONFIG_OUT}"
POOL=labs-kafka-elastic
NS=dl-kafka-spike
POD=kafka-3

base() {
  eks_need_aws
  # shellcheck source=nodegroups.sh
  source "$ROOT/nodegroups.sh"
  ensure_nodegroup labs-kafka
  EKS_WAKE_NODEGROUPS=labs-kafka "$ROOT/eks-wake.sh"
  echo "==> waiting for a Ready labs-kafka node"
  kubectl wait --for=condition=Ready node -l devlabs.io/pool=kafka --timeout=10m
  echo "==> labs-kafka base node"
  kubectl get nodes -l eks.amazonaws.com/nodegroup=labs-kafka \
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
  kubectl apply -f "$ROOT/karpenter/nodepool-kafka.yaml"
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

sleep_kafka() {
  eks_need_aws
  park_elastic
  EKS_NODEGROUPS=labs-kafka "$ROOT/eks-sleep.sh"
}

wake_kafka() {
  eks_need_aws
  EKS_WAKE_NODEGROUPS=labs-kafka "$ROOT/eks-wake.sh"
  echo "==> waiting for a Ready labs-kafka node"
  kubectl wait --for=condition=Ready node -l devlabs.io/pool=kafka --timeout=10m
  kubectl get nodes -l devlabs.io/pool=kafka \
    -L devlabs.io/pool,devlabs.io/tier,node.kubernetes.io/instance-type
  # Overflow is optional. This cluster may not have Karpenter installed.
  if kubectl get crd nodepools.karpenter.sh >/dev/null 2>&1; then
    up
  else
    echo "==> Karpenter CRDs not installed; labs-kafka base node only"
  fi
}

# Block until each broker has logged a clean start, or print why it didn't.
wait_brokers() {
  local i c
  for i in $(seq 1 60); do
    local ready=0
    for c in kafka-0 kafka-1 kafka-2; do
      if kubectl -n "$NS" logs "$POD" -c "$c" 2>/dev/null | grep -q "Kafka Server started"; then
        ready=$((ready + 1))
      fi
    done
    if [[ "$ready" -eq 3 ]]; then
      echo "==> all three brokers started"
      return 0
    fi
    sleep 5
  done
  echo "==> brokers did not all start; recent logs:" >&2
  for c in kafka-0 kafka-1 kafka-2 shell; do
    echo "--- $c" >&2
    kubectl -n "$NS" logs "$POD" -c "$c" --tail=40 >&2 || true
  done
  return 1
}

cgroup_bytes() {
  local c="$1"
  kubectl -n "$NS" exec "$POD" -c "$c" -- cat /sys/fs/cgroup/memory.current 2>/dev/null || echo n/a
}

measure() {
  echo "==> node"
  kubectl get nodes -l devlabs.io/pool=kafka \
    -o custom-columns=NAME:.metadata.name,CPU:.status.allocatable.cpu,MEM:.status.allocatable.memory,PODS:.status.allocatable.pods
  echo "==> pod"
  kubectl -n "$NS" get pod "$POD" -o wide
  echo "==> kubectl top (working set)"
  kubectl -n "$NS" top pod "$POD" --containers || echo "(metrics-server had no sample yet)"
  echo "==> cgroup memory.current"
  local c bytes
  for c in kafka-0 kafka-1 kafka-2 shell; do
    bytes="$(cgroup_bytes "$c")"
    if [[ "$bytes" =~ ^[0-9]+$ ]]; then
      printf '  %s  %s Mi\n' "$c" "$((bytes / 1024 / 1024))"
    else
      printf '  %s  %s\n' "$c" "$bytes"
    fi
  done
  echo "==> CLI: create payments, describe, quorum"
  kubectl -n "$NS" exec "$POD" -c shell -- bash -c '
    set -e
    export PATH="/opt/kafka/bin:$PATH"
    export KAFKA_HEAP_OPTS="-Xms64m -Xmx64m"
    kafka-topics.sh --bootstrap-server 127.0.0.1:9092 --create --if-not-exists \
      --topic payments --partitions 6 --replication-factor 3
    kafka-topics.sh --bootstrap-server 127.0.0.1:9092 --describe --topic payments
    kafka-metadata-quorum.sh --bootstrap-server 127.0.0.1:9092 describe --status
  '
  echo "==> cgroup memory.current after the CLI"
  for c in kafka-0 kafka-1 kafka-2 shell; do
    bytes="$(cgroup_bytes "$c")"
    if [[ "$bytes" =~ ^[0-9]+$ ]]; then
      printf '  %s  %s Mi\n' "$c" "$((bytes / 1024 / 1024))"
    else
      printf '  %s  %s\n' "$c" "$bytes"
    fi
  done
  echo "==> kubectl top after the CLI"
  kubectl -n "$NS" top pod "$POD" --containers || true
}

trial() {
  base
  echo "==> spike pod ($NS/$POD)"
  kubectl apply -f "$ROOT/kafka/trial-kafka3.yaml"
  echo "==> waiting for the pod (image pull on first run)"
  kubectl -n "$NS" wait --for=condition=Ready "pod/$POD" --timeout=10m
  wait_brokers
  # Let the heap settle before the first sample.
  sleep 20
  measure
}

down() {
  echo "==> delete spike"
  kubectl delete namespace "$NS" --ignore-not-found --wait=true --timeout=5m
  echo "==> delete NodePool $POOL (Karpenter terminates its nodes)"
  kubectl delete nodepool "$POOL" --ignore-not-found --wait=true --timeout=10m
  kubectl delete ec2nodeclass "$POOL" --ignore-not-found --wait=true --timeout=10m
  if eks_cluster_exists 2>/dev/null; then
    EKS_NODEGROUPS=labs-kafka "$ROOT/eks-sleep.sh"
  fi
}

case "${1:-}" in
  base) base ;;
  up) up ;;
  sleep) sleep_kafka ;;
  wake) wake_kafka ;;
  trial) trial ;;
  measure) measure ;;
  down) down ;;
  *) echo "usage: $0 base|up|sleep|wake|trial|measure|down" >&2; exit 2 ;;
esac
