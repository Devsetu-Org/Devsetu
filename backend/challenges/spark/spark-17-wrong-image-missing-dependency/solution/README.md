# Solution — spark-17 Wrong Image, Missing Dependency

## Fix

In `~/lab/submit-store-rollup-deps.sh`:

1. `--conf spark.kubernetes.container.image=$SPARK_K8S_IMAGE`
2. `--conf spark.kubernetes.container.image.pullSecrets=quickbite-registry-pull`

Resubmit until Succeeded.

## Investigation

| Key | Value |
| --- | --- |
| failure | `missing-module` |
| fix | `team-image-pullsecret` |
