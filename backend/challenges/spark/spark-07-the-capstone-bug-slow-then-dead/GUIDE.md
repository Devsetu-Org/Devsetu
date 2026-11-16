# QuickBite — FetchFailed under local disk pressure

| Host | Role |
|------|------|
| `ds-spark-01` | Master |
| `ds-spark-02` / `03` | Workers — `SPARK_LOCAL_DIRS=$SPARK_HOME/work/spark-local` |
| `shell` | Submit client |

Setup warmed the cluster and planted **disk pressure on shuffle locals**: a `DISK_FILLER` under `spark-local`, and a **janitor** that deletes `blockmgr` / `shuffle_*` files under `$SPARK_HOME/work` (cleanup gone wrong under pressure). Early work can look fine; the **shuffle** boundary dies with **FetchFailed** / stage failure.

This is a **platform** incident — local dirs / disk — not Lab 6 placement and not editing `cache()` in the job.

## 1. See the failure

```bash
less ~/lab/failed_shuffle.out
less ~/lab/failed_shuffle.err
```

Reproduce:

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name store-rollup-shuffle \
  --total-executor-cores 2 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/store_rollup_shuffle.py
```

On each Worker:

```bash
df -h $SPARK_HOME/work/spark-local
ls -la $SPARK_HOME/work/spark-local
ps -ef | grep shuffle_janitor
```

## 2. Fix

On **both** Workers:

1. Stop the janitor (`~/lab/shuffle_janitor.pid` / `shuffle_janitor.sh`).
2. Remove `$SPARK_HOME/work/spark-local/DISK_FILLER`.
3. Confirm free space under `spark-local`.

Re-run the same `spark-submit`. Expect `SHUFFLE_OK` and `/opt/spark/lab/last_run.txt` → `STATUS=ok`.

## 3. Investigation

Timeline → three signals → cause → fix. Submit when every field is filled.
