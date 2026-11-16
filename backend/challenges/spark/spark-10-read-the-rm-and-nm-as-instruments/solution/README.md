# Spark-10 — Read the RM and NM as Instruments

Incident lab. Setup starts one-node HDFS + ResourceManager + both NodeManagers,
then plants a **0.9%** disk-health threshold on `ds-spark-03` only so the RM marks
that NodeManager **UNHEALTHY** while its JVM and UI stay up. The morning
`store-rollup-probe` (client mode from `shell`) reaches **RUNNING** with an AM on
`ds-spark-02` and no executors — one 1536 MB NM cannot hold both a 1024 MB AM and
a 1024 MB executor.

Lasting fix: restore a sane threshold on `ds-spark-03` and restart that
NodeManager. The probe finishes on its own. Disabling the disk checker or setting
the limit to 100% fails the grade.

Signed off when `solution/validate-local.sh` prints `SCENARIO_SIMULATABLE=yes`.

## Expected answers

| Key | Value |
|-----|-------|
| `incidentActiveNodes` | `1` |
| `unhealthyHost` | `ds-spark-03` |
| `nodeState` | `UNHEALTHY` |
| `probeAppId` | planted `application_…` (also `/opt/lab/state/probe_app_id` on RM) |
| `probeAppState` | `RUNNING` |
| `probeSymptom` | `am-only` |
| `whyNoExecutor` | `no-room-after-am` |
| `nmJvm` | `alive-but-unhealthy` |
| `diskTruth` | `not-full` |
| `rootCause` | `threshold-too-low` |
| `lastingFix` | `restore-threshold-restart-nm` |
| `uiIsClaim` | `verify-on-node` |

## Local simulation

```bash
./solution/validate-local.sh
```

Builds against `devsetu/spark-yarn-lab:v0.1` (build the image first if missing).
Runs real `setup.sh` / `grade.sh` through a kubectl→docker shim.
