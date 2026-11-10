# Trace a job — three DAG shapes

Same submit shape every time (client mode from the shell). What changes is the **DAG**: no shuffle, one shuffle, then several.

Shared submit flags:

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --total-executor-cores 2 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  --name <app-name> \
  /opt/spark/lab/jobs/<script>.py
```

---

## Part 1 — `orders-narrow` (transforms only → **0** shuffles)

| | |
|---|---|
| **Script** | `/opt/spark/lab/jobs/orders_narrow.py` |
| **App name** | `orders-narrow` |
| **Work** | Read orders (explicit schema) → `filter` / `select` → **write** CSV |
| **DAG** | **One** stage — narrow transforms + write, **no** Shuffle Read/Write |
| **Hold** | ~**75s** |

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name orders-narrow \
  --total-executor-cores 2 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/orders_narrow.py
```

While it holds: Master UI → `app-…` id. Application UI → Jobs → Stages — **1** stage, empty Shuffle columns.

---

## Part 2 — `orders-by-store` (one action, **one** shuffle)

| | |
|---|---|
| **Script** | `/opt/spark/lab/jobs/orders_by_store.py` |
| **App name** | `orders-by-store` |
| **Work** | `groupBy("store_id").sum("amount")` → `collect` |
| **DAG** | **Two** stages — partial aggregate, **one** shuffle, final aggregate |
| **Hold** | ~**90s** |

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name orders-by-store \
  --total-executor-cores 2 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/orders_by_store.py
```

While it holds: new `app-…`. Stages — **2** stages; one has Shuffle Write, the next Shuffle Read.

---

## Part 3 — `store-rollup-join` (**multiple** shuffles)

| | |
|---|---|
| **Script** | `/opt/spark/lab/jobs/store_rollup_join.py` |
| **App name** | `store-rollup-join` |
| **Work** | Join orders ↔ stores → `groupBy("region").sum("amount")` → `collect` |
| **DAG** | **≥ 3** stages — join shuffle **and** aggregate shuffle |
| **Hold** | ~**3 minutes** |

```bash
spark-submit \
  --master "$SPARK_MASTER_URL" \
  --deploy-mode client \
  --name store-rollup-join \
  --total-executor-cores 2 \
  --executor-memory 512m \
  --conf spark.executor.memoryOverhead=128m \
  /opt/spark/lab/jobs/store_rollup_join.py
```

While it holds:

1. New `app-…` (third id).
2. Stages — more than Part 2; more than one shuffle boundary.
3. Open a stage → one **task** → record task id, executor id, Worker host (`ds-spark-02` or `ds-spark-03`).

---

## Investigation

Fill Parts 1 → 2 → 3, then the lesson page. Submit when every field is filled.
