#!/usr/bin/env bash
# Spark-09: start YARN and plant a standalone submit wrapper to migrate.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

yarn_bootstrap

# Prove the join job is present before giving the learner the wrapper.
in_shell 'test -f /opt/lab/jobs/store_join.py && test -f /opt/lab/data/orders.csv' \
  || { echo "lab job / data missing from image" >&2; exit 1; }

in_shell '
  mkdir -p "$HOME/lab"
  cat > "$HOME/lab/submit-store-rollup.sh" <<'"'"'EOF'"'"'
#!/usr/bin/env bash
set -euo pipefail

# Copied from the Chapter 1 standalone cluster. Migrate this wrapper to YARN.
MODE="${1:-client}"

spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name store-rollup-standalone \
  --total-executor-cores 2 \
  --executor-memory 512m \
  /opt/lab/jobs/store_join.py
EOF
  chmod +x "$HOME/lab/submit-store-rollup.sh"

  cat > "$HOME/lab/notes.txt" <<EOF
Chapter 2.1 — YARN forensics, then fix the wrapper
1) Forensics: yarn node -list  (want 2 active); RM :8088 / NM :8042
2) Fix: ~/lab/submit-store-rollup.sh  (still standalone — will not work on YARN)
   After repair:
     ~/lab/submit-store-rollup.sh client
     ~/lab/submit-store-rollup.sh cluster
Client name:  store-rollup-client
Cluster name: store-rollup-cluster
EOF
'

ok "YARN up: RM on ds-spark-01, NMs on ds-spark-02 and ds-spark-03"
