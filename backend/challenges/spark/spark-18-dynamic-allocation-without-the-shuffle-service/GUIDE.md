# QuickBite — Dynamic allocation without the shuffle service

Dynamic Allocation on Kubernetes needs an **External Shuffle Service**. This pool does not run one.

## Forensics

```bash
~/lab/submit-store-rollup-dynamic.sh
kubectl logs -n "$SPARK_K8S_NS" -l spark-role=driver --tail=100
# look for FetchFailed / shuffle errors after executor scale-down
```

## Fix (graded path)

In `~/lab/submit-store-rollup-dynamic.sh`:

- `spark.dynamicAllocation.enabled=false`
- `spark.executor.instances=2`

(Platform ideal: ESS DaemonSet — not required here; baseline PSA.)

Resubmit until **Succeeded**. Investigation, then Submit.
