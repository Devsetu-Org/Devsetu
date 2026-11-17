# QuickBite — Driver OOMKilled: Spark memory vs K8s limits

`spark.driver.memory` is **heap only**. The container also needs `spark.driver.memoryOverhead`. If the K8s limit equals the heap, the driver is **OOMKilled**.

## Forensics

```bash
~/lab/submit-store-rollup-driver-mem.sh
kubectl get pods -n "$SPARK_K8S_NS" -o wide
kubectl describe pod -n "$SPARK_K8S_NS" -l spark-role=driver | grep -A5 -E 'OOMKilled|Last State|Limits'
```

## Fix

Example:

```bash
--conf spark.driver.memory=512m \
--conf spark.driver.memoryOverhead=384m \
--conf spark.kubernetes.driver.limit.memory=1024m \
```

Resubmit until **Succeeded**. Investigation, then Submit.
