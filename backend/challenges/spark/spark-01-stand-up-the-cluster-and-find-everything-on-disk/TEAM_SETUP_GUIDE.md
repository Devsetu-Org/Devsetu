# QuickBite Data Platform — Standalone Spark bring-up

DevSetu Platform has procured three hosts for this lab. Spark is installed under
`$SPARK_HOME` (`/opt/spark`) on each:

| Host          | Role in this lab                          |
|---------------|-------------------------------------------|
| `ds-spark-01` | Start the **Master** here                 |
| `ds-spark-02` | Start a **Worker** here                   |
| `ds-spark-03` | Start a **Worker** here                   |

Nothing is running yet. Bring up a **standalone** cluster, then learn the on-disk layout.

Environment already set on every node:

- `SPARK_HOME=/opt/spark`
- `SPARK_MASTER_URL` — `spark://ds-spark-01:7077`
- `SPARK_MASTER_HOST=ds-spark-01` / `SPARK_MASTER_PORT` / `SPARK_MASTER_WEBUI_PORT` (8080)
- Hostnames `ds-spark-01` … `ds-spark-03` resolve on the cluster
- Workers: `SPARK_WORKER_CORES=1`, `SPARK_WORKER_MEMORY=768m`, `SPARK_WORKER_WEBUI_PORT`

## 1. Start the master

Switch the terminal to **ds-spark-01**, then:

```bash
$SPARK_HOME/sbin/start-master.sh
```

Confirm with `ps` / `jps` that `Master` is up. UI listens on port 8080.

## 2. Start both workers

On **ds-spark-02**, then **ds-spark-03**:

```bash
$SPARK_HOME/sbin/start-worker.sh "$SPARK_MASTER_URL"
```

Wait until the master lists **2 ALIVE** workers (registration takes a few seconds):

```bash
# on ds-spark-01
curl -s http://127.0.0.1:8080/json/ | grep -o '"aliveworkers"[[:space:]]*:[[:space:]]*[0-9]*'
# or: ps -ef | grep -i Worker   on each worker host
```

## 3. What `start-*.sh` does

On the host where you run the command:

1. `start-master.sh` / `start-worker.sh` → `spark-daemon.sh`
2. Loads env → sources **`conf/spark-env.sh`**
3. Starts the Java **Master** or **Worker**
4. Logs go under **`$SPARK_HOME/logs`**

Worker env is loaded on the **worker host** you started — not only on the master.  
`spark-defaults.conf` is for jobs later, not daemon start.

## 4. Find everything on disk

Without being told the paths, locate on master and workers:

- log directory
- work directory
- `conf/` (open `spark-env.sh` and `spark-defaults.conf`)

Know what each of those conf files configures — Investigation has one dropdown per file, plus questions on the start flow above.

## 5. Investigation

Record PIDs, paths, conf-role dropdowns, and start-flow dropdowns in the **Investigation** tab, then Submit.
