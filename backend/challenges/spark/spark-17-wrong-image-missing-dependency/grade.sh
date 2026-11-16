#!/usr/bin/env bash
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

PULL_SECRET=quickbite-registry-pull
TEAM_HINT="${SPARK_K8S_IMAGE}"

wrapper="$(kubectl -n "$LEARNER_NS" exec "$SPARK_POD" -c "$SHELL_CONTAINER" -- \
  bash -c 'cat "$HOME/lab/submit-store-rollup-deps.sh"' 2>/dev/null || true)"

echo "$wrapper" | grep -F 'apache/spark' >/dev/null \
  && fail "wrapper still points at apache/spark — use the team image (\$SPARK_K8S_IMAGE)" \
  || ok "wrapper no longer uses apache/spark"

# Accept explicit team image or \$SPARK_K8S_IMAGE expansion in the script.
if echo "$wrapper" | grep -E 'spark\.kubernetes\.container\.image=.*spark-k8s-lab|spark\.kubernetes\.container\.image=\"?\$\{?SPARK_K8S_IMAGE' >/dev/null \
  || echo "$wrapper" | grep -F "$TEAM_HINT" >/dev/null; then
  ok "wrapper uses team / SPARK_K8S_IMAGE"
else
  fail "set spark.kubernetes.container.image to the team lab image"
fi

echo "$wrapper" | grep -E "spark\.kubernetes\.container\.image\.pullSecrets=${PULL_SECRET}" >/dev/null \
  && ok "wrapper sets pullSecrets=$PULL_SECRET" \
  || fail "add --conf spark.kubernetes.container.image.pullSecrets=$PULL_SECRET (platform policy)"

k8s_driver_succeeded store-rollup-deps \
  && ok "store-rollup-deps driver Succeeded" \
  || fail "need Succeeded store-rollup-deps driver"

got="$(k8s_read_answer failure | tr -d '\r' | head -1)"
[[ "$got" == "missing-module" ]] && ok "Investigation: missing team module" \
  || fail "Investigation failure (want missing-module)"

got="$(k8s_read_answer fix | tr -d '\r' | head -1)"
[[ "$got" == "team-image-pullsecret" ]] && ok "Investigation: team image + pull secret" \
  || fail "Investigation fix (want team-image-pullsecret)"

pass "spark-17 wrong image, missing dependency"
