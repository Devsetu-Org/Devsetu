# QuickBite — wrong host for the hold, big job needs the big Worker

| Host | Offer (Spark ad) |
|------|------------------|
| `ds-spark-02` (A) | **1 core / 768m** |
| `ds-spark-03` (B) | **2 cores / 2048m** |
| `shell` | Submit client |

Setup left **`team-b-debug-hold`** RUNNING with **`--executor-memory 1024m`**. That request **cannot** schedule on A (768m), so Master put it on **B**. Storage/Executors show the hold’s **cached size is tiny** compared with 1024m — the ask is inflated.

**`store-rollup-mem`** also needs **1024m**. It cannot use A. Sharing B with the hold fails (lost task / crashed Python worker). Raising victim memory while the hold still sits on B does not fix placement.

Ticket: **keep team-B’s workload running** (a new app id after resubmit is OK). Do not “clear the runway” by deleting the hold forever.

## 1. See the plant

```bash
less ~/lab/failed_victim.out
less ~/lab/failed_victim.err
```

Master UI → Workers (offers) → Applications (`team-b-debug-hold` memory / which host).

Open the hold’s Application UI → **Storage** / **Executors**: used ≪ 1024m.

## 2. Fix — right-size + place hold on A, victim on B

1. Stop the old hold driver (`~/lab/cotenant.pid` / `team_b_debug_hold.py`).
2. So the smaller hold **must** land on A, briefly stop Worker B, then:

```bash
# on ds-spark-03
$SPARK_HOME/sbin/stop-worker.sh
```

3. Resubmit the hold with memory that **fits A** (any value ≤ 768m is fine — e.g. 512m):

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name team-b-debug-hold \
  --total-executor-cores 1 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/team_b_debug_hold.py
```

4. Confirm Master: hold memory is on **`ds-spark-02`**. Start Worker B again:

```bash
# on ds-spark-03
$SPARK_HOME/sbin/start-worker.sh "$SPARK_MASTER_URL" --cores 2 --memory 2048m
```

5. Run the victim (still 1024m) — it should take **B** alone and print `Y_OK` / `STATUS=ok`:

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name store-rollup-mem \
  --total-executor-cores 1 \
  --executor-memory 1024m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/store_rollup_mem.py
```

## 3. Investigation

Fill symptom → why hold was on B → usage clue → why victim needs B → fix → raise-only lesson.
