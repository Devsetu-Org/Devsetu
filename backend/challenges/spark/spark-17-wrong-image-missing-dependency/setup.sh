#!/usr/bin/env bash
# Spark-17: apache/spark image missing /opt/lab team job + quickbite_utils;
# pullSecrets policy on team image.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

boot_phase "Preparing the lab"

WRONG_IMAGE="${SPARK_K8S_WRONG_IMAGE:-apache/spark:3.5.3}"
PULL_SECRET=quickbite-registry-pull

kubectl -n "$LEARNER_NS" create secret docker-registry "$PULL_SECRET" \
  --docker-server=quickbite-registry.internal \
  --docker-username=lab \
  --docker-password=lab \
  --docker-email=lab@quickbite.internal \
  --dry-run=client -o yaml | kubectl apply -f -

in_shell 'test -f /opt/lab/jobs/store_join_team.py && test -f /opt/lab/python/quickbite_utils.py' \
  || { echo "team job/module missing from image — rebuild spark-k8s-lab" >&2; exit 1; }

in_shell "
  mkdir -p \"\$HOME/lab\" \"\$HOME/answers\"
  cat > \"\$HOME/lab/notes.txt\" <<EOF
Chapter 3.3 — Wrong image, missing dependency

On Kubernetes the image is the environment. There is no shared \\\$SPARK_HOME/jars.

Morning store-rollup-deps uses the base image ($WRONG_IMAGE). The job is
local:///opt/lab/jobs/store_join_team.py and imports quickbite_utils — both
exist only in the QuickBite lab image.

Correct image: \\\$SPARK_K8S_IMAGE
Platform policy: every team-image submit MUST set
  spark.kubernetes.container.image.pullSecrets=$PULL_SECRET
(secret $PULL_SECRET is already in this namespace).

1) Submit ~/lab/submit-store-rollup-deps.sh — expect missing file / ModuleNotFound
2) Switch container.image to \\\$SPARK_K8S_IMAGE
3) Add pullSecrets=$PULL_SECRET
4) Resubmit until Succeeded
EOF
  echo \"$WRONG_IMAGE\" > \"\$HOME/lab/wrong-image.txt\"
  echo \"$PULL_SECRET\" > \"\$HOME/lab/pull-secret-name.txt\"
"

shell_script <<EOF
cat > "\$HOME/lab/submit-store-rollup-deps.sh" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
: "\${SPARK_K8S_MASTER:?}"
: "\${SPARK_K8S_NS:?}"
: "\${SPARK_K8S_SA:?}"
spark-submit \\
  --master "\$SPARK_K8S_MASTER" \\
  --deploy-mode cluster \\
  --name store-rollup-deps \\
  --conf spark.kubernetes.namespace="\$SPARK_K8S_NS" \\
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
  --conf spark.executor.memory=512m \\
  --conf spark.executor.memoryOverhead=128m \\
  --conf spark.kubernetes.executor.limit.memory=768m \\
  --conf spark.kubernetes.executor.request.cores=250m \\
  local:///opt/lab/jobs/store_join_team.py
WRAP
chmod +x "\$HOME/lab/submit-store-rollup-deps.sh"
EOF

ok "spark-17 planted: wrong image $WRONG_IMAGE + pull secret $PULL_SECRET"
