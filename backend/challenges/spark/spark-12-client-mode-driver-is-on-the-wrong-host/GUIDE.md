# QuickBite — edge driver died; then fix the lasting path

| Host | Role |
|------|------|
| `ds-spark-01` | ResourceManager `:8088` |
| `ds-spark-02` / `03` | NodeManagers `:8042` |
| `shell` | Submit client (unsafe place for a production driver) |

**Shared mount:** `/mnt/lab-shared` — same directory on shell and every NodeManager. Put production inputs here once; do not rely on `$HOME` on shell.

## 1. Overnight failure

```bash
cat ~/lab/failed_app_id
yarn application -list -appStates ALL
yarn application -status "$(cat ~/lab/failed_app_id)"
```

The overnight job used **client** deploy mode. The Spark driver JVM lived on `shell`. When that process went away, the application died — YARN containers alone are not enough without the driver.

## 2. First fix — lasting deploy mode

```bash
sed -n '1,80p' ~/lab/submit-store-rollup.sh
# POLICY: --deploy-mode cluster for unattended store-rollup
~/lab/submit-store-rollup.sh
```

After cluster mode, the driver is the **ApplicationMaster** on `ds-spark-02` or `ds-spark-03`. Your terminal may stay quiet — use:

```bash
yarn logs -applicationId <id> 2>/dev/null | tail
```

## 3. Second break — edge paths

`~/lab/store_rollup.py` still reads `file:///home/spark/lab/edge-data/...`. That path exists only on shell. A driver on a NodeManager cannot open it.

```bash
ls ~/lab/edge-data
ls /mnt/lab-shared
mkdir -p /mnt/lab-shared/rollup
cp ~/lab/edge-data/*.csv /mnt/lab-shared/rollup/
# edit store_rollup.py to file:///mnt/lab-shared/rollup/orders.csv (and stores.csv)
~/lab/submit-store-rollup.sh
```

You do **not** need to guess which NM will hold the AM — the shared mount is on both.

## 4. Investigation

Overnight SPOF → second break (locality) → shared mount + cluster mode proof.
