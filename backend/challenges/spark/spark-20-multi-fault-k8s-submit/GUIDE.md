# QuickBite — Multi-fault K8s submit

Three faults. Fix in order.

## Layer 1 — Namespace

Staging is quota-blocked. Notes / `~/lab/prod-namespace.txt` name the correct **prod** namespace.

## Layer 2 — Image

Switch off `apache/spark` to `$SPARK_K8S_IMAGE` and set  
`spark.kubernetes.container.image.pullSecrets=quickbite-registry-pull`.

## Layer 3 — Executor memory

`256m` heap with `256m` limit and no overhead → OOMKilled. Set  
`spark.executor.memoryOverhead` and raise `spark.kubernetes.executor.limit.memory`.

## Prove

Driver `store-rollup-k8s-capstone-…` **Succeeded** in prod. Investigation, then Submit.
