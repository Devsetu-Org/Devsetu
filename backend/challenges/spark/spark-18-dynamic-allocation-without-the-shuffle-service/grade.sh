#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

wrapper="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/submit-store-rollup-dynamic.sh"' 2>/dev/null || true)"

# Locked pass path: disable dynamic allocation + static instances ≥ 2.
echo "$wrapper" | grep -E 'spark\.dynamicAllocation\.enabled=false' >/dev/null \
  && ok "dynamicAllocation disabled" \
  || fail "set spark.dynamicAllocation.enabled=false (app workaround; ESS DaemonSet not required)"

echo "$wrapper" | grep -E 'spark\.executor\.instances=([2-9]|[1-9][0-9])' >/dev/null \
  && ok "static spark.executor.instances ≥ 2" \
  || fail "set spark.executor.instances to a static value ≥ 2"

# Must not still enable dyn-alloc as true after a false line? Prefer last wins —
# fail if enabled=true appears without enabled=false (already checked false).
echo "$wrapper" | grep -E 'spark\.dynamicAllocation\.enabled=true' >/dev/null \
  && fail "remove spark.dynamicAllocation.enabled=true (or replace with false)" \
  || ok "no enabled=true left in wrapper"

k8s_driver_succeeded store-rollup-dynamic \
  && ok "store-rollup-dynamic driver Succeeded" \
  || fail "need Succeeded store-rollup-dynamic driver"

got="$(k8s_read_answer rootCause | tr -d '\r' | head -1)"
[[ "$got" == "dyn-alloc-no-ess" ]] && ok "Investigation: dyn-alloc without ESS" \
  || fail "Investigation rootCause (want dyn-alloc-no-ess)"

got="$(k8s_read_answer fix | tr -d '\r' | head -1)"
[[ "$got" == "disable-dyn-alloc" ]] && ok "Investigation: disable dyn-alloc" \
  || fail "Investigation fix (want disable-dyn-alloc)"

pass "spark-18 dynamic allocation without shuffle service"
