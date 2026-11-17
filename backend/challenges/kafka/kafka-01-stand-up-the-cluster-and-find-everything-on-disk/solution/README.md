# kafka-01 — solution notes (ZooKeeper era)

Orientation on **ZooKeeper + classic brokers**. Lab 2+ is KRaft.

1. On `zookeeper`: find QuorumPeer PID; live dataDir is `/data` (not `/opt/zookeeper/data`).
2. On each broker: find Kafka PID; read `KAFKA_LOG_DIRS` from `/proc/<pid>/environ` → `/var/lib/kafka/data`.
3. On shell: `zookeeper-shell.sh "$ZOOKEEPER_CONNECT" get /controller` → `brokerid`.
4. Investigation: logDirsSource=`process-env`, controlPlane=`zookeeper`.

Local e2e: `./solution/validate-local.sh`
