# Spark-on-YARN lab image: Hadoop YARN (RM/NM) + Spark 3.5, with the Chapter 2
# join job and sample data baked in. Same path on every pod so spark.yarn.jars
# and application resources can use local:/ without HDFS.
#
# Build (repo root):
#   ./images/build-all.sh spark-yarn-lab
# Or locally:
#   docker build -t devsetu/spark-yarn-lab:v0.1 images/spark-yarn-lab
FROM eclipse-temurin:11-jdk-jammy

ARG HADOOP_VERSION=3.3.6
ARG SPARK_VERSION=3.5.3
ARG HADOOP_TGZ_URL=https://archive.apache.org/dist/hadoop/common/hadoop-${HADOOP_VERSION}/hadoop-${HADOOP_VERSION}.tar.gz
ARG SPARK_TGZ_URL=https://archive.apache.org/dist/spark/spark-${SPARK_VERSION}/spark-${SPARK_VERSION}-bin-hadoop3.tgz

ENV HADOOP_HOME=/opt/hadoop \
    SPARK_HOME=/opt/spark \
    HADOOP_CONF_DIR=/opt/hadoop/etc/hadoop \
    YARN_CONF_DIR=/opt/hadoop/etc/hadoop \
    SPARK_CONF_DIR=/opt/spark/conf \
    JAVA_HOME=/opt/java/openjdk \
    LAB_HOME=/opt/lab

ENV PATH="${SPARK_HOME}/bin:${SPARK_HOME}/sbin:${HADOOP_HOME}/bin:${HADOOP_HOME}/sbin:${JAVA_HOME}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash ca-certificates curl procps python3 tini vim-tiny \
  && ln -sf /usr/bin/vim.tiny /usr/bin/vim \
  && ln -sf /usr/bin/vim.tiny /usr/bin/vi \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/python3 /usr/bin/python

RUN curl -fsSL "$HADOOP_TGZ_URL" -o /tmp/hadoop.tgz \
  && tar -xzf /tmp/hadoop.tgz -C /opt \
  && mv "/opt/hadoop-${HADOOP_VERSION}" "$HADOOP_HOME" \
  && rm -f /tmp/hadoop.tgz \
  && curl -fsSL "$SPARK_TGZ_URL" -o /tmp/spark.tgz \
  && tar -xzf /tmp/spark.tgz -C /opt \
  && mv "/opt/spark-${SPARK_VERSION}-bin-hadoop3" "$SPARK_HOME" \
  && rm -f /tmp/spark.tgz \
  && mkdir -p \
    /var/hadoop/yarn/local \
    /var/hadoop/yarn/logs \
    /var/hadoop/yarn/staging \
    "$SPARK_HOME/logs" \
    "$SPARK_HOME/work" \
    "$SPARK_HOME/conf" \
  && (cd "$SPARK_HOME/jars" && tar -czf /opt/spark-yarn-jars.tgz ./*.jar) \
  && useradd -m -u 185 -s /bin/bash spark \
  && chown -R spark:spark /opt/hadoop /opt/spark /var/hadoop /opt/spark-yarn-jars.tgz

COPY lab/ "$LAB_HOME/"
RUN chmod 755 "$LAB_HOME"/bin/*.sh \
  && chown -R spark:spark "$LAB_HOME" \
  && cp "$LAB_HOME/conf/spark-defaults.conf" "$SPARK_HOME/conf/spark-defaults.conf" \
  && cp "$LAB_HOME/conf/log4j2.properties" "$SPARK_HOME/conf/log4j2.properties" \
  && chown spark:spark "$SPARK_HOME/conf"/*

USER spark
WORKDIR /opt/spark
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
