#!/usr/bin/env bash
# Spark-09: start YARN (RM + NMs), seed answers. Learner submits client + cluster.
source "$(dirname "${BASH_SOURCE[0]}")/../_lib/lab.sh"

yarn_bootstrap
ok "YARN up: RM on ds-spark-01, NMs on ds-spark-02 and ds-spark-03"
