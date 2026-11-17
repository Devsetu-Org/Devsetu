#!/usr/bin/env bash
# EKS sign-off for spark-15 / shape spark-k8s (not local Docker).
# Requires: kubectl to the DevLabs cluster, spark pool Ready, image pullable.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
NS="${VALIDATE_NS:-sp-spark-k8s-sim}"
IMAGE="${SPARK_K8S_LAB_IMAGE:-devsetu/spark-k8s-lab:v0.1}"
SA=spark-lab
CHALLENGE=spark-15-driver-and-executor-pods-on-kubernetes

echo "==> ns=$NS image=$IMAGE"

kubectl get nodes -l devlabs.io/pool=spark --no-headers | grep -q Ready \
  || { echo "no Ready spark pool node" >&2; exit 1; }

kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: $NS
  labels:
    app.kubernetes.io/managed-by: devlabs
    app.kubernetes.io/component: spark-lab
    pod-security.kubernetes.io/enforce: baseline
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dl-spark-isolation
  namespace: $NS
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from: [{podSelector: {}}]
  egress:
    - to: [{podSelector: {}}]
    - to:
        - namespaceSelector:
            matchLabels: {kubernetes.io/metadata.name: kube-system}
          podSelector:
            matchLabels: {k8s-app: kube-dns}
      ports: [{protocol: UDP, port: 53}, {protocol: TCP, port: 53}]
    - ports: [{protocol: TCP, port: 443}]
      to: [{ipBlock: {cidr: 0.0.0.0/0}}]
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SA
  namespace: $NS
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: $SA
  namespace: $NS
rules:
  - apiGroups: [""]
    resources: [pods, pods/log, pods/status, services, configmaps, persistentvolumeclaims]
    verbs: [get, list, watch, create, update, patch, delete]
  - apiGroups: [""]
    resources: [events, resourcequotas, limitranges, serviceaccounts, secrets]
    verbs: [get, list, watch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: $SA
  namespace: $NS
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: Role, name: $SA}
subjects: [{kind: ServiceAccount, name: $SA, namespace: $NS}]
---
apiVersion: v1
kind: Pod
metadata:
  name: shell
  namespace: $NS
  labels:
    app: spark-lab
    component: shell
    shape: spark-k8s
spec:
  serviceAccountName: $SA
  automountServiceAccountToken: true
  enableServiceLinks: false
  nodeSelector: {devlabs.io/pool: spark}
  tolerations:
    - {key: devlabs.io/pool, value: spark, effect: NoSchedule}
  containers:
    - name: shell
      image: $IMAGE
      imagePullPolicy: Always
      command: ["/bin/sleep", "infinity"]
      workingDir: /opt/spark
      env:
        - {name: HOME, value: /opt/spark}
        - {name: SPARK_HOME, value: /opt/spark}
        - {name: SPARK_CONF_DIR, value: /opt/spark/conf}
        - {name: SPARK_K8S_NS, value: "$NS"}
        - {name: SPARK_K8S_MASTER, value: "k8s://https://kubernetes.default.svc:443"}
        - {name: SPARK_K8S_IMAGE, value: "$IMAGE"}
        - {name: SPARK_K8S_SA, value: "$SA"}
        - {name: PATH, value: "/opt/spark/bin:/opt/spark/sbin:/opt/java/openjdk/bin:/usr/local/bin:/usr/bin:/bin"}
      resources:
        requests: {cpu: 50m, memory: 256Mi}
        limits: {cpu: 500m, memory: 512Mi}
EOF

kubectl -n "$NS" wait --for=condition=Ready pod/shell --timeout=360s

export LEARNER_NS="$NS" SPARK_POD=shell SHELL_CONTAINER=shell \
  SPARK_SHAPE=spark-k8s SPARK_K8S_NS="$NS" SPARK_K8S_MASTER="k8s://https://kubernetes.default.svc:443" \
  SPARK_K8S_IMAGE="$IMAGE" SPARK_K8S_SA="$SA" \
  SPARK_MASTER="k8s://https://kubernetes.default.svc:443" SPARK_MASTER_UI=none

echo "==> setup.sh"
bash "$ROOT/backend/challenges/spark/$CHALLENGE/setup.sh"

echo "==> apply learner fix + submit"
kubectl -n "$NS" exec shell -c shell -- bash -lc '
set -euo pipefail
test -f /opt/lab/conf/spark-pod-template.yaml
cat > "$HOME/lab/submit-store-rollup-k8s.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
spark-submit \\
  --master "\$SPARK_K8S_MASTER" \\
  --deploy-mode cluster \\
  --name store-rollup-k8s \\
  --conf spark.kubernetes.namespace="\$SPARK_K8S_NS" \\
  --conf spark.kubernetes.authenticate.driver.serviceAccountName="\$SPARK_K8S_SA" \\
  --conf spark.kubernetes.container.image="\$SPARK_K8S_IMAGE" \\
  --conf spark.kubernetes.node.selector.devlabs.io/pool=spark \\
  --conf spark.kubernetes.driver.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.kubernetes.executor.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.driver.memory=512m \\
  --conf spark.driver.memoryOverhead=128m \\
  --conf spark.kubernetes.driver.limit.memory=768m \\
  --conf spark.executor.instances=2 \\
  --conf spark.executor.cores=1 \\
  --conf spark.executor.memory=512m \\
  --conf spark.executor.memoryOverhead=128m \\
  --conf spark.kubernetes.executor.limit.memory=768m \\
  --conf spark.kubernetes.driver.request.cores=250m \\
  --conf spark.kubernetes.executor.request.cores=250m \\
  local:///opt/lab/jobs/store_join.py
EOF
chmod +x "$HOME/lab/submit-store-rollup-k8s.sh"
~/lab/submit-store-rollup-k8s.sh
'

echo "==> wait for Succeeded driver"
KILLED=0
phase=""
for i in $(seq 1 180); do
  phase=$(kubectl -n "$NS" get pods -l spark-role=driver \
    -o jsonpath='{range .items[*]}{.metadata.name}{"="}{.status.phase}{"\n"}{end}' \
    | awk -F= '/^store-rollup-k8s/ {print $2; exit}')
  echo "  t=$i phase=${phase:-none}"
  [[ "$phase" == "Succeeded" ]] && break
  if [[ "$phase" == "Failed" ]]; then
    kubectl -n "$NS" get pods -o wide
    kubectl -n "$NS" logs -l spark-role=driver --tail=80 || true
    exit 1
  fi
  if [[ "$phase" == "Running" && "$KILLED" != "1" ]]; then
    execp=$(kubectl -n "$NS" get pods -l spark-role=executor --field-selector=status.phase=Running \
      -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [[ -n "$execp" ]]; then
      echo "  deleting executor $execp"
      kubectl -n "$NS" delete pod "$execp" --wait=false || true
      KILLED=1
    fi
  fi
  sleep 2
done
[[ "$phase" == "Succeeded" ]] || { echo "driver did not Succeed" >&2; kubectl -n "$NS" get pods -o wide; exit 1; }

echo "==> plant investigation answers"
kubectl -n "$NS" exec shell -c shell -- bash -lc '
mkdir -p "$HOME/answers"
printf "%s\n" k8s > "$HOME/answers/resourceManager"
printf "%s\n" cluster > "$HOME/answers/deployMode"
printf "%s\n" replaced > "$HOME/answers/killExecutor"
'

echo "==> grade.sh"
bash "$ROOT/backend/challenges/spark/$CHALLENGE/grade.sh"

echo "SCENARIO_SIMULATABLE=yes"
echo "==> cleanup hint: kubectl delete ns $NS"
