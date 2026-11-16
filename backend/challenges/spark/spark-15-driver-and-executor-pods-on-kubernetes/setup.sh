#!/usr/bin/env bash
# Spark-15: plant an incomplete K8s submit wrapper; cluster API already up via shape.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

in_shell 'test -f /opt/lab/jobs/store_join.py && test -f /opt/lab/data/orders.csv' \
  || { echo "lab job / data missing from image" >&2; exit 1; }

in_shell 'test -f /opt/lab/conf/spark-pod-template.yaml' \
  || { echo "pod template missing from image — rebuild spark-k8s-lab" >&2; exit 1; }

in_shell 'command -v kubectl >/dev/null && kubectl auth can-i create pods -n "$SPARK_K8S_NS"' \
  || { echo "shell cannot create pods in $SPARK_K8S_NS" >&2; exit 1; }

in_shell '
  mkdir -p "$HOME/lab" "$HOME/answers"
  cat > "$HOME/lab/notes.txt" <<EOF
Chapter 3.1 — Driver and executor pods on Kubernetes

Your team namespace is \$SPARK_K8S_NS (QuickBite calls this the spark team namespace).
Submit client: shell. Resource manager: the Kubernetes API — not YARN, not a Spark Master.

1) Forensics: kubectl get pods -n \$SPARK_K8S_NS -o wide
2) Finish ~/lab/submit-store-rollup-k8s.sh — set spark.executor.instances from 0 to 2
3) Submit in cluster mode: ~/lab/submit-store-rollup-k8s.sh
4) Watch driver + executor pods; delete one executor; wait for a replacement; job must Succeeded
5) Fill Investigation, then Submit

App name: store-rollup-k8s
Platform shape: 2 executors × 1 core × 512m (overhead 128m, executor limit 768m)
EOF

  cat > "$HOME/lab/submit-store-rollup-k8s.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
# Incomplete — set spark.executor.instances=2 (currently 0) before executors schedule.
set -euo pipefail

: "${SPARK_K8S_MASTER:?}"
: "${SPARK_K8S_NS:?}"
: "${SPARK_K8S_IMAGE:?}"
: "${SPARK_K8S_SA:?}"

spark-submit \
  --master "$SPARK_K8S_MASTER" \
  --deploy-mode cluster \
  --name store-rollup-k8s \
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
  --conf spark.kubernetes.executor.request.cores=250m \
  --conf spark.kubernetes.executor.limit.cores=1 \
  --conf spark.executor.instances=0 \
  --conf spark.executor.cores=1 \
  --conf spark.executor.memory=512m \
  --conf spark.executor.memoryOverhead=128m \
  --conf spark.kubernetes.executor.limit.memory=768m \
  local:///opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-store-rollup-k8s.sh"
'

ok "spark-k8s shell ready in $SPARK_K8S_NS; incomplete submit wrapper planted (instances=0)"
