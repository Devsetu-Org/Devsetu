#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

wrapper="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/submit-store-rollup-driver-mem.sh"' 2>/dev/null || true)"

echo "$wrapper" | grep -E 'spark\.driver\.memoryOverhead=' >/dev/null \
  && ok "driver memoryOverhead set" \
  || fail "set spark.driver.memoryOverhead (recommend ≥384m)"

# Limit must not equal bare 512m plant — require a raised limit (896m+ or 1g/1024m/768m with overhead).
if echo "$wrapper" | grep -E 'spark\.kubernetes\.driver\.limit\.memory=512m' >/dev/null; then
  fail "raise spark.kubernetes.driver.limit.memory above heap alone (limit ≥ heap + overhead)"
fi
echo "$wrapper" | grep -E 'spark\.kubernetes\.driver\.limit\.memory=' >/dev/null \
  && ok "driver limit.memory present and raised" \
  || fail "set spark.kubernetes.driver.limit.memory ≥ heap + overhead"

k8s_driver_succeeded store-rollup-driver-mem \
  && ok "store-rollup-driver-mem driver Succeeded" \
  || fail "need Succeeded store-rollup-driver-mem driver (not OOMKilled)"

got="$(k8s_read_answer symptom | tr -d '\r' | head -1)"
[[ "$got" == "oomkilled" ]] && ok "Investigation: OOMKilled" \
  || fail "Investigation symptom (want oomkilled)"

got="$(k8s_read_answer fix | tr -d '\r' | head -1)"
[[ "$got" == "overhead-and-limit" ]] && ok "Investigation: overhead + limit" \
  || fail "Investigation fix (want overhead-and-limit)"

pass "spark-19 driver OOMKilled — memory vs K8s limits"
