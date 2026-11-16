#!/usr/bin/env bash
# Shared spark-submit fragment for Chapter 3 labs (sourced or copied into ~/lab).
# Expects: SPARK_K8S_MASTER, SPARK_K8S_NS, SPARK_K8S_IMAGE, SPARK_K8S_SA
set -euo pipefail

: "${SPARK_K8S_MASTER:?}"
: "${SPARK_K8S_NS:?}"
: "${SPARK_K8S_IMAGE:?}"
: "${SPARK_K8S_SA:?}"

echo "--master ${SPARK_K8S_MASTER}"
echo "--deploy-mode cluster"
echo "--conf spark.kubernetes.namespace=${SPARK_K8S_NS}"
echo "--conf spark.kubernetes.authenticate.driver.serviceAccountName=${SPARK_K8S_SA}"
echo "--conf spark.kubernetes.container.image=${SPARK_K8S_IMAGE}"
echo "--conf spark.kubernetes.driver.podTemplateContainerName=spark-kubernetes-driver"
echo "--conf spark.kubernetes.executor.podTemplateContainerName=spark-kubernetes-executor"
