# QuickBite — DNS + memory + disk (peel the onion)

| Host | Role |
|------|------|
| `ds-spark-01` | Master |
| `ds-spark-02` / `03` | Workers — `SPARK_LOCAL_DIRS=$SPARK_HOME/work/spark-local` |
| `shell` | Client driver (broken hostname planted here) |

Three faults are live at once. Fixing only one is not enough — each layer hides behind the previous symptom.

## The three layers

1. **Driver host** — shell `spark-defaults.conf` sets `spark.driver.host=broken-host.quickbite.invalid`. Executors cannot call back to the driver.
2. **Memory overhead** — `spark.executor.memoryOverhead=48m` is too small for this PySpark burn (lost task / Python worker crash once the host is fixed).
3. **Local disk** — `DISK_FILLER` under `$SPARK_HOME/work/spark-local` on the Workers (shuffle pressure once memory is fixed).

## 1. See the plant

```bash
less ~/lab/failed_triple.out
less ~/lab/failed_triple.err
cat ~/lab/planted_driver_host.txt
grep -E 'driver.host|memoryOverhead' /opt/spark/conf/spark-defaults.conf
```

On Workers:

```bash
ls -la $SPARK_HOME/work/spark-local
df -h $SPARK_HOME/work/spark-local
```

## 2. Fix (in order)

**Layer 1 — host** on the shell:

```bash
# Remove or replace the planted line in spark-defaults.conf
# Prefer the real shell hostname, or delete spark.driver.host and rely on SPARK_LOCAL_HOSTNAME.
sed -i '/broken-host\.quickbite\.invalid/d' /opt/spark/conf/spark-defaults.conf
# Optional explicit good host:
# echo "spark.driver.host=$(hostname)" >> /opt/spark/conf/spark-defaults.conf
```

**Layer 2 — overhead** on the shell (and Workers if you mirrored defaults):

```bash
sed -i 's/spark.executor.memoryOverhead 48m/spark.executor.memoryOverhead 128m/' /opt/spark/conf/spark-defaults.conf
```

**Layer 3 — disk** on both Workers:

```bash
rm -f $SPARK_HOME/work/spark-local/DISK_FILLER
```

Re-run:

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name store-rollup-triple \
  --total-executor-cores 2 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/store_rollup_triple.py
```

Expect `TRIPLE_OK` and `/opt/spark/lab/last_run.txt` → `STATUS=ok`.

## 3. Investigation

First layer → second → third → peel order → wrong fix. Submit when every field is filled.
