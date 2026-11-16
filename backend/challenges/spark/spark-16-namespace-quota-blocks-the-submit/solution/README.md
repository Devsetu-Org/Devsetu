# Solution — spark-16 Namespace Quota Blocks the Submit

## Setup plant

- ResourceQuota `team-spark-quota` (tight memory).
- Pod `debug-memory-hog` consuming most of the budget.
- Sibling prod namespace (empty). Wrapper `~/lab/submit-store-rollup-quota.sh`.

## Fix (either)

```bash
kubectl delete pod debug-memory-hog -n "$SPARK_K8S_NS"
# OR set spark.kubernetes.namespace / SPARK_K8S_TARGET_NS to $(cat ~/lab/prod-namespace.txt)
~/lab/submit-store-rollup-quota.sh
```

Keep `team-spark-quota`.

## Investigation

| Key | Value |
| --- | --- |
| blocker | `quota-hog` |
| fix | `delete-hog` or `use-prod` |
