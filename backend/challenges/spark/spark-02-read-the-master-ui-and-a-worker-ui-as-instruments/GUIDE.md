# QuickBite on-call — flaky Workers on the Master UI

The previously built standalone cluster on these hosts is warmed up for this lab and should show **two ALIVE** workers. Last shift said it does not — Workers look flaky on the Master dashboard, so app diagnosis is stuck.

| Host          | Role                                      |
|---------------|-------------------------------------------|
| `ds-spark-01` | Master (RPC `7077`, UI `8080`)            |
| `ds-spark-02` | Worker (UI `8081`)                        |
| `ds-spark-03` | Worker (UI `8082`)                        |

Open the Master UI first. Treat what it shows as a **claim**, then investigate on the nodes. A previous engineer noted: bring a flaky Worker back and it can look fine at first, then show down again after a short while.

## 1. How Master and Workers talk

Workers register with the Master over **Spark RPC** on port **7077** (`spark://ds-spark-01:7077`). After registration, each Worker sends **heartbeats** on that same channel.

The Master marks a Worker **DEAD** if it hears nothing for `spark.worker.timeout` seconds. On this cluster the Master uses **30**. HTTP UIs (`8080` / `8081` / `8082`) are not the control-plane heartbeat.

On a Worker, the same setting also drives how often heartbeats are **sent**: every `spark.worker.timeout / 4` seconds. Master and Worker each read their **own** `conf/spark-defaults.conf`.

## 2. First restore — bring the missing Worker back

On each worker host:

```bash
ps -eo pid,args | grep -i '[W]orker'
```

If the Worker JVM is gone, start it:

```bash
$SPARK_HOME/sbin/start-worker.sh "$SPARK_MASTER_URL"
```

Watch the Master UI. If the Worker comes **ALIVE** and then goes **DEAD** again after ~30s, the process alone was not the whole story — check that host’s conf next.

## 3. Second restore — cadence must match the Master

On the flapping Worker host, inspect:

```bash
grep spark.worker.timeout $SPARK_HOME/conf/spark-defaults.conf
```

If that value is far larger than the Master’s **30**, the Worker signals too rarely and the Master times it out again. Set it back to **30**, then restart the Worker so it reloads conf:

```bash
$SPARK_HOME/sbin/stop-worker.sh
$SPARK_HOME/sbin/start-worker.sh "$SPARK_MASTER_URL"
```

Confirm the Master stays at **2 ALIVE** for longer than ~30–40 seconds.

## 4. Read the UIs as instruments

**Master UI** (`ds-spark-01`): ALIVE workers, total cores, total memory, running applications (idle → zero).

**Worker UI** (`ds-spark-02` or `ds-spark-03`): running executors (idle → zero).

If the UI and the node disagree, trust the node — the UI refreshes on its own schedule.

## 5. Investigation

Fill every field in story order: dashboard symptom → what DEAD means by itself → which host / first finding → why bring-up flopped → lasting fix → control-plane facts → live UI numbers after the fix. Then Submit.
