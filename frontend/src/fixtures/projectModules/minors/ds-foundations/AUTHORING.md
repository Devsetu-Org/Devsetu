# DS Foundations minor — authoring model

Chaptered minor for the Distributed Systems **Foundations** subtrack.
Shelf map: `playCatalog` → `distributed-systems-engineer` → `foundations`.
Coding workspace: `/minors/ds-foundations`.

**World bible:** [`WORLD.md`](./WORLD.md) — Fleetline rideshare, product substrate `ridernet`.

Languages: **Go first** (Python/C++ later). `TODO(N.x)` markers, no hard wrapping,
`solution/` never globbed.

**Fallacies rule (important):** each shelf lab has its **own starter**. Do not share one
chapter repo across 1.1–1.4 — free order on the shelf would leak earlier answers.

## Chapters

| # | id | Status | Focus |
| --- | --- | --- | --- |
| 0 | `overview` | **ready** | reading: why Foundations before Simulation / protocols |
| 1 | `fallacies` | **ready** (reading) | Chapter intro; labs are `fallacies-1.1`…`1.4` |
| 1.1–1.4 | `fallacies-1.x` | **ready** (hybrid packs 701–704; isolated starters) | One fallacy / one TODO each |
| 2 | `partial-failure` | **ready** (hybrid packs 705–708; still shared stubs — split next) | Silent, wrong-answer, gray, failure detector |
| 3 | `time-ordering` | **ready** (hybrid packs 709–712; theory + stub Tasks) | Wall clocks, Lamport, vector, order the trip log |
| 4 | `consistency` | **ready** (hybrid packs 713–716; theory + stub Tasks) | Linearizability → eventual / sessions; pick per field |
| 5 | `cap` | **ready** (hybrid packs 717–720; theory + stub Tasks) | CP match, AP map, PACELC, city-split design |
| 6 | `safety-liveness` | **ready** (hybrid packs 721–724; theory + stub Tasks) | Safety, liveness, FLP intuition, classify |

Shelf labs: all 24 use `sandboxType: project` packs (`ds-foundations-01`…`24`) → Labs brief + Projects editor.

## Product name

`ridernet` — rider/driver clients talking to Fleetline dispatch over an in-process
simulated network (`internal/netsim`). No sockets. Seeded loss, delay, and (later)
bandwidth / partitions.

Replaces the earlier `netlab` / QuickBite payment spine.

## Lab index (24)

### 1 · Fallacies (reading + four starters)

| Module | Lab | Starter |
| --- | --- | --- |
| `fallacies` | reading intro | — |
| `fallacies-1.1` | The Unreliable, Slow Network | `fallacies/lab-1.1/` |
| `fallacies-1.2` | The Constrained Network | `fallacies/lab-1.2/` |
| `fallacies-1.3` | The Changing, Untrusted Network | `fallacies/lab-1.3/` |
| `fallacies-1.4` | Capstone: The Heterogeneous Cluster | `fallacies/lab-1.4/` |

### 2 · Partial failure

| Task | Lab |
| --- | --- |
| 2.1 | Silent Failures |
| 2.2 | Wrong-Answer Failures |
| 2.3 | Gray Failures |
| 2.4 | Capstone: The Failure Detector |

### 3 · Time and ordering

| Task | Lab |
| --- | --- |
| 3.1 | Clocks That Lie and Clocks That Do Not |
| 3.2 | Happens-Before and Lamport Clocks |
| 3.3 | Vector Clocks and Concurrency |
| 3.4 | Capstone: Order the Distributed Log |

### 4 · Consistency

| Task | Lab |
| --- | --- |
| 4.1 | Linearizability |
| 4.2 | Weaker Models |
| 4.3 | Eventual Consistency and Sessions |
| 4.4 | Capstone: Pick the Model |

### 5 · CAP / PACELC

| Task | Lab |
| --- | --- |
| 5.1 | Partitions and CP |
| 5.2 | AP and Reconciliation |
| 5.3 | PACELC and Real Systems |
| 5.4 | Capstone: Design Under CAP |

### 6 · Safety vs liveness

| Task | Lab |
| --- | --- |
| 6.1 | Safety Properties |
| 6.2 | Liveness Properties |
| 6.3 | FLP Intuition |
| 6.4 | Capstone: Classify |

## Layout

```
WORLD.md
AUTHORING.md
fallacies/
  theory.md                 pointer (reading is dsFoundationsFallaciesReading.ts)
  lab-1.1/{theory.md,go/files,go/solution}
  lab-1.2/...
  lab-1.3/...
  lab-1.4/...
partial-failure/            # still shared chapter repo — split like Fallacies next
time-ordering/
consistency/
cap/
safety-liveness/
```

## UI wiring

- Minor `sequentialUnlock: false` — free order; Fallacies starters must stay isolated.
- Track labs use `sandboxType: project` → `ProjectLabWorkspace`.
- Packs 701–704: `platformSpec.project.chapterId` = `fallacies-1.1` … `fallacies-1.4`.

## Next engineering step

Split chapters 2–6 the same way (one starter per shelf lab).
