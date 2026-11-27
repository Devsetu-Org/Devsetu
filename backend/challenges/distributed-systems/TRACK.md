# Distributed Systems track

Distributed Systems Engineer domain. Shelf: `frontend/src/constants/playCatalog.ts` → `distributed-systems-engineer`.

**North star.** Build and prove protocols under [deterministic simulation](https://martinfowler.com/articles/deterministic-simulation-testing.html). Foundations teach the vocabulary first.

**Not this track.** Cluster observe / fault / RCA stays under **Platforms Engineer** (Kafka, Spark, K8s).

## Subtracks

| # | Subtrack | Kind | Status |
| --- | --- | --- | --- |
| 1 | **Foundations** | Theory + small code | Lab 1.1 ready (`/minors/ds-foundations`) |
| 2 | **Simulation** | DST substrate | Curriculum shell |
| 3 | **Quorum** | Protocol family | Curriculum shell |
| 4 | **Consensus** | Protocol family | Curriculum shell; deep build `/minors/consensus` |
| 5 | **Transactions** | Protocol family | Curriculum shell |

```text
Foundations → Simulation → Quorum → Consensus → Transactions
```

## Foundations (24 labs, 6 × 4)

Coding minor: `frontend/.../minors/ds-foundations/`.
World: **Fleetline** rideshare (Uber-inspired). Product substrate: **ridernet**.
Bible: `frontend/.../minors/ds-foundations/WORLD.md`. Stories: each chapter `theory.md`.

| Chapter | Labs | Status |
| --- | --- | --- |
| Fallacies | 1.1 Unreliable/Slow · 1.2 Constrained · 1.3 Changing/Untrusted · 1.4 Heterogeneous | **open**; Go 1.1 runnable (ridernet); 1.2–1.4 stub Tasks |
| Partial failure | Silent · Wrong-answer · Gray · Failure detector | **open** (theory + stub Tasks) |
| Time and ordering | Clocks · Lamport · Vector · Order the trip log | **open** (theory + stub Tasks) |
| Consistency | Linearizability · Weaker · Eventual/sessions · Pick the model | **open** (theory + stub Tasks) |
| CAP / PACELC | Partitions+CP · AP+reconcile · PACELC · City-split design | **open** (theory + stub Tasks) |
| Safety vs liveness | Safety · Liveness · FLP · Classify | **open** (theory + stub Tasks) |

### Strong vs soft (keep across chapters)

- **Strong:** trip owner, lifecycle, cancel → CP / linearizable teaching.
- **Soft:** location, ETA, nearby cars → AP / eventual / session teaching.

### Lab 1.1 review path (after dispatch retarget)

1. Open `/minors/ds-foundations` → Fallacies.
2. Starter: `internal/client/client.go` → `TODO(1.1)` (`Call` with bounded retries).
3. Given: `internal/netsim`, `internal/dispatch`, `CallOnce`, `OpenTrip`, tests.
4. Solution under `fallacies/go/solution/`.
5. Local check: `make test` in `fallacies/go/files`.

## Ship order

1. Foundations Fallacies 1.1 → 1.4  
2. Remaining Foundations chapters  
3. Simulation harness  
4. Quorum → Consensus → Transactions  

## Out of scope (v1)

Platforms incident packs, byte-level network sim, Antithesis hypervisor.
