#!/usr/bin/env bash
# Spark-18: dynamic allocation enabled without External Shuffle Service.
# Pass path (locked): disable dyn-alloc + static executor instances.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

in_shell '
  mkdir -p "$HOME/lab" "$HOME/answers"
  cat > "$HOME/lab/notes.txt" <<EOF
Chapter 3.4 — Dynamic allocation without the shuffle service

store-rollup-dynamic enables spark.dynamicAllocation.enabled=true.
On Kubernetes there is no External Shuffle Service on this pool (baseline PSA —
no privileged DaemonSet). When executors scale down, shuffle blocks disappear
→ FetchFailedException.

Platform ideal: deploy an External Shuffle Service DaemonSet.
App workaround (what this lab grades): disable dynamic allocation and set a
static spark.executor.instances (2).

App name: store-rollup-dynamic
EOF
'

shell_script <<'EOF'
cat > "$HOME/lab/submit-store-rollup-dynamic.sh" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
: "${SPARK_K8S_MASTER:?}"
: "${SPARK_K8S_NS:?}"
: "${SPARK_K8S_IMAGE:?}"
: "${SPARK_K8S_SA:?}"
spark-submit \
  --master "$SPARK_K8S_MASTER" \
  --deploy-mode cluster \
  --name store-rollup-dynamic \
  --conf spark.kubernetes.namespace="$SPARK_K8S_NS" \
  --conf spark.kubernetes.authenticate.driver.serviceAccountName="$SPARK_K8S_SA" \
  --conf spark.kubernetes.container.image="$SPARK_K8S_IMAGE" \
  --conf spark.kubernetes.node.selector.devlabs.io/pool=spark \
  --conf spark.kubernetes.driver.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \
  --conf spark.kubernetes.executor.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \
  --conf spark.driver.memory=512m \
  --conf spark.driver.memoryOverhead=128m \
  --conf spark.kubernetes.driver.limit.memory=768m \
  --conf spark.kubernetes.driver.request.cores=250m \
  --conf spark.dynamicAllocation.enabled=true \
  --conf spark.dynamicAllocation.minExecutors=1 \
  --conf spark.dynamicAllocation.maxExecutors=2 \
  --conf spark.dynamicAllocation.executorIdleTimeout=2s \
  --conf spark.dynamicAllocation.schedulerBacklogTimeout=1s \
  --conf spark.executor.cores=1 \
  --conf spark.executor.memory=512m \
  --conf spark.executor.memoryOverhead=128m \
  --conf spark.kubernetes.executor.limit.memory=768m \
  --conf spark.kubernetes.executor.request.cores=250m \
  local:///opt/lab/jobs/store_join.py
WRAP
chmod +x "$HOME/lab/submit-store-rollup-dynamic.sh"
EOF

ok "spark-18 planted: dynamicAllocation enabled, no shuffle service"
