#!/usr/bin/env bash
# Smoke-test Software Engineer Git Chapter 1 on a real EKS linux box.
# Prereq: labs-linux (or elastic) has a Ready node; KUBECONFIG points at the lab cluster.
#
# Usage (repo root):
#   ./scripts/validate-git-ch1.sh              # all of chapter 1 (git-01, git-02, git-04)
#   ./scripts/validate-git-ch1.sh git-01 git-02
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export KUBECONFIG="${KUBECONFIG:-$ROOT/kube/k8s-lab.kubeconfig}"
NS="${VALIDATE_GIT_NS:-dl-git-validate}"
IMAGE="${LINUX_LAB_IMAGE:-devsetu/linux-lab:v0.6}"
BOX_POD=box
BOX_CONTAINER=box

LABS=(
  git-01-first-commit-on-sprint-service
  git-02-branch-for-the-flag-fix
  git-04-amend-the-last-commit
)
if [[ $# -gt 0 ]]; then
  LABS=("$@")
fi

need_linux_node() {
  local n
  n="$(kubectl get nodes -l devlabs.io/pool=linux --no-headers 2>/dev/null | awk '$2 ~ /^Ready/ {print $1; exit}')"
  [[ -n "$n" ]] || {
    echo "No Ready linux-pool node. Run: ./deploy/eks/eks-linux.sh base   (or up if Karpenter is installed)" >&2
    exit 1
  }
  echo "==> using linux node: $n"
}

ensure_box() {
  kubectl get ns "$NS" >/dev/null 2>&1 || kubectl create ns "$NS"
  if kubectl -n "$NS" get pod "$BOX_POD" >/dev/null 2>&1; then
    phase="$(kubectl -n "$NS" get pod "$BOX_POD" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
    if [[ "$phase" == "Running" ]]; then
      echo "==> reusing Running box in $NS"
      return 0
    fi
    echo "==> deleting non-Running box ($phase)"
    kubectl -n "$NS" delete pod "$BOX_POD" --wait=true --timeout=120s || true
  fi
  echo "==> creating unprivileged linux box ($IMAGE)"
  cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: $BOX_POD
  namespace: $NS
  labels:
    app: linux-box
    app.kubernetes.io/managed-by: devlabs-validate
  annotations:
    karpenter.sh/do-not-disrupt: "true"
spec:
  hostUsers: false
  hostname: dev-box
  automountServiceAccountToken: false
  enableServiceLinks: false
  terminationGracePeriodSeconds: 10
  nodeSelector:
    devlabs.io/pool: linux
  tolerations:
    - key: devlabs.io/pool
      value: linux
      effect: NoSchedule
  containers:
    - name: $BOX_CONTAINER
      image: $IMAGE
      imagePullPolicy: IfNotPresent
      command: ["/bin/sh", "-c", "touch /home/learner/.hushlogin 2>/dev/null; exec sleep infinity"]
      securityContext:
        capabilities:
          drop: [ALL]
          add: [SETUID, SETGID, CHOWN, DAC_OVERRIDE, FOWNER, FSETID]
        seccompProfile:
          type: RuntimeDefault
      resources:
        requests: {cpu: 250m, memory: 384Mi}
        limits: {cpu: "1", memory: 1Gi}
      volumeMounts:
        - {name: run, mountPath: /run}
        - {name: run-lock, mountPath: /run/lock}
        - {name: tmp, mountPath: /tmp}
  volumes:
    - name: run
      emptyDir: {medium: Memory, sizeLimit: 64Mi}
    - name: run-lock
      emptyDir: {medium: Memory, sizeLimit: 8Mi}
    - name: tmp
      emptyDir: {sizeLimit: 1Gi}
YAML
  echo "==> waiting for box Ready"
  kubectl -n "$NS" wait --for=condition=Ready "pod/$BOX_POD" --timeout=300s
}

run_script() {
  local challenge=$1 kind=$2
  local script="$ROOT/backend/challenges/git/$challenge/$kind.sh"
  [[ -f "$script" ]] || { echo "missing $script" >&2; return 1; }
  echo "---- $challenge $kind ----"
  LEARNER_NS="$NS" BOX_POD="$BOX_POD" BOX_CONTAINER="$BOX_CONTAINER" CHALLENGE_ID="$challenge" \
    bash "$script"
}

# Solve as learner inside the box (mirrors solution README for each lab).
solve_lab() {
  local challenge=$1
  case "$challenge" in
    git-01-first-commit-on-sprint-service)
      # Prefer grader seeds (authoritative). Ticket lists the same two org ids.
      kubectl -n "$NS" exec "$BOX_POD" -c "$BOX_CONTAINER" -- bash -lc '
        set -euo pipefail
        A=$(cat /root/.lab/rollout-org-a)
        B=$(cat /root/.lab/rollout-org-b)
        [[ -n "$A" && -n "$B" ]] || { echo "bad rollout org seeds: A=$A B=$B" >&2; exit 1; }
        runuser -u learner -- env HOME=/home/learner bash -s -- "$A" "$B" <<'"'"'SOLVE'"'"'
set -euo pipefail
A="$1"
B="$2"
git config --global user.name "Ada Learner"
git config --global user.email "ada@forgeboard.internal"
cd ~
git clone learner@git.forgeboard.internal:/srv/git/sprint-service.git
cd ~/sprint-service
sed -i "s/^${A} = beta$/${A} = full/" config/app.conf
sed -i "s/^${B} = beta$/${B} = full/" config/app.conf
git add config/app.conf
git commit -m "Enable full agentic sprints for early-access enterprises"
git push origin main
git status --porcelain
SOLVE
      '
      ;;
    git-02-branch-for-the-flag-fix)
      kubectl -n "$NS" exec "$BOX_POD" -c "$BOX_CONTAINER" -- bash -lc '
        set -euo pipefail
        runuser -u learner -- env HOME=/home/learner bash -lc "
          set -euo pipefail
          cd ~/sprint-service
          git switch -c fix/agentic-default
          git add config/app.conf
          git commit -m \"Keep agentic sprints default on beta for tenant rollouts\"
          git add README.md
          git commit -m \"Document how to run sprint-service locally\"
          git add src/main.py
          git commit -m \"Add version constant and print it in the banner\"
          git push -u origin fix/agentic-default
          git status --porcelain
        "
      '
      ;;
    git-04-amend-the-last-commit)
      kubectl -n "$NS" exec "$BOX_POD" -c "$BOX_CONTAINER" -- bash -lc '
        set -euo pipefail
        runuser -u learner -- env HOME=/home/learner bash -lc "
          set -euo pipefail
          cd ~/sprint-service
          git add docs/agentic-default.md
          git commit --amend --no-edit
          git push --force-with-lease origin fix/agentic-default
          git status --porcelain
        "
      '
      ;;
    *)
      echo "no solve path for $challenge" >&2
      return 1
      ;;
  esac
}

need_linux_node
ensure_box

fail=0
for lab in "${LABS[@]}"; do
  echo ""
  echo "========== $lab =========="
  if ! run_script "$lab" setup; then
    echo "FAIL setup $lab" >&2
    fail=1
    continue
  fi
  if ! solve_lab "$lab"; then
    echo "FAIL solve $lab" >&2
    fail=1
    continue
  fi
  if ! run_script "$lab" grade; then
    echo "FAIL grade $lab" >&2
    fail=1
    continue
  fi
  echo "PASS $lab"
done

if [[ "$fail" -ne 0 ]]; then
  echo ""
  echo "Some labs failed (namespace $NS kept for inspection)." >&2
  exit 1
fi
echo ""
echo "All Chapter 1 Git labs passed on $NS."
if [[ "${KEEP_VALIDATE_NS:-}" != "1" ]]; then
  kubectl delete ns "$NS" --wait=false >/dev/null 2>&1 || true
fi
