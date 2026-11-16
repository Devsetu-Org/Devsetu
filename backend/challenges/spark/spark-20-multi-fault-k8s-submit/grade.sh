#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

PROD_NS="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/prod-namespace.txt" 2>/dev/null' | tr -d '\r' | head -1)"
PROD_NS="${PROD_NS:-${LEARNER_NS}-prod}"
PULL_SECRET=quickbite-registry-pull
TEAM_HINT="${SPARK_K8S_IMAGE}"

wrapper="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/submit-store-rollup-k8s-capstone.sh"' 2>/dev/null || true)"

echo "$wrapper" | grep -F "$PROD_NS" >/dev/null \
  && ok "wrapper targets prod namespace" \
  || fail "point spark.kubernetes.namespace / NS at prod ($PROD_NS)"

echo "$wrapper" | grep -F 'apache/spark' >/dev/null \
  && fail "still on apache/spark — use team image" \
  || ok "not on apache/spark"

if echo "$wrapper" | grep -E 'spark\.kubernetes\.container\.image=.*spark-k8s-lab|spark\.kubernetes\.container\.image=\"?\$\{?SPARK_K8S_IMAGE' >/dev/null \
  || echo "$wrapper" | grep -F "$TEAM_HINT" >/dev/null; then
  ok "team image set"
else
  fail "set container.image to \$SPARK_K8S_IMAGE"
fi

echo "$wrapper" | grep -E "spark\.kubernetes\.container\.image\.pullSecrets=${PULL_SECRET}" >/dev/null \
  && ok "pullSecrets set" \
  || fail "add pullSecrets=$PULL_SECRET"

echo "$wrapper" | grep -E 'spark\.executor\.memoryOverhead=' >/dev/null \
  && ok "executor memoryOverhead set" \
  || fail "set spark.executor.memoryOverhead"

if echo "$wrapper" | grep -E 'spark\.kubernetes\.executor\.limit\.memory=256m' >/dev/null; then
  fail "raise executor limit.memory above 256m (limit ≥ memory + overhead)"
fi
echo "$wrapper" | grep -E 'spark\.kubernetes\.executor\.limit\.memory=' >/dev/null \
  && ok "executor limit raised" \
  || fail "set spark.kubernetes.executor.limit.memory"

k8s_driver_succeeded store-rollup-k8s-capstone "$PROD_NS" \
  && ok "capstone driver Succeeded in prod" \
  || fail "need Succeeded store-rollup-k8s-capstone driver in $PROD_NS"

got="$(k8s_read_answer layer1 | tr -d '\r' | head -1)"
[[ "$got" == "namespace" ]] && ok "Investigation layer1 namespace" \
  || fail "Investigation layer1 (want namespace)"

got="$(k8s_read_answer layer2 | tr -d '\r' | head -1)"
[[ "$got" == "image" ]] && ok "Investigation layer2 image" \
  || fail "Investigation layer2 (want image)"

got="$(k8s_read_answer layer3 | tr -d '\r' | head -1)"
[[ "$got" == "memory" ]] && ok "Investigation layer3 memory" \
  || fail "Investigation layer3 (want memory)"

pass "spark-20 multi-fault K8s submit"
