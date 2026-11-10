#!/usr/bin/env bash
set -euo pipefail
: "${HADOOP_HOME:=/opt/hadoop}"
: "${HADOOP_CONF_DIR:=/opt/hadoop/etc/hadoop}"
export HADOOP_HOME HADOOP_CONF_DIR YARN_CONF_DIR="${YARN_CONF_DIR:-$HADOOP_CONF_DIR}"
export JAVA_HOME="${JAVA_HOME:-/opt/java/openjdk}"
export YARN_NODEMANAGER_HEAPSIZE="${YARN_NODEMANAGER_HEAPSIZE:-256}"

/opt/lab/bin/write-yarn-conf.sh

if pgrep -f 'org.apache.hadoop.yarn.server.nodemanager.NodeManager' >/dev/null 2>&1; then
  echo "NodeManager already running"
  exit 0
fi

exec "$HADOOP_HOME/bin/yarn" nodemanager
