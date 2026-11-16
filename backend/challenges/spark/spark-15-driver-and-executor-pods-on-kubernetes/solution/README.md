# Solution — spark-15 Driver and Executor Pods on Kubernetes

## Setup plant

- Shape `spark-k8s`: shell with SA `spark-lab`, in-cluster kubectl, NetPol allowing API :443.
- Incomplete `~/lab/submit-store-rollup-k8s.sh` (executor conf commented).

## Fix

Uncomment executor conf:

```bash
--conf spark.executor.instances=2 \
--conf spark.executor.cores=1 \
--conf spark.executor.memory=256m \
--conf spark.executor.memoryOverhead=128m \
--conf spark.kubernetes.executor.limit.memory=448m \
```

Submit, optionally delete one executor, wait for driver Succeeded.

## Investigation answers

| Key | Value |
| --- | --- |
| resourceManager | `k8s` |
| deployMode | `cluster` |
| killExecutor | `replaced` |
