# QuickBite — YARN forensics, then fix the submit wrapper

QuickBite migrated the Chapter 1 standalone cluster to **YARN**. Same three hosts; **roles differ**:

| Host | Role now |
|------|----------|
| `ds-spark-01` | **ResourceManager** (UI `:8088`) |
| `ds-spark-02` | **NodeManager** (UI `:8042`) |
| `ds-spark-03` | **NodeManager** (UI `:8042`) |
| `shell` | Submit client |

No Spark Master / Worker. Setup already started RM + both NMs.

## 1. Forensics first

```bash
yarn node -list
# expect 2 active nodes — or open the RM UI
```

Walk Investigation **Forensics**: who owns `ds-spark-01`, whether Master/Worker still exist, how many NMs are active. Know which RM panel lists applications and which NM view shows containers — you will need those after the fix.

## 2. Fix — `submit-store-rollup.sh`

The old standalone wrapper is still on disk:

```bash
sed -n '1,120p' ~/lab/submit-store-rollup.sh
~/lab/submit-store-rollup.sh client   # expect failure / wrong contract
```

It targets `$SPARK_MASTER_URL` and `--total-executor-cores`. That does not work on YARN. Repair it so `$1` selects `client` or `cluster`, master is `yarn`, name is `store-rollup-$MODE`, and resources are 2 executors × 1 core × 512m:

```bash
MODE="${1:-client}"
spark-submit \
  --master yarn \
  --deploy-mode "$MODE" \
  --name "store-rollup-$MODE" \
  --num-executors 2 \
  --executor-cores 1 \
  --executor-memory 512m \
  /opt/lab/jobs/store_join.py
```

Drop `--total-executor-cores` — YARN wants instance count and cores per executor.

## 3. Prove both modes

```bash
~/lab/submit-store-rollup.sh client
~/lab/submit-store-rollup.sh cluster
```

Client: driver on **shell**. Cluster: driver is the AM on `ds-spark-02` or `ds-spark-03`. Capture both `application_…` ids from `yarn application -list -appStates ALL` / the RM Applications panel.

## 4. Investigation

Forensics → fix → client → cluster → lesson. Submit grades the repaired wrapper and both FINISHED apps — forensics alone is not enough.
