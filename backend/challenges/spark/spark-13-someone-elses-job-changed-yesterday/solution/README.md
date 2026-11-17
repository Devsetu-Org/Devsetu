# Spark-13 — Design a Queue for the Analytics Team

Chapter 2 capstone. Setup starts capacity queues `default` 10 / `production` 70 /
`adhoc` 20 with **no** `analytics` leaf. Plants:

- `~/lab/notes.txt` — ticket (analytics ≥ 20%, max-capacity 100, user-limit-factor ≥ 2,
  production ≥ 50%, sum 100)
- `~/lab/capacity-draft.xml` — adds analytics but capacities sum to **120** (no user-limit-factor)
- `~/lab/submit-analytics-probe.sh` — `--queue analytics` (1×1×512m probe)
- `~/lab/first_submit.out` — first failure (queue missing)

Lasting fix: edit `capacity-scheduler.xml` on **`ds-spark-01`**, rebalance (for
example production 70→55, adhoc 20→10, analytics 25 + user-limit-factor 3),
`yarn rmadmin -refreshQueues`, run the probe.

Borrowing `production`/`adhoc`, inflating `default`, or gutting production below
50% fails the grade.

Signed off when `solution/validate-local.sh` prints `SCENARIO_SIMULATABLE=yes`.

## Expected answers

| Key | Value |
|-----|-------|
| `firstFailure` | `queue-missing` |
| `designAction` | `add-analytics-rebalance` |
| `capacitySource` | `rebalance-siblings` |
| `applyMethod` | `refresh-queues` |
| `fixedAppId` | new FINISHED/RUNNING app in `analytics` |
| `platformLesson` | `design-not-borrow` |

## Local simulation

```bash
./solution/validate-local.sh
```

Uses `devsetu/spark-yarn-lab:v0.1` through a kubectl→docker shim.
