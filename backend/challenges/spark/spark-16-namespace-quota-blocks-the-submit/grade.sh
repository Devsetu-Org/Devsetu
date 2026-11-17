#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

PROD_NS="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/prod-namespace.txt" 2>/dev/null' | tr -d '\r' | head -1)"
PROD_NS="${PROD_NS:-${LEARNER_NS}-prod}"

# Must keep the quota object (no raising / deleting the guardrail).
kubectl -n "$LEARNER_NS" get resourcequota team-spark-quota >/dev/null 2>&1 \
  && ok "team-spark-quota still present" \
  || fail "do not delete ResourceQuota team-spark-quota"

hog_gone=0
kubectl -n "$LEARNER_NS" get pod debug-memory-hog >/dev/null 2>&1 || hog_gone=1

wrapper="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/submit-store-rollup-quota.sh"' 2>/dev/null || true)"

used_prod=0
echo "$wrapper" | grep -F "$PROD_NS" >/dev/null && used_prod=1
# Also accept SPARK_K8S_TARGET_NS exported in a wrapper env file / notes path
env_hint="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/submit-env.sh" 2>/dev/null; true' || true)"
echo "$env_hint" | grep -F "$PROD_NS" >/dev/null && used_prod=1

if [[ "$hog_gone" -eq 1 || "$used_prod" -eq 1 ]]; then
  ok "quota freed (hog deleted) or submit targets prod ns"
else
  fail "delete debug-memory-hog or retarget submit to prod namespace $PROD_NS"
fi

ok_driver=0
k8s_driver_succeeded store-rollup-quota "$LEARNER_NS" && ok_driver=1
k8s_driver_succeeded store-rollup-quota "$PROD_NS" && ok_driver=1
[[ "$ok_driver" -eq 1 ]] \
  && ok "store-rollup-quota driver Succeeded" \
  || fail "need Succeeded store-rollup-quota driver in team or prod namespace"

got="$(k8s_read_answer blocker | tr -d '\r' | head -1)"
[[ "$got" == "quota-hog" ]] && ok "Investigation: blocker is quota + hog" \
  || fail "Investigation blocker (want quota-hog)"

got="$(k8s_read_answer fix | tr -d '\r' | head -1)"
[[ "$got" == "delete-hog" || "$got" == "use-prod" ]] && ok "Investigation: fix chosen" \
  || fail "Investigation fix (want delete-hog or use-prod)"

pass "spark-16 namespace quota blocks the submit"
