# QuickBite — Wrong image, missing dependency

On Kubernetes **the image is the environment**. Base `apache/spark` has no QuickBite `quickbite_utils` module.

## Forensics

```bash
~/lab/submit-store-rollup-deps.sh
kubectl get pods -n "$SPARK_K8S_NS" -o wide
kubectl logs -n "$SPARK_K8S_NS" -l spark-role=driver --tail=80
# expect ModuleNotFoundError / ImportError for quickbite_utils
```

## Fix

1. Set `spark.kubernetes.container.image` to `$SPARK_K8S_IMAGE` (team lab image).
2. Add platform-required  
   `spark.kubernetes.container.image.pullSecrets=quickbite-registry-pull`  
   (secret already exists in the namespace).
3. Resubmit until the driver **Succeeded**.

## Prove

Investigation + Submit.
