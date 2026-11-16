#!/usr/bin/env bash
# Spark-15: repaired wrapper + Succeeded store-rollup-k8s driver + investigation.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

ANSWERS="$HOME/answers"
# grade runs on controller; answers were written into the shell pod.
read_answer() {
  local key=$1
  kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
    bash -c "test -f \"\$HOME/answers/$key\" && cat \"\$HOME/answers/$key\"" 2>/dev/null || true
}

wrapper="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/submit-store-rollup-k8s.sh"' 2>/dev/null || true)"

echo "$wrapper" | grep -E 'spark\.executor\.instances=2' >/dev/null \
  && ok "wrapper sets spark.executor.instances=2" \
  || fail "wrapper must set spark.executor.instances=2 (uncomment/finish the TODO)"

echo "$wrapper" | grep -E 'spark\.executor\.memory=512m' >/dev/null \
  && ok "wrapper sets executor memory 512m" \
  || fail "wrapper must set spark.executor.memory=512m"

echo "$wrapper" | grep -E 'spark\.executor\.cores=1' >/dev/null \
  && ok "wrapper sets executor cores 1" \
  || fail "wrapper must set spark.executor.cores=1"

echo "$wrapper" | grep -E '^[[:space:]]*#[[:space:]]*--conf spark\.executor\.instances' >/dev/null \
  && fail "executor instances line is still commented out" \
  || ok "executor instances conf is active"

# A Succeeded driver whose name starts with store-rollup-k8s
drivers="$(kubectl -n "$SPARK_K8S_NS" get pods -l spark-role=driver \
  -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{.status.phase}{"\n"}{end}' 2>/dev/null || true)"
echo "$drivers" | grep -E '^store-rollup-k8s.*\|Succeeded' >/dev/null \
  && ok "store-rollup-k8s driver pod Succeeded" \
  || fail "need a Succeeded driver pod named store-rollup-k8s-… (run the repaired submit)"

# Investigation (minimal for orientation)
expect_ans() {
  local key=$1 want=$2 label=$3
  local got
  got="$(read_answer "$key" | tr -d '\r' | head -1)"
  if [[ "$got" == "$want" ]]; then
    ok "$label"
  else
    fail "$label (got '${got:-empty}', want '$want')"
  fi
}

expect_ans resourceManager k8s "Investigation: resource manager is Kubernetes"
expect_ans deployMode cluster "Investigation: deploy mode is cluster"
expect_ans killExecutor replaced "Investigation: killed executor was replaced"

pass "spark-15 driver/executor pods on Kubernetes"
