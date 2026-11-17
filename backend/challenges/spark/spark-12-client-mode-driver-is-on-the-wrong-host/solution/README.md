# Spark-12 — Client Mode Driver Is on the Wrong Host

Stacked incident lab:

1. Overnight client-mode driver on `shell` is killed → app FAILED.
2. Wrapper still `--deploy-mode client` + `store_rollup.py` reads `~/lab/edge-data`
   (shell only).
3. Switching to cluster alone fails: NM driver cannot see edge paths.
4. Lasting fix: `--deploy-mode cluster` + CSVs on `/mnt/lab-shared/rollup/` +
   job paths updated. AM on `ds-spark-02` or `ds-spark-03`.

Signed off when `solution/validate-local.sh` prints `SCENARIO_SIMULATABLE=yes`.

## Expected answers

| Key | Value |
|-----|-------|
| `failedAppId` | planted overnight `application_…` |
| `failureMode` | `driver-on-edge` |
| `secondBreak` | `edge-path-on-nm` |
| `dataPlacement` | `shared-mount` |
| `clusterAppId` | new FINISHED app (not the overnight id) |
| `clusterDriverHost` | `ds-spark-02` or `ds-spark-03` |
| `productionShape` | `cluster-am` |

## Local simulation

```bash
./solution/validate-local.sh
```

Uses `devsetu/spark-yarn-lab:v0.1` and a Docker volume mounted at `/mnt/lab-shared`
on every container (stands in for the K8s hostPath shared mount).
