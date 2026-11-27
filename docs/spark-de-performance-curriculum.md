# Data Engineer Spark — Performance labs (review)

Shelf: `frontend/src/constants/playCatalog.ts` → Data Engineer → Spark.  
All rows below are **placeholders** until packs exist. AQE is **off** for Chapter 4; **on** for Chapter 5.

## Chapter 4 — Performance Optimization (AQE off)

Full problem statements + scenarios: [`docs/spark-de-ch4-performance-labs.md`](spark-de-ch4-performance-labs.md).

| # | Story title | Graded fix | Status |
|---|-------------|------------|--------|
| 4.1 | The Store That Ate the Shuffle (`l2-store-that-ate-the-shuffle`) | Salt join; Investigation names hot key | Pack stub (`finalized: false`) — brief open, Start gated |
| 4.2 | Split the Hot Aisle (`l2-split-the-hot-aisle`) | Isolate + broadcast; **reject salt** | Pack stub |
| 4.3 | Every Cashier Has a Tiny Desk (`l2-every-cashier-tiny-desk`) | Memory shape only (≤1g) | Pack stub |
| 4.4 | Two Hundred Tasks for a Quiet Night (`l2-two-hundred-tasks-quiet-night`) | Right-size shuffle partitions | Pack stub |
| 4.5 | The Directory Was Small Until It Wasn’t (`l2-directory-small-until-it-wasnt`) | Broadcast vs SMJ by size | Pack stub |

## Chapter 5 — Adaptive Query Execution (AQE on)

| # | Title | Intent | Graded fix | Status |
|---|--------|--------|------------|--------|
| 5.1 | Same Skewed Join, AQE On | Re-run 4.1-style skew with AQE; see auto skew handling | Job finishes under budget; learner contrasts with manual salt | Placeholder |
| 5.2 | When AQE Coalesce Makes It Worse | Aggressive coalesce hurts parallelism | Disable/tune coalesce (or raise parallelism) so wall clock improves | Placeholder |
| 5.3 | Compare Plan With and Without AQE | Read AdaptiveSparkPlan delta | Written/Investigation comparison; both runs succeed | Placeholder |

## Related (not Chapter 4/5, but perf-adjacent)

| Chapter | Title | Note |
|---------|--------|------|
| 6 | Partition By Date for Pruning | Layout / read cost |
| 6 | Too Many Small Files | Compaction |
| 6 | Too Few Large Files | Read parallelism |
| 6 | Bucket Join: Zero Shuffle | Pre-bucketed join (can defer from 4.x) |

## Capacity (manual)

Ops dashboard: **Spark DE pool** section (`spark-de-base` / `up` / `wake` / `sleep` / `down`), or CLI:

```bash
./deploy/eks/eks-spark-de.sh base && ./deploy/eks/eks-spark-de.sh up
# park: ./deploy/eks/eks-spark-de.sh sleep
```

Pool label/taint: `devlabs.io/pool=spark-de`. Separate from Platforms `labs-spark` (`pool=spark`).

## Spark Platform on EKS (Run / Submit)

DE `sandboxType: spark-platform` jobs submit through the Platform API, which creates
`SparkApplication` CRs. On EKS the API sets `SPARK_NODE_POOL=spark-de` so driver and
executor pods select and tolerate that pool. Event logs land on
`s3a://devlabs-data/spark-events/` (no shared PVC).

```bash
# once: arm64 images for Graviton, then Operator + API + History
./deploy/eks/eks-spark-platform.sh deploy
# later upgrades (images already on Hub):
./deploy/eks/eks-spark-platform.sh install
./deploy/eks/eks-spark-platform.sh status
```

Point App EC2 / local backend at the Internal NLB URLs from `status`:

```bash
SPARK_PLATFORM_API_URL=http://<api-nlb>:8080
SPARK_HISTORY_UI_URL=http://<history-nlb>:18080
```
