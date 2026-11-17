#!/usr/bin/env bash
# Spark-19: driver heap == K8s limit (no overhead) → OOMKilled.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

in_shell '
  mkdir -p "$HOME/lab" "$HOME/answers"
  cat > "$HOME/lab/notes.txt" <<EOF
Chapter 3.5 — Driver OOMKilled: Spark memory vs K8s limits

store-rollup-driver-mem sets spark.driver.memory=512m and
spark.kubernetes.driver.limit.memory=512m with NO memoryOverhead.

Spark heap is only part of the container. Default overhead is max(384m, 10% of
heap). Heap + overhead exceeds the K8s limit → OOMKilled (exit 137).

Fix: set spark.driver.memoryOverhead (≥384m, recommend 128m+ with a raised
limit, or 384m) and raise spark.kubernetes.driver.limit.memory so
limit ≥ heap + overhead (e.g. 512m + 384m → 896m or 1024m).

App name: store-rollup-driver-mem
EOF
'

shell_script <<'EOF'
cat > "$HOME/lab/submit-store-rollup-driver-mem.sh" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
: "${SPARK_K8S_MASTER:?}"
: "${SPARK_K8S_NS:?}"
: "${SPARK_K8S_IMAGE:?}"
: "${SPARK_K8S_SA:?}"
spark-submit \
  --master "$SPARK_K8S_MASTER" \
  --deploy-mode cluster \
  --name store-rollup-driver-mem \
  --conf spark.kubernetes.namespace="$SPARK_K8S_NS" \
  --conf spark.kubernetes.authenticate.driver.serviceAccountName="$SPARK_K8S_SA" \
  --conf spark.kubernetes.container.image="$SPARK_K8S_IMAGE" \
  --conf spark.kubernetes.node.selector.devlabs.io/pool=spark \
  --conf spark.kubernetes.driver.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \
  --conf spark.kubernetes.executor.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \
  --conf spark.driver.memory=512m \
  --conf spark.kubernetes.driver.limit.memory=512m \
  --conf spark.kubernetes.driver.request.cores=250m \
  --conf spark.executor.instances=1 \
  --conf spark.executor.cores=1 \
  --conf spark.executor.memory=512m \
  --conf spark.executor.memoryOverhead=128m \
  --conf spark.kubernetes.executor.limit.memory=768m \
  --conf spark.kubernetes.executor.request.cores=250m \
  local:///opt/lab/jobs/store_join.py
WRAP
chmod +x "$HOME/lab/submit-store-rollup-driver-mem.sh"
EOF

ok "spark-19 planted: driver memory == K8s limit (no overhead)"
