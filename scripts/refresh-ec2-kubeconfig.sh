#!/usr/bin/env bash
# Push the EKS controller kubeconfig to the App EC2 over SSM and restart the backend
# (it caches the cluster endpoint per process). Run from the Mac with admin creds
# (aws sso login --profile devlabs-admin). No SSH.
#
# The EC2 copy must not name an AWS profile: the backend runs `aws eks get-token`
# with the devlabs-app-s3 keys from its environment. update-kubeconfig embeds
# AWS_PROFILE when it is set, so the file is generated from exported credentials.
#
# The backend is only restarted when the kubeconfig actually changed.
#
# Usage (repo root):
#   ./scripts/refresh-ec2-kubeconfig.sh
#   ./scripts/refresh-ec2-kubeconfig.sh --no-recreate     # write file, don't restart
#   ./scripts/refresh-ec2-kubeconfig.sh --force-recreate  # restart even if unchanged
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RESTART=auto
for arg in "$@"; do
  case "$arg" in
    --no-recreate) RESTART=never ;;
    --force-recreate) RESTART=always ;;
    -h|--help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $arg (try --no-recreate / --force-recreate)" >&2
      exit 1
      ;;
  esac
done

# shellcheck source=../deploy/eks/env.sh
source "$ROOT/deploy/eks/env.sh"
eks_need_aws
command -v jq >/dev/null 2>&1 || { echo "jq not found" >&2; exit 1; }

INSTANCE_ID="${EC2_INSTANCE_ID:-i-0bb3a844fac9d0563}"
REMOTE_DIR="${EC2_APP_DIR:-/opt/devlabs}"

if ! eks_cluster_exists; then
  echo "cluster $EKS_CLUSTER_NAME not found in $AWS_REGION (recreate first?)" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> build profile-free kubeconfig for $EKS_CLUSTER_NAME"
(
  eval "$(aws configure export-credentials --format env)"
  unset AWS_PROFILE AWS_DEFAULT_PROFILE
  aws eks update-kubeconfig \
    --name "$EKS_CLUSTER_NAME" \
    --region "$AWS_REGION" \
    --kubeconfig "$TMP/kubeconfig" >/dev/null
)
if grep -q 'AWS_PROFILE' "$TMP/kubeconfig"; then
  echo "generated kubeconfig still references AWS_PROFILE; refusing to push" >&2
  exit 1
fi
echo "    server: $(grep -E '^\s*server:' "$TMP/kubeconfig" | head -1 | awk '{print $2}')"

cat > "$TMP/remote.sh" <<REMOTE
set -euo pipefail
cd '$REMOTE_DIR'
KUBE=kube/k8s-lab.kubeconfig
RESTART='$RESTART'
new="\$(mktemp)"
echo '$(base64 < "$TMP/kubeconfig" | tr -d '\n')' | base64 -d > "\$new"

changed=1
if [[ -f "\$KUBE" ]] && cmp -s "\$new" "\$KUBE"; then
  changed=0
  echo "kubeconfig unchanged"
  rm -f "\$new"
else
  mkdir -p kube
  [[ -f "\$KUBE" ]] && cp -a "\$KUBE" "\$KUBE.bak-\$(date +%Y%m%d%H%M%S)"
  install -m 600 -o ec2-user -g ec2-user "\$new" "\$KUBE"
  rm -f "\$new"
  echo "kubeconfig updated: \$(grep -E '^\s*server:' "\$KUBE" | awk '{print \$2}')"
fi

if [[ "\$RESTART" == never || ( "\$RESTART" == auto && "\$changed" == 0 ) ]]; then
  echo "backend not restarted"
  exit 0
fi

# release.env pins the ECR images; without it compose falls back to Docker Hub defaults.
if [[ -f release.env ]]; then set -a; source ./release.env; set +a; fi
docker compose -f docker-compose.prod.yml up -d --no-build --force-recreate backend
for _ in \$(seq 1 24); do
  if curl -fsS --max-time 5 http://127.0.0.1:4000/health 2>/dev/null | grep -q '"ok":true'; then
    echo "backend healthy"
    exit 0
  fi
  sleep 5
done
echo "backend unhealthy after restart" >&2
docker compose -f docker-compose.prod.yml logs --tail 50 backend >&2 || true
exit 1
REMOTE

echo "==> push to $INSTANCE_ID via SSM (restart: $RESTART)"
PARAMS="$(jq -n --arg s "$(base64 < "$TMP/remote.sh" | tr -d '\n')" \
  '{commands: ["echo \($s) | base64 -d | bash"]}')"
CMD_ID="$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "refresh EKS kubeconfig" \
  --parameters "$PARAMS" \
  --query Command.CommandId --output text)"

status=Pending
for _ in $(seq 1 60); do
  sleep 5
  status="$(aws ssm get-command-invocation --region "$AWS_REGION" \
    --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
    --query Status --output text 2>/dev/null || echo Pending)"
  case "$status" in Pending|InProgress|Delayed) continue ;; *) break ;; esac
done

aws ssm get-command-invocation --region "$AWS_REGION" \
  --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" \
  --query '[StandardOutputContent,StandardErrorContent]' --output text | sed 's/^/    /'

if [[ "$status" != Success ]]; then
  echo "==> failed ($status)" >&2
  exit 1
fi
echo "==> done"
