# QuickBite — post-maintenance mess

| Host | Role |
|------|------|
| `ds-spark-01` | Master (should be up) |
| `ds-spark-02` / `03` | Workers — broken by weekend maintenance |
| `shell` | Submit client |

Weekend automation left three stacked faults. Fix **all three** before `store-rollup-probe` stays green.

## What maintenance broke

1. **Stale Master URL** — `~/lab/MAINTENANCE_MASTER` and `~/lab/maintenance_notes.txt`. Workers were pointed at `old-master.quickbite.internal`. Use the real `$SPARK_MASTER_URL`, not that file.
2. **Locked work dirs** — `$SPARK_HOME/work` on the Workers is `chmod 000` (executors cannot stage).
3. **Broken event log path** — `/opt/spark/work/eventlogs` is a **file**, not a directory (see `spark.eventLog.dir` in `spark-defaults.conf`).

## 1. See the plant

```bash
less ~/lab/maintenance_notes.txt
cat ~/lab/MAINTENANCE_MASTER
echo "$SPARK_MASTER_URL"
less ~/lab/failed_probe.out
less ~/lab/failed_probe.err
```

On each Worker:

```bash
ls -ld $SPARK_HOME/work
ls -la $SPARK_HOME/work/eventlogs
ps -ef | grep Worker
```

Master UI → Workers (expect missing / not ALIVE).

## 2. Fix (all three)

On **both** Workers:

```bash
# Unlock work
chmod 755 $SPARK_HOME/work

# Restore eventlogs as a directory
rm -f $SPARK_HOME/work/eventlogs
mkdir -p $SPARK_HOME/work/eventlogs

# Stop any Worker that registered against the stale Master
$SPARK_HOME/sbin/stop-worker.sh

# Start against the REAL Master
$SPARK_HOME/sbin/start-worker.sh "$SPARK_MASTER_URL" --cores 2 --memory 1536m
```

On the Master too — restore `eventlogs` the same way (`rm -f` then `mkdir -p`).

Confirm Master lists **2 ALIVE** Workers.

Re-run:

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name store-rollup-probe \
  --total-executor-cores 2 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/store_rollup_probe.py
```

Expect `PROBE_OK` and `/opt/spark/lab/last_run.txt` → `STATUS=ok`.

## 3. Investigation

Stale Master clue → work-dir fault → event-log fault → fix order → wrong fix. Submit when every field is filled.
