#!/usr/bin/env bash
# Spark-20 capstone: wrong ns (staging quota) → wrong image → executor mem under-spec.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

PROD_NS="$(k8s_ensure_sibling prod)"
STAGING_NS="$(k8s_ensure_sibling staging)"
WRONG_IMAGE="${SPARK_K8S_WRONG_IMAGE:-apache/spark:3.5.3}"
PULL_SECRET=quickbite-registry-pull

# Staging: tiny quota so the first submit cannot schedule a driver.
kubectl -n "$STAGING_NS" apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: staging-blocked
spec:
  hard:
    requests.memory: 64Mi
    requests.cpu: "100m"
EOF

# Prod: pull secret for platform policy.
kubectl -n "$PROD_NS" create secret docker-registry "$PULL_SECRET" \
  --docker-server=quickbite-registry.internal \
  --docker-username=lab \
  --docker-password=lab \
  --docker-email=lab@quickbite.internal \
  --dry-run=client -o yaml | kubectl apply -f -

in_shell "
  mkdir -p \"\$HOME/lab\" \"\$HOME/answers\"
  cat > \"\$HOME/lab/notes.txt\" <<EOF
Chapter 3.6 — Multi-fault K8s submit (capstone)

Three faults after maintenance. Peel the onion:

1) Namespace: wrapper targets staging ($STAGING_NS) which is quota-blocked.
   Correct namespace: prod ($PROD_NS)
2) Image: still on base $WRONG_IMAGE — needs \\\$SPARK_K8S_IMAGE +
   pullSecrets=$PULL_SECRET (secret exists in prod).
3) Executor memory: 256m heap with limit 256m and no overhead → OOMKilled
   on shuffle. Set executor memoryOverhead and raise executor limit.memory
   (e.g. 512m heap + 128m overhead → limit 768m).

App name: store-rollup-k8s-capstone
EOF
  echo \"$PROD_NS\" > \"\$HOME/lab/prod-namespace.txt\"
  echo \"$STAGING_NS\" > \"\$HOME/lab/staging-namespace.txt\"
"

shell_script <<EOF
cat > "\$HOME/lab/submit-store-rollup-k8s-capstone.sh" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
: "\${SPARK_K8S_MASTER:?}"
: "\${SPARK_K8S_SA:?}"
# FAULT 1: staging (quota-blocked). Notes say use prod.
NS="${STAGING_NS}"
spark-submit \\
  --master "\$SPARK_K8S_MASTER" \\
  --deploy-mode cluster \\
  --name store-rollup-k8s-capstone \\
  --conf spark.kubernetes.namespace="\$NS" \\
  --conf spark.kubernetes.authenticate.driver.serviceAccountName="\$SPARK_K8S_SA" \\
  --conf spark.kubernetes.container.image=${WRONG_IMAGE} \\
  --conf spark.kubernetes.node.selector.devlabs.io/pool=spark \\
  --conf spark.kubernetes.driver.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.kubernetes.executor.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.driver.memory=512m \\
  --conf spark.driver.memoryOverhead=128m \\
  --conf spark.kubernetes.driver.limit.memory=768m \\
  --conf spark.kubernetes.driver.request.cores=250m \\
  --conf spark.executor.instances=1 \\
  --conf spark.executor.cores=1 \\
  --conf spark.executor.memory=256m \\
  --conf spark.kubernetes.executor.limit.memory=256m \\
  --conf spark.kubernetes.executor.request.cores=250m \\
  local:///opt/lab/jobs/store_join_team.py
WRAP
chmod +x "\$HOME/lab/submit-store-rollup-k8s-capstone.sh"
EOF

ok "spark-20 planted: staging=$STAGING_NS prod=$PROD_NS wrong image + tight executor mem"
