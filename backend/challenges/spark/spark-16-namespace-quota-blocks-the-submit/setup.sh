#!/usr/bin/env bash
# Spark-16: ResourceQuota + debug-memory-hog block store-rollup-quota.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

PROD_NS="$(k8s_ensure_sibling prod)"
export SPARK_K8S_NS_PROD="$PROD_NS"

# Tight quota on the team ns. Shell (~256Mi) + hog leave no room for a driver.
kubectl -n "$LEARNER_NS" apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-spark-quota
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 2200Mi
    limits.memory: 4Gi
EOF

kubectl -n "$LEARNER_NS" delete pod debug-memory-hog --ignore-not-found --wait=false >/dev/null 2>&1 || true
kubectl -n "$LEARNER_NS" apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: debug-memory-hog
  labels:
    app: debug-memory-hog
spec:
  nodeSelector:
    devlabs.io/pool: spark
  tolerations:
    - key: devlabs.io/pool
      operator: Equal
      value: spark
      effect: NoSchedule
  containers:
    - name: hog
      image: registry.k8s.io/pause:3.9
      imagePullPolicy: IfNotPresent
      resources:
        requests: {cpu: 500m, memory: 1600Mi}
        limits: {cpu: 500m, memory: 1600Mi}
EOF

kubectl -n "$LEARNER_NS" wait --for=condition=Ready pod/debug-memory-hog --timeout=120s \
  || { echo "debug-memory-hog not Ready" >&2; exit 1; }

in_shell "
  mkdir -p \"\$HOME/lab\" \"\$HOME/answers\"
  cat > \"\$HOME/lab/notes.txt\" <<EOF
Chapter 3.2 — Namespace quota blocks the submit

Team namespace: \$SPARK_K8S_NS
Prod namespace (empty, no hog): $PROD_NS

A ResourceQuota caps this team namespace. Leftover debug-memory-hog is eating most of it.
Morning store-rollup-quota cannot create its driver (quota exceeded / Forbidden).

Fix (either is OK):
  A) Delete debug-memory-hog, keep the ResourceQuota, re-run ~/lab/submit-store-rollup-quota.sh
  B) Point the wrapper at the prod namespace ($PROD_NS) and re-run

Do NOT delete or raise team-spark-quota.
App name: store-rollup-quota  (1 executor — sized for this pool)
EOF

  cat > \"\$HOME/lab/submit-store-rollup-quota.sh\" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
: \"\${SPARK_K8S_MASTER:?}\"
: \"\${SPARK_K8S_NS:?}\"
: \"\${SPARK_K8S_IMAGE:?}\"
: \"\${SPARK_K8S_SA:?}\"
NS=\"\${SPARK_K8S_TARGET_NS:-\$SPARK_K8S_NS}\"
spark-submit \\
  --master \"\$SPARK_K8S_MASTER\" \\
  --deploy-mode cluster \\
  --name store-rollup-quota \\
  --conf spark.kubernetes.namespace=\"\$NS\" \\
  --conf spark.kubernetes.authenticate.driver.serviceAccountName=\"\$SPARK_K8S_SA\" \\
  --conf spark.kubernetes.container.image=\"\$SPARK_K8S_IMAGE\" \\
  --conf spark.kubernetes.node.selector.devlabs.io/pool=spark \\
  --conf spark.kubernetes.driver.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.kubernetes.executor.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.driver.memory=512m \\
  --conf spark.driver.memoryOverhead=128m \\
  --conf spark.kubernetes.driver.limit.memory=768m \\
  --conf spark.kubernetes.driver.request.cores=250m \\
  --conf spark.executor.instances=1 \\
  --conf spark.executor.cores=1 \\
  --conf spark.executor.memory=512m \\
  --conf spark.executor.memoryOverhead=128m \\
  --conf spark.kubernetes.executor.limit.memory=768m \\
  --conf spark.kubernetes.executor.request.cores=250m \\
  local:///opt/lab/jobs/store_join.py
EOF
  chmod +x \"\$HOME/lab/submit-store-rollup-quota.sh\"
  echo \"$PROD_NS\" > \"\$HOME/lab/prod-namespace.txt\"
"

ok "spark-16 planted: ResourceQuota + debug-memory-hog; prod ns $PROD_NS"
