# Solution — spark-18 Dynamic Allocation Without the Shuffle Service

## Fix

```bash
--conf spark.dynamicAllocation.enabled=false \
--conf spark.executor.instances=2 \
```

Remove `enabled=true` / min/max idle timeouts. Resubmit.

## Investigation

| Key | Value |
| --- | --- |
| rootCause | `dyn-alloc-no-ess` |
| fix | `disable-dyn-alloc` |
