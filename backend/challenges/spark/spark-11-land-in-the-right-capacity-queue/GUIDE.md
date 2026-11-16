# QuickBite — store-rollup Accepted; fix the lasting path

Same hosts as Lab 2.1. Roles unchanged.

| Host | Role |
|------|------|
| `ds-spark-01` | **ResourceManager** (UI `:8088`) |
| `ds-spark-02` / `ds-spark-03` | **NodeManagers** (UI `:8042`) |
| `shell` | Submit client |

Capacity queues on this cluster: `default`, `production`, `adhoc`. Platform policy (also in `~/lab/notes.txt`): **store-rollup → production**.

Setup already ran the morning wrapper. Expect a `store-rollup` application **ACCEPTED** and a script at `~/lab/submit-store-rollup.sh`.

## 1. Forensics — why Accepted?

```bash
yarn application -list
# RM UI → Applications, then Scheduler
```

Record state and queue. Then ask: does this queue's absolute share fit the Spark-on-YARN ask for this lab (AM roughly a 1024 MB container after overhead, plus executors)? An app can sit **ACCEPTED** forever when the ask does not fit the queue — even though another queue has spare room.

## 2. Lasting path on disk

```bash
sed -n '1,80p' ~/lab/submit-store-rollup.sh
cat ~/lab/notes.txt
```

Policy and the wrapper should agree. If they do not, repair the wrapper — that is the lasting fix. Raising `default` capacity in `capacity-scheduler.xml` papers over a placement bug and fails the grade.

## 3. Prove it

```bash
~/lab/submit-store-rollup.sh
yarn application -list -appStates ALL
```

Capture the **new** `application_…` id in `production` (not the morning Accepted id). Driver log from the morning run is `~/lab/stuck.out` if you need it.

## 4. Investigation

Symptom → capacity math → wrong path → fix. Submit grades the repaired wrapper and a successful production run.
