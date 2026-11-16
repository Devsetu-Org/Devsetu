# QuickBite — Driver and executor pods on Kubernetes

Chapter 1 ran Spark on a Master + Workers. Chapter 2 moved the same job onto YARN.
This chapter uses **Kubernetes** as the resource manager.

| Piece | Role now |
|-------|----------|
| Kubernetes API | Schedules driver and executor **pods** |
| `shell` | Submit client (`spark-submit`, `kubectl`) |
| `$SPARK_K8S_NS` | Your team namespace (QuickBite “spark” namespace) |

There is no Spark Master and no YARN ResourceManager in this lab.

## 1. Forensics

```bash
kubectl get pods -n "$SPARK_K8S_NS" -o wide
kubectl auth can-i create pods -n "$SPARK_K8S_NS"
```

## 2. Finish the submit wrapper

```bash
sed -n '1,120p' ~/lab/submit-store-rollup-k8s.sh
```

The TODO block for executor instances / cores / memory is commented out. Uncomment and keep the platform shape:

- `spark.executor.instances=2` (planted as `0` — change it)
- `spark.executor.cores=1`
- `spark.executor.memory=512m`
- `spark.executor.memoryOverhead=128m`
- `spark.kubernetes.executor.limit.memory=768m`

## 3. Submit and watch pods

```bash
~/lab/submit-store-rollup-k8s.sh
kubectl get pods -n "$SPARK_K8S_NS" -o wide -w
```

Expect a `store-rollup-k8s-…-driver` pod and two `…-exec-…` pods. Use `kubectl logs` on the driver for the join output.

## 4. Kill one executor

While the job is still running (or on a fresh submit if it finished quickly):

```bash
kubectl delete pod -n "$SPARK_K8S_NS" -l spark-role=executor --field-selector=status.phase=Running <one-exec-pod>
# or: kubectl delete pod <exec-pod-name> -n "$SPARK_K8S_NS"
```

Spark should schedule a **replacement** executor without you resubmitting. Wait until the driver pod phase is **Succeeded**.

## 5. Investigation

Fill the Investigation tab (resource manager, deploy mode, what happened after the kill), then Submit.
