#!/usr/bin/env bash
# Deploy Spark Platform (Operator + API + History) onto EKS and pin DE jobs
# to the spark-de pool. Idempotent.
#
#   install   operator + RBAC + API + History (needs arm64 images on Hub)
#   build     build+push linux/arm64 API + Spark S3A images (Graviton nodes)
#   deploy    build + install
#   status    pods, LB hostnames, curl /api/health
#   down      uninstall operator release + delete platform workloads
#
# S3 credentials (required for install): AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
# (same keys DevLabs uses for s3://devlabs-data), or SPARK_S3_ACCESS_KEY /
# SPARK_S3_SECRET_KEY. Optionally source backend/.env first.
#
# After install, point the App EC2 / local backend at the Internal NLB:
#   SPARK_PLATFORM_API_URL=http://<api-nlb>:8080
#   SPARK_HISTORY_UI_URL=http://<history-nlb>:18080
#
# Usage (repo root, kubeconfig from eks-kubeconfig.sh):
#   ./deploy/eks/eks-spark-de.sh base   # capacity for driver/executor pods
#   ./deploy/eks/eks-spark-platform.sh deploy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=env.sh
source "$ROOT/env.sh"

export KUBECONFIG="${KUBECONFIG:-$EKS_KUBECONFIG_OUT}"
MANIFEST_DIR="$ROOT/spark-platform"
PLATFORM_DIR="$(cd "$ROOT/../../.." && pwd)/platforms/spark-platform"
# Prefer sibling checkout; fall back to env override.
if [[ ! -d "$PLATFORM_DIR" ]]; then
  PLATFORM_DIR="${SPARK_PLATFORM_DIR:-$HOME/Documents/devlabs-ai/platforms/spark-platform}"
fi

NAMESPACE="${SPARK_NAMESPACE:-spark}"
OPERATOR_RELEASE="${SPARK_OPERATOR_RELEASE:-spark-operator}"
OPERATOR_CHART_VERSION="${SPARK_OPERATOR_CHART_VERSION:-2.5.1}"

# Default to ECR in this account (Graviton nodes pull without Docker Hub auth).
ECR_REGISTRY="${SPARK_ECR_REGISTRY:-${AWS_ACCOUNT_ID:-204098850303}.dkr.ecr.${AWS_REGION}.amazonaws.com}"
IMAGE_REPO="${SPARK_PLATFORM_API_IMAGE_REPO:-${ECR_REGISTRY}/devlabs/spark-platform-api}"
IMAGE_TAG="${SPARK_PLATFORM_API_IMAGE_TAG:-eks-arm64}"
IMAGE="${SPARK_PLATFORM_API_IMAGE:-${IMAGE_REPO}:${IMAGE_TAG}}"
S3A_IMAGE_REPO="${SPARK_S3A_IMAGE_REPO:-${ECR_REGISTRY}/devlabs/spark}"
S3A_IMAGE_TAG="${SPARK_S3A_IMAGE_TAG:-3.5.3-s3a-arm64}"
S3A_IMAGE="${SPARK_S3A_IMAGE:-${S3A_IMAGE_REPO}:${S3A_IMAGE_TAG}}"
BUILD_PLATFORM="${SPARK_PLATFORM_BUILD_PLATFORM:-linux/arm64}"
S3_ENDPOINT="${SPARK_S3_ENDPOINT:-${S3_ENDPOINT:-https://s3.ap-south-2.amazonaws.com}}"
S3_BUCKET="${SPARK_S3_BUCKET:-${S3_BUCKET:-${MINIO_BUCKET:-devlabs-data}}}"
EVENT_LOG_DIR="${SPARK_EVENT_LOG_DIR:-s3a://${S3_BUCKET}/spark-events/}"
SKIP_BUILD="${SPARK_PLATFORM_SKIP_BUILD:-0}"
SKIP_PUSH="${SPARK_PLATFORM_SKIP_PUSH:-0}"

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

s3_keys() {
  ACCESS_KEY="${SPARK_S3_ACCESS_KEY:-${AWS_ACCESS_KEY_ID:-${MINIO_ACCESS_KEY:-}}}"
  SECRET_KEY="${SPARK_S3_SECRET_KEY:-${AWS_SECRET_ACCESS_KEY:-${MINIO_SECRET_KEY:-}}}"
  if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" ]]; then
    echo "Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (or SPARK_S3_*) for s3://$S3_BUCKET" >&2
    exit 1
  fi
}

ensure_ns() {
  kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
}

ensure_s3_secret() {
  s3_keys
  kubectl -n "$NAMESPACE" create secret generic spark-s3 \
    --from-literal=accessKey="$ACCESS_KEY" \
    --from-literal=secretKey="$SECRET_KEY" \
    --dry-run=client -o yaml | kubectl apply -f -
}

wait_lb() {
  local svc="$1" port="$2" tries=60 host=""
  echo "==> waiting for Internal NLB on $svc"
  for ((i = 0; i < tries; i++)); do
    host="$(kubectl -n "$NAMESPACE" get svc "$svc" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
    if [[ -n "$host" ]]; then
      echo "    $svc → http://${host}:${port}"
      return 0
    fi
    sleep 5
  done
  echo "    $svc: LoadBalancer hostname not ready yet (check later with status)" >&2
  return 0
}

lb_url() {
  local svc="$1" port="$2"
  local host
  host="$(kubectl -n "$NAMESPACE" get svc "$svc" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
  if [[ -n "$host" ]]; then
    echo "http://${host}:${port}"
  else
    echo ""
  fi
}

render_apply() {
  local src="$1"
  local history_url api_url
  history_url="$(lb_url spark-history 18080)"
  api_url="$(lb_url spark-platform-api 8080)"
  # First apply may not have LB DNS yet — use in-cluster DNS as History URL seed.
  [[ -n "$history_url" ]] || history_url="http://spark-history.spark.svc.cluster.local:18080"
  [[ -n "$api_url" ]] || api_url="http://spark-platform-api.spark.svc.cluster.local:8080"

  local tmp
  tmp="$(mktemp)"
  sed \
    -e "s|IMAGE_PLACEHOLDER|${IMAGE}|g" \
    -e "s|SPARK_IMAGE_PLACEHOLDER|${S3A_IMAGE}|g" \
    -e "s|EVENT_LOG_DIR_PLACEHOLDER|${EVENT_LOG_DIR}|g" \
    -e "s|S3_ENDPOINT_PLACEHOLDER|${S3_ENDPOINT}|g" \
    -e "s|HISTORY_UI_PLACEHOLDER|${history_url}|g" \
    "$src" >"$tmp"
  kubectl apply -f "$tmp"
  rm -f "$tmp"
}

ecr_login() {
  case "$IMAGE" in
    *.dkr.ecr.*.amazonaws.com/*)
      need aws
      echo "==> ECR login ${ECR_REGISTRY}"
      aws ecr get-login-password --region "$AWS_REGION" \
        | docker login --username AWS --password-stdin "$ECR_REGISTRY"
      ;;
  esac
}

build_images() {
  need docker
  if [[ ! -d "$PLATFORM_DIR" ]]; then
    echo "spark-platform sources not found at $PLATFORM_DIR (set SPARK_PLATFORM_DIR)" >&2
    exit 1
  fi
  ecr_login
  if [[ "$SKIP_BUILD" != "1" ]]; then
    echo "==> Building ${S3A_IMAGE} (${BUILD_PLATFORM})"
    docker build --platform "$BUILD_PLATFORM" -t "$S3A_IMAGE" "$PLATFORM_DIR/spark-image"
    echo "==> Building ${IMAGE} (${BUILD_PLATFORM})"
    docker build --platform "$BUILD_PLATFORM" -t "$IMAGE" "$PLATFORM_DIR"
  else
    echo "==> Skipping image build (SPARK_PLATFORM_SKIP_BUILD=1)"
  fi
  if [[ "$SKIP_PUSH" != "1" ]]; then
    echo "==> Pushing ${S3A_IMAGE}"
    docker push "$S3A_IMAGE"
    echo "==> Pushing ${IMAGE}"
    docker push "$IMAGE"
  else
    echo "==> Skipping image push (SPARK_PLATFORM_SKIP_PUSH=1)"
  fi
}

install_operator() {
  need helm
  ensure_ns
  echo "==> helm $OPERATOR_RELEASE chart $OPERATOR_CHART_VERSION → ns $NAMESPACE (system-k8s)"
  helm repo add spark-operator https://kubeflow.github.io/spark-operator >/dev/null 2>&1 || true
  helm repo update spark-operator >/dev/null
  helm upgrade --install "$OPERATOR_RELEASE" spark-operator/spark-operator \
    --version "$OPERATOR_CHART_VERSION" \
    --namespace "$NAMESPACE" \
    -f "$MANIFEST_DIR/operator-values.yaml" \
    --wait --timeout 5m
}

install_platform() {
  ensure_ns
  ensure_s3_secret
  echo "==> RBAC"
  kubectl apply -f "$MANIFEST_DIR/platform-rbac.yaml"
  echo "==> History Server (s3a event logs)"
  render_apply "$MANIFEST_DIR/history-server.yaml"
  echo "==> Platform API (SPARK_NODE_POOL=spark-de)"
  render_apply "$MANIFEST_DIR/platform-api.yaml"
  kubectl -n "$NAMESPACE" rollout status deployment/spark-history --timeout=180s
  kubectl -n "$NAMESPACE" rollout status deployment/spark-platform-api --timeout=180s
  wait_lb spark-history 18080
  wait_lb spark-platform-api 8080
  # Re-apply API so HISTORY_UI_URL picks up the real NLB hostname once ready.
  render_apply "$MANIFEST_DIR/platform-api.yaml"
  kubectl -n "$NAMESPACE" rollout restart deployment/spark-platform-api
  kubectl -n "$NAMESPACE" rollout status deployment/spark-platform-api --timeout=180s
}

print_status() {
  echo "==> nodes (spark-de + system)"
  kubectl get nodes -l 'devlabs.io/pool in (spark-de,system)' \
    -L devlabs.io/pool,devlabs.io/tier,node.kubernetes.io/instance-type 2>/dev/null || true
  echo ""
  echo "==> spark namespace"
  kubectl -n "$NAMESPACE" get deploy,po,svc 2>/dev/null || true
  echo ""
  local api_url hist_url
  api_url="$(lb_url spark-platform-api 8080)"
  hist_url="$(lb_url spark-history 18080)"
  echo "SPARK_PLATFORM_API_URL=${api_url:-'(pending)'}"
  echo "SPARK_HISTORY_UI_URL=${hist_url:-'(pending)'}"
  echo "SPARK_NODE_POOL=spark-de  EVENT_LOG_DIR=$EVENT_LOG_DIR"
  if [[ -n "$api_url" ]]; then
    echo ""
    echo "==> /api/health"
    curl -fsS --max-time 10 "${api_url}/api/health" && echo || echo "(not reachable from this host yet — App EC2 in VPC can use the Internal NLB)"
    echo "==> /api/config"
    curl -fsS --max-time 10 "${api_url}/api/config" && echo || true
  fi
}

down_platform() {
  echo "==> delete platform workloads"
  kubectl -n "$NAMESPACE" delete deploy spark-platform-api spark-history --ignore-not-found
  kubectl -n "$NAMESPACE" delete svc spark-platform-api spark-history --ignore-not-found
  kubectl -n "$NAMESPACE" delete secret spark-s3 --ignore-not-found
  kubectl -n "$NAMESPACE" delete rolebinding,role,sa spark-platform-api --ignore-not-found
  if helm status "$OPERATOR_RELEASE" -n "$NAMESPACE" >/dev/null 2>&1; then
    echo "==> helm uninstall $OPERATOR_RELEASE"
    helm uninstall "$OPERATOR_RELEASE" -n "$NAMESPACE" --wait || true
  fi
  echo "==> done (namespace $NAMESPACE left in place; CRDs may remain)"
}

case "${1:-}" in
  build) build_images ;;
  install)
    install_operator
    install_platform
    print_status
    ;;
  deploy)
    build_images
    install_operator
    install_platform
    print_status
    ;;
  status) print_status ;;
  down) down_platform ;;
  *)
    echo "usage: $0 build|install|deploy|status|down" >&2
    exit 2
    ;;
esac
