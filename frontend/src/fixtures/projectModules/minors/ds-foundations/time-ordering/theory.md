## Time and Ordering
<!-- mode: read-only -->

Fleetline's trip log is a sequence of events from phones and servers that do not share one true "now." This chapter replaces wall-clock faith with **happens-before**, **Lamport clocks**, and **vector clocks**, then asks you to order a messy trip log.

> [!scope] This chapter's job
> Show that device time lies; build logical time tools; produce a defensible order of trip events without a global synchronized clock.

### The story

Rider taps Request at 09:00:01.001 on a skew-fast phone. Driver confirms at 08:59:59 on a skew-slow phone. Dispatch's wall clock sits elsewhere. Sorting by `device_time` invents a timeline where the confirm happened before the request. Support and fraud tools need a better order.

## Lab 3.1 — Clocks That Lie and Clocks That Do Not
<!-- mode: read-and-implement tasks:3.1 -->

### Problem

Trip events carry `device_wall_time`. Under seeded clock skew in the lab, sorting by that field yields an illegal lifecycle (e.g. `Completed` before `Assigned`). Fleetline assumed "time is synchronized."

### Story beat

Three events for one trip arrive with plausible-looking timestamps that cannot all be true given the RPC causal edges you already know (a reply cannot precede its request).

### What you will implement (planned)

- Detect impossible orders under skew when causal edges are known.
- Prefer server-receive time or logical time over raw device time for ordering decisions in the lab store.
- Tests: skewed fixtures fail a wall-clock sort checker; your ordering respects request→reply edges.

## Lab 3.2 — Happens-Before and Lamport Clocks
<!-- mode: read-and-implement tasks:3.2 -->

### Problem

You need a clock that respects **happens-before**: if event A could have caused B, then `clock(A) < clock(B)`. Wall clocks do not give you that. Lamport clocks do (with concurrent ties).

### Story beat

`RequestTrip` on the rider, `MatchDriver` on dispatch, `ConfirmPickup` on the driver. Some pairs are causal; location pings may be concurrent. Support wants a single integer order that never puts an effect before its cause.

### What you will implement (planned)

- Instrument Fleetline nodes with Lamport timestamps on send/receive/local events.
- Prove: for every causal pair in the trip workflow, Lamport order matches happens-before.
- Accept that equal / incomparable Lamport values may still be concurrent (motivation for vectors).

> [!idea] Lamport is a partial truth
> Lamport gives a total order that extends happens-before. It does not tell you which events were truly concurrent.

## Lab 3.3 — Vector Clocks and Concurrency
<!-- mode: read-and-implement tasks:3.3 -->

### Problem

Driver `UpdateLocation` and rider `CancelTrip` race. Lamport may arbitrarily order them. Fleetline needs to know when two updates are **concurrent** so merge / conflict policy can run.

### Story beat

Cancel and a late location update both reach dispatch without seeing each other. Treating them as ordered hides a conflict: do you still show a pin on a cancelled trip?

### What you will implement (planned)

- Vector clocks on rider, driver, and dispatch (small N in the lab).
- Classify pairs: before / after / concurrent.
- On concurrent cancel vs location, apply a stated policy (e.g. cancel wins; drop soft pin).

## Lab 3.4 — Capstone: Order the Distributed Log
<!-- mode: read-and-implement tasks:3.4 -->

### Problem

You receive a shuffled bag of trip events from multiple nodes with vector (or Lamport) metadata. Produce an order suitable for audit: causal edges respected, concurrent soft events flagged, strong lifecycle still a valid state machine.

### Story beat

Incident review for trip `T-8421`: five nodes, skewed walls, concurrent locations, one cancel. Reconstruct "what happened" without inventing causality.

### What you will implement (planned)

- Topological / clock-based sort of the event bag.
- Reject orders that break happens-before or illegal lifecycle transitions.
- Emit concurrent sets explicitly rather than silently total-ordering soft races.

> [!check] Before you leave Time and Ordering
> 1. You distrust device wall clocks for causality.
> 2. Lamport respects happens-before but hides concurrency.
> 3. Vectors expose concurrent trip updates.
> 4. You can rebuild an audit order from a messy Fleetline log.

## Task briefs
<!-- mode: read-and-implement tasks:3.1,3.2,3.3,3.4 -->

### TODO(3.1) — Distrust skewed wall clocks

Detect impossible lifecycle orders under device skew when causal edges are known. Prefer server-receive or logical time over raw device_wall_time for ordering.

### TODO(3.2) — Lamport on trip workflow

Instrument rider/dispatch/driver with Lamport timestamps. For every causal pair in the trip workflow, Lamport order must respect happens-before.

### TODO(3.3) — Vector clocks for concurrency

Classify cancel vs location as before/after/concurrent. On concurrent cancel vs location, apply cancel-wins (drop soft pin).

### TODO(3.4) — Order the trip event log

Sort a shuffled event bag with clock metadata. Respect happens-before and legal lifecycle; emit concurrent soft sets instead of silently total-ordering races.
