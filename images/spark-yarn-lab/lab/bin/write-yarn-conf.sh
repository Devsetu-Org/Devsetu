#!/usr/bin/env bash
# Write core-site / yarn-site / capacity-scheduler / mapred-site for this host.
# Env: YARN_RM_HOST (default ds-spark-01), NM_MEMORY_MB, NM_VCORES.
set -euo pipefail

: "${HADOOP_CONF_DIR:=/opt/hadoop/etc/hadoop}"
RM_HOST="${YARN_RM_HOST:-ds-spark-01}"
NM_MEMORY_MB="${NM_MEMORY_MB:-1536}"
NM_VCORES="${NM_VCORES:-2}"
MAX_ALLOC_MB="${YARN_MAX_ALLOC_MB:-1024}"
MAX_ALLOC_VCORES="${YARN_MAX_ALLOC_VCORES:-2}"

mkdir -p "$HADOOP_CONF_DIR" \
  /opt/hadoop/logs \
  /var/hadoop/yarn/local \
  /var/hadoop/yarn/logs \
  /var/hadoop/yarn/staging \
  /opt/spark/work/eventlogs

cat > "$HADOOP_CONF_DIR/core-site.xml" <<EOF
<?xml version="1.0"?>
<configuration>
  <property>
    <name>fs.defaultFS</name>
    <value>file:///</value>
  </property>
  <property>
    <name>hadoop.tmp.dir</name>
    <value>/var/hadoop/tmp</value>
  </property>
</configuration>
EOF

cat > "$HADOOP_CONF_DIR/yarn-site.xml" <<EOF
<?xml version="1.0"?>
<configuration>
  <property>
    <name>yarn.resourcemanager.hostname</name>
    <value>${RM_HOST}</value>
  </property>
  <property>
    <name>yarn.resourcemanager.bind-host</name>
    <value>0.0.0.0</value>
  </property>
  <property>
    <name>yarn.resourcemanager.address</name>
    <value>${RM_HOST}:8032</value>
  </property>
  <property>
    <name>yarn.resourcemanager.scheduler.address</name>
    <value>${RM_HOST}:8030</value>
  </property>
  <property>
    <name>yarn.resourcemanager.resource-tracker.address</name>
    <value>${RM_HOST}:8031</value>
  </property>
  <property>
    <name>yarn.resourcemanager.webapp.address</name>
    <value>0.0.0.0:8088</value>
  </property>
  <property>
    <name>yarn.nodemanager.hostname</name>
    <value>$(hostname -f 2>/dev/null || hostname)</value>
  </property>
  <property>
    <name>yarn.nodemanager.bind-host</name>
    <value>0.0.0.0</value>
  </property>
  <property>
    <name>yarn.nodemanager.webapp.address</name>
    <value>0.0.0.0:8042</value>
  </property>
  <property>
    <name>yarn.nodemanager.resource.memory-mb</name>
    <value>${NM_MEMORY_MB}</value>
  </property>
  <property>
    <name>yarn.nodemanager.resource.cpu-vcores</name>
    <value>${NM_VCORES}</value>
  </property>
  <property>
    <name>yarn.scheduler.minimum-allocation-mb</name>
    <value>256</value>
  </property>
  <property>
    <name>yarn.scheduler.maximum-allocation-mb</name>
    <value>${MAX_ALLOC_MB}</value>
  </property>
  <property>
    <name>yarn.scheduler.minimum-allocation-vcores</name>
    <value>1</value>
  </property>
  <property>
    <name>yarn.scheduler.maximum-allocation-vcores</name>
    <value>${MAX_ALLOC_VCORES}</value>
  </property>
  <property>
    <name>yarn.nodemanager.local-dirs</name>
    <value>/var/hadoop/yarn/local</value>
  </property>
  <property>
    <name>yarn.nodemanager.log-dirs</name>
    <value>/var/hadoop/yarn/logs</value>
  </property>
  <property>
    <name>yarn.nodemanager.aux-services</name>
    <value>mapreduce_shuffle</value>
  </property>
  <property>
    <name>yarn.nodemanager.disk-health-checker.max-disk-utilization-per-disk-percentage</name>
    <value>99.0</value>
  </property>
  <property>
    <name>yarn.nodemanager.vmem-check-enabled</name>
    <value>false</value>
  </property>
  <property>
    <name>yarn.nodemanager.pmem-check-enabled</name>
    <value>false</value>
  </property>
  <property>
    <name>yarn.log-aggregation-enable</name>
    <value>false</value>
  </property>
  <property>
    <name>yarn.acl.enable</name>
    <value>false</value>
  </property>
  <property>
    <name>yarn.resourcemanager.scheduler.class</name>
    <value>org.apache.hadoop.yarn.server.resourcemanager.scheduler.capacity.CapacityScheduler</value>
  </property>
</configuration>
EOF

cat > "$HADOOP_CONF_DIR/capacity-scheduler.xml" <<'EOF'
<?xml version="1.0"?>
<configuration>
  <property>
    <name>yarn.scheduler.capacity.root.queues</name>
    <value>default</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.maximum-capacity</name>
    <value>100</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.user-limit-factor</name>
    <value>1</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.root.default.state-locality.disable-switch</name>
    <value>true</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.maximum-am-resource-percent</name>
    <value>0.5</value>
  </property>
  <property>
    <name>yarn.scheduler.capacity.resource-calculator</name>
    <value>org.apache.hadoop.yarn.util.resource.DefaultResourceCalculator</value>
  </property>
</configuration>
EOF

cat > "$HADOOP_CONF_DIR/mapred-site.xml" <<'EOF'
<?xml version="1.0"?>
<configuration>
  <property>
    <name>mapreduce.framework.name</name>
    <value>yarn</value>
  </property>
</configuration>
EOF

echo "wrote YARN conf for RM=${RM_HOST} nmMemory=${NM_MEMORY_MB}m nmVcores=${NM_VCORES}"
