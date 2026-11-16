# Spark-on-Kubernetes lab image: Spark 3.5 + kubectl + Chapter 3 join job/data.
#
# Build (repo root):
#   ./images/build-all.sh spark-k8s-lab
# Or local arm64:
#   docker build -t devsetu/spark-k8s-lab:v0.1 images/spark-k8s-lab
FROM apache/spark:3.5.3

ARG KUBECTL_VERSION=1.31.4
USER root

ENV LAB_HOME=/opt/lab \
    SPARK_HOME=/opt/spark \
    SPARK_CONF_DIR=/opt/spark/conf \
    JAVA_HOME=/opt/java/openjdk

ENV PATH="${SPARK_HOME}/bin:${SPARK_HOME}/sbin:${JAVA_HOME}/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# apache/spark is Ubuntu-based and already has python3. Add curl + kubectl for
# learner forensics; vim-tiny for shell editing.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl vim-tiny \
  && ln -sf /usr/bin/vim.tiny /usr/bin/vim \
  && ln -sf /usr/bin/vim.tiny /usr/bin/vi \
  && ARCH="$(dpkg --print-architecture)" \
  && case "$ARCH" in \
       amd64) KARCH=amd64 ;; \
       arm64) KARCH=arm64 ;; \
       *) echo "unsupported arch: $ARCH" >&2; exit 1 ;; \
     esac \
  && curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${KARCH}/kubectl" \
       -o /usr/local/bin/kubectl \
  && chmod 755 /usr/local/bin/kubectl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p "$LAB_HOME" "$SPARK_HOME/work" "$SPARK_HOME/logs" \
  && chown -R spark:spark "$LAB_HOME" "$SPARK_HOME/work" "$SPARK_HOME/logs"

COPY lab/ "$LAB_HOME/"
RUN mkdir -p "$SPARK_HOME/conf" \
  && chmod 755 "$LAB_HOME"/bin/*.sh 2>/dev/null || true \
  && chown -R spark:spark "$LAB_HOME" \
  && if [ -f "$LAB_HOME/conf/spark-defaults.conf" ]; then \
       cp "$LAB_HOME/conf/spark-defaults.conf" "$SPARK_HOME/conf/spark-defaults.conf"; \
     fi \
  && if [ -f "$LAB_HOME/conf/log4j2.properties" ]; then \
       cp "$LAB_HOME/conf/log4j2.properties" "$SPARK_HOME/conf/log4j2.properties"; \
     fi \
  && chown -R spark:spark "$SPARK_HOME/conf"

USER spark
WORKDIR /opt/spark
CMD ["sleep", "infinity"]
