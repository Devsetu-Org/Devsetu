# Solution — spark-19 Driver OOMKilled

## Fix

```bash
--conf spark.driver.memory=512m \
--conf spark.driver.memoryOverhead=384m \
--conf spark.kubernetes.driver.limit.memory=1024m \
```

## Investigation

| Key | Value |
| --- | --- |
| symptom | `oomkilled` |
| fix | `overhead-and-limit` |
