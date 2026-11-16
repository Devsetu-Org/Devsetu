# Spark-09 — Submit the Same Workload on YARN

Orientation lab. Setup starts one-node HDFS + ResourceManager + both NodeManagers.
Brief order: **YARN forensics first** (same hosts, new roles), then **fix** the
planted Chapter 1 wrapper at `~/lab/submit-store-rollup.sh` (`--master yarn`,
instances × cores, `$1`-driven deploy mode/name). Repaired wrapper launches
`store-rollup-client` and `store-rollup-cluster`.

Grade checks Investigation forensics, the wrapper itself, and both FINISHED apps.

Signed off when `solution/validate-local.sh` prints `SCENARIO_SIMULATABLE=yes`
(client + cluster both FINISHED on the RM).

## Expected answers

| Key | Value |
|-----|-------|
| `rmHostRole` | `resourcemanager` |
| `noMaster` | `yarn-only` |
| `activeNodesExpect` | `2` |
| `oldSubmitContract` | `standalone-contract` |
| `yarnResourceContract` | `instances-and-cores` |
| `clientDriverHost` | `shell` |
| `clientRmPanel` | `applications` |
| `clientNmPanel` | `containers` |
| `clusterDriverHost` | `ds-spark-02` or `ds-spark-03` |
| `clusterAmIsContainer` | `am-container` |
| `deployModeDelta` | `driver-host` |
| `whyBothModes` | `driver-placement` |

Application ids must be real `application_…` rows on this RM, named
`store-rollup-client` / `store-rollup-cluster`, both **FINISHED**.

## Local simulation

```bash
./solution/validate-local.sh
```

Builds against `devsetu/spark-yarn-lab:v0.1` (build the image first if missing).
