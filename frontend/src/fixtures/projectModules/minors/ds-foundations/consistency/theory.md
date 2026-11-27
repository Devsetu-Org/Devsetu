## Consistency Models
<!-- mode: read-only -->

When a Fleetline client reads trip state, what may it assume? This chapter walks from **linearizability** down through weaker models to **eventual** and **session** guarantees — then asks you to pick models per field.

> [!scope] This chapter's job
> Make "consistent" precise. Strong for trip ownership; weaker for ETA and map pins. Same `Trip` object, different promises per field (see `WORLD.md`).

### The story

Two rider phones, one trip. Phone A reads `Assigned` to driver Alex. Phone B, a moment later, still reads `Matching`. Is that a bug? Depends on the model you promised. If assignment is linearizable, maybe yes. If ETA is eventual, stale numbers are expected.

## Lab 4.1 — Linearizability
<!-- mode: read-and-implement tasks:4.1 -->

### Problem

Trip **ownership** (which driver owns trip T) must behave as if there were one copy of the truth: once a match is acknowledged, every subsequent read sees that owner (until a later acknowledged change).

### Story beat

Dispatch acknowledges `MatchDriver(T → Alex)`. A second client must not read `MatchDriver(T → Sam)` afterward, even if it hits another replica in the lab cluster.

### What you will implement (planned)

- A small replicated trip-owner register with a linearizable `Match` / `ReadOwner` API under the lab scheduler.
- A history checker: client histories that violate linearizability fail the test.
- Keep soft fields out of this lab — only ownership.

> [!idea] Real-time order
> Linearizability is not just "same order on all nodes." It respects real-time: if operation A finishes before B starts, A shows up before B in the legal order.

## Lab 4.2 — Weaker Models
<!-- mode: read-and-implement tasks:4.2 -->

### Problem

ETA and "cars nearby" do not need linearizability. Stronger-than-needed models cost latency. Fleetline needs **sequential**, **causal**, or similar weaker guarantees where they fit.

### Story beat

The rider list of nearby drivers updates every second. Requiring a linearizable quorum read on every map refresh makes matching feel frozen. A weaker model is enough if you state it.

### What you will implement (planned)

- Implement (or simulate) one weaker model for nearby-driver reads (e.g. sequential or causal).
- Show a history that is legal under the weak model but illegal under linearizability — and argue why that is OK for this field.
- Contrast with ownership from 4.1: same cluster, different API contract.

## Lab 4.3 — Eventual Consistency and Sessions
<!-- mode: read-and-implement tasks:4.3 -->

### Problem

Driver location is **eventually** consistent: replicas converge when updates stop. After reconnect, the driver app also wants **read-your-writes** / session guarantees so it does not stare at its own stale pin.

### Story beat

Driver goes through a tunnel, uploads a burst of locations, reconnects, and opens the app. Without session stickiness they briefly see themselves two blocks back — then jump forward when replicas catch up.

### What you will implement (planned)

- Eventual propagation of `UpdateLocation` across lab replicas with a convergence test.
- A session token so reconnect reads land on a replica that has seen that session's writes (or waits until it has).
- Tests: convergence without sessions can still violate read-your-writes; with sessions, it must not.

## Lab 4.4 — Capstone: Pick the Model
<!-- mode: read-and-implement tasks:4.4 -->

### Problem

Design the consistency class for each Fleetline field and defend it with a tiny implementation or checker stub.

### Story beat

Product asks: "Can we make the whole trip object linearizable?" You answer with a table, not a vibe.

### What you will implement (planned)

| Field | Model you pick | Why |
| --- | --- | --- |
| Trip owner / lifecycle | (you choose) | |
| Cancel | | |
| ETA | | |
| Location / nearby | | |

- Wire each field to the matching lab primitive from 4.1–4.3.
- A short design test / rubric: wrong model for ownership fails; over-strong model for location fails a latency budget assertion.

> [!check] Before you leave Consistency
> 1. You can check a history for linearizability on trip ownership.
> 2. You know when a weaker model is enough for map/ETA.
> 3. Eventual + sessions cover location after reconnect.
> 4. You have an explicit per-field model map for Fleetline.

## Task briefs
<!-- mode: read-and-implement tasks:4.1,4.2,4.3,4.4 -->

### TODO(4.1) — Linearizable trip owner

Replicated Match/ReadOwner that is linearizable. Histories that assign two owners illegally must fail the checker. Soft fields stay out of this lab.

### TODO(4.2) — Weaker model for nearby

Implement or simulate a weaker model for nearby-driver reads. Show a history legal under weak but illegal under linearizability — and why that is OK for the map.

### TODO(4.3) — Eventual location + sessions

Propagate UpdateLocation until replicas converge. Session token must give read-your-writes after reconnect.

### TODO(4.4) — Pick the model per field

Table: owner/lifecycle, cancel, ETA, location → model + rationale. Wire each to the matching primitive; wrong model for ownership fails; over-strong location fails a latency budget.
