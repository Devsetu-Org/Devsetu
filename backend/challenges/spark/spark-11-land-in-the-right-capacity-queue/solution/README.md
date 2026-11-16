# Spark-11 — Land in the Right Capacity Queue

A+C incident lab. Setup writes capacity queues (default 10 / production 70 /
adhoc 20), starts HDFS + RM + both NMs, plants `~/lab/submit-store-rollup.sh`
still using `--queue default`, and runs it. The morning `store-rollup` sits
**ACCEPTED**: the AM ask (~1024 MB) does not fit default's absolute share, while
production has spare room. Platform notes say store-rollup belongs in production.

Lasting fix: repair the wrapper to `--queue production` and re-run. Inflating
default capacity fails the grade.

Signed off when `solution/validate-local.sh` prints `SCENARIO_SIMULATABLE=yes`.

## Expected answers

| Key | Value |
|-----|-------|
| `stuckState` | `ACCEPTED` |
| `stuckQueue` | `default` |
| `whyAccepted` | `ask-exceeds-default-share` |
| `productionSpare` | `has-room` |
| `wrongPath` | `wrapper-queue-default` |
| `lastingFix` | `repair-wrapper-to-production` |
| `fixAppId` | new `application_…` in production (not the morning id) |
| `placementRule` | `platform-rule` |

## Local simulation

```bash
./solution/validate-local.sh
```

Uses `devsetu/spark-yarn-lab:v0.1` and a kubectl→docker shim around real
`setup.sh` / `grade.sh`.
