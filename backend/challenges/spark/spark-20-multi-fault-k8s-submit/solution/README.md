# Solution — spark-20 Multi-Fault K8s Submit

1. Set `NS` / `spark.kubernetes.namespace` to `$(cat ~/lab/prod-namespace.txt)`.
2. Image `$SPARK_K8S_IMAGE` + `pullSecrets=quickbite-registry-pull`.
3. Executor: e.g. `memory=512m`, `memoryOverhead=128m`, `limit.memory=768m`.

## Investigation

| Key | Value |
| --- | --- |
| layer1 | `namespace` |
| layer2 | `image` |
| layer3 | `memory` |
