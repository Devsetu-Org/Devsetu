#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
NS="${VALIDATE_NS:-sp-spark20-sim}"
IMAGE="${SPARK_K8S_LAB_IMAGE:-devsetu/spark-k8s-lab:v0.1}"
SA=spark-lab
CHALLENGE=spark-20-multi-fault-k8s-submit

kubectl get nodes -l devlabs.io/pool=spark --no-headers | grep -q Ready \
  || { echo "no Ready spark pool node" >&2; exit 1; }
kubectl delete ns "$NS" "${NS}-prod" "${NS}-staging" --wait=false --ignore-not-found >/dev/null 2>&1 || true
for i in $(seq 1 40); do kubectl get ns "$NS" >/dev/null 2>&1 || break; sleep 2; done

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
metadata: {name: dl-spark-isolation, namespace: $NS}
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress: [{from: [{podSelector: {}}]}]
  egress:
    - {to: [{podSelector: {}}]}
    - to:
        - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}
          podSelector: {matchLabels: {k8s-app: kube-dns}}
      ports: [{protocol: UDP, port: 53}, {protocol: TCP, port: 53}]
    - {ports: [{protocol: TCP, port: 443}], to: [{ipBlock: {cidr: 0.0.0.0/0}}]}
---
apiVersion: v1
kind: ServiceAccount
metadata: {name: $SA, namespace: $NS}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: $SA, namespace: $NS}
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
metadata: {name: $SA, namespace: $NS}
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: Role, name: $SA}
subjects: [{kind: ServiceAccount, name: $SA, namespace: $NS}]
---
apiVersion: v1
kind: Pod
metadata:
  name: shell
  namespace: $NS
  labels: {app: spark-lab, component: shell, shape: spark-k8s}
spec:
  serviceAccountName: $SA
  automountServiceAccountToken: true
  enableServiceLinks: false
  nodeSelector: {devlabs.io/pool: spark}
  tolerations: [{key: devlabs.io/pool, value: spark, effect: NoSchedule}]
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

bash "$ROOT/backend/challenges/spark/$CHALLENGE/setup.sh"
PROD=$(kubectl -n "$NS" exec -i shell -c shell -- bash -lc 'cat "$HOME/lab/prod-namespace.txt"' | tr -d '\r' | head -1)

kubectl -n "$NS" exec -i shell -c shell -- env \
  SPARK_K8S_MASTER="$SPARK_K8S_MASTER" SPARK_K8S_IMAGE="$IMAGE" SPARK_K8S_SA="$SA" \
  PROD_NS="$PROD" bash -s <<'FIX'
set -euo pipefail
test -f /opt/lab/python/quickbite_utils.py
cat > "$HOME/lab/submit-store-rollup-k8s-capstone.sh" <<WRAP
#!/usr/bin/env bash
set -euo pipefail
NS=${PROD_NS}
spark-submit \\
  --master "\$SPARK_K8S_MASTER" \\
  --deploy-mode cluster \\
  --name store-rollup-k8s-capstone \\
  --conf spark.kubernetes.namespace="\$NS" \\
  --conf spark.kubernetes.authenticate.driver.serviceAccountName="\$SPARK_K8S_SA" \\
  --conf spark.kubernetes.container.image=\$SPARK_K8S_IMAGE \\
  --conf spark.kubernetes.container.image.pullSecrets=quickbite-registry-pull \\
  --conf spark.kubernetes.node.selector.devlabs.io/pool=spark \\
  --conf spark.kubernetes.driver.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.kubernetes.executor.podTemplateFile=/opt/lab/conf/spark-pod-template.yaml \\
  --conf spark.driver.memory=512m \\
  --conf spark.driver.memoryOverhead=128m \\
  --conf spark.kubernetes.driver.limit.memory=768m \\
  --conf spark.executor.instances=1 \\
  --conf spark.executor.cores=1 \\
  --conf spark.executor.memory=512m \\
  --conf spark.executor.memoryOverhead=128m \\
  --conf spark.kubernetes.executor.limit.memory=768m \\
  --conf spark.kubernetes.driver.request.cores=250m \\
  --conf spark.kubernetes.executor.request.cores=250m \\
  local:///opt/lab/jobs/store_join_team.py
WRAP
chmod +x "$HOME/lab/submit-store-rollup-k8s-capstone.sh"
~/lab/submit-store-rollup-k8s-capstone.sh
FIX

phase=""
for i in $(seq 1 200); do
  phase=$(kubectl -n "$PROD" get pods -l spark-role=driver \
    -o jsonpath='{range .items[*]}{.metadata.name}{"="}{.status.phase}{"\n"}{end}' \
    | awk -F= '/^store-rollup-k8s-capstone/ {print $2; exit}')
  echo "  t=$i phase=${phase:-none} ns=$PROD"
  [[ "$phase" == "Succeeded" ]] && break
  [[ "$phase" == "Failed" ]] && { kubectl -n "$PROD" logs -l spark-role=driver --tail=100 || true; exit 1; }
  sleep 2
done
[[ "$phase" == "Succeeded" ]] || exit 1

kubectl -n "$NS" exec -i shell -c shell -- bash -lc '
mkdir -p "$HOME/answers"
printf "%s\n" namespace > "$HOME/answers/layer1"
printf "%s\n" image > "$HOME/answers/layer2"
printf "%s\n" memory > "$HOME/answers/layer3"
'
bash "$ROOT/backend/challenges/spark/$CHALLENGE/grade.sh"
echo "SCENARIO_SIMULATABLE=yes"
