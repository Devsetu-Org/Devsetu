#!/usr/bin/env bash
set -euo pipefail
: "${HADOOP_HOME:=/opt/hadoop}"
: "${HADOOP_CONF_DIR:=/opt/hadoop/etc/hadoop}"
export HADOOP_HOME HADOOP_CONF_DIR YARN_CONF_DIR="${YARN_CONF_DIR:-$HADOOP_CONF_DIR}"
export JAVA_HOME="${JAVA_HOME:-/opt/java/openjdk}"
export YARN_RESOURCEMANAGER_HEAPSIZE="${YARN_RESOURCEMANAGER_HEAPSIZE:-384}"

/opt/lab/bin/write-yarn-conf.sh

if pgrep -f 'org.apache.hadoop.yarn.server.resourcemanager.ResourceManager' >/dev/null 2>&1; then
  echo "ResourceManager already running"
  exit 0
fi

# Foreground-friendly: yarn daemon scripts background by default; use spark-class style.
exec "$HADOOP_HOME/bin/yarn" resourcemanager
