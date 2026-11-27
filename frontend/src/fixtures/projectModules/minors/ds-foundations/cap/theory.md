## CAP and PACELC
<!-- mode: read-only -->

When the city network **partitions**, Fleetline must choose: keep serving possibly divergent answers, or refuse some operations to protect trip truth. When the network is healthy, you still trade **latency vs consistency** (PACELC). This chapter makes those choices concrete on match vs map.

> [!scope] This chapter's job
> Feel CP on trip assignment, AP on soft map state, PACELC in the common case, then design a split-brain city scenario end-to-end.

### The story

A fiber cut isolates Region West from Region East. Both regions still have riders and drivers. If both keep matching independently, one trip gets two drivers. If both stop matching, nobody rides. Soft "cars nearby" can stay up either way — with different lies.

## Lab 5.1 — Partitions and CP
<!-- mode: read-and-implement tasks:5.1 -->

### Problem

Under partition, **trip assignment is CP**: prefer refusing a match over double-assigning. Availability of `MatchDriver` may drop in a minority partition.

### Story beat

West and East both receive `RequestTrip` for the same rider intent. Without a CP rule, both assign. With CP, only a majority (or primary) side may assign; the other returns "unavailable / try again."

### What you will implement (planned)

- Partition the lab into two sides; only one side may successfully `MatchDriver` for a given trip.
- Minority side fails closed on strong mutations.
- Test: never two owners for one trip across the partition; some clients correctly see unavailability.

## Lab 5.2 — AP and Reconciliation
<!-- mode: read-and-implement tasks:5.2 -->

### Problem

**Nearby drivers / ETA** stay available under partition (AP). Divergent soft state is OK temporarily; when the partition heals, reconcile.

### Story beat

West shows five cars; East shows three different ones. Riders still see *something*. After heal, maps converge. You must not "reconcile" by also merging conflicting **owners** — that stays CP from 5.1.

### What you will implement (planned)

- Soft reads succeed on both sides during partition (possibly divergent).
- On heal, merge location sets with a stated rule (e.g. last-write-wins per driver id with vector/meta).
- Assert ownership never takes the AP path.

> [!idea] Split the object
> CAP is per *question*, not per company. Fleetline is CP for match and AP for map — that is a feature, not confusion.

## Lab 5.3 — PACELC and Real Systems
<!-- mode: read-and-implement tasks:5.3 -->

### Problem

Even with no partition, every match read can choose: wait for a fresh quorum (**C**) or return a fast local answer (**L**). PACELC: if Partition then A/C else Latency/Consistency.

### Story beat

Product wants sub-100 ms "cars nearby" and still wants match acknowledgements to be sticky. One global "we are consistent" slider cannot do both.

### What you will implement (planned)

- Two read paths when healthy: `ReadOwner` (favor C) vs `ReadNearby` (favor L).
- Measure: latency-favoring path wins a budget test; consistency-favoring path wins a freshness test.
- Short writeup mapping Fleetline choices to PACELC letters (and optionally to a real system analogy: rideshare match vs map CDN).

## Lab 5.4 — Capstone: Design Under CAP
<!-- mode: read-and-implement tasks:5.4 -->

### Problem

A scripted city outage: partition, concurrent requests, heal. Your design must keep the safety of 5.1, the map availability of 5.2, and sane healthy-case latency from 5.3.

### Story beat

Incident tabletop: "West is dark to East for 90 seconds." You simulate it and show what riders and drivers experience for match vs map.

### What you will implement (planned)

- One scenario harness: partition → load → heal → checks.
- Pass: no double match; soft reads available; post-heal convergence; document which ops returned errors on purpose.
- Fail the lab if you "fix" unavailability by assigning on both sides.

> [!check] Before you leave CAP / PACELC
> 1. Match fails closed under partition (CP).
> 2. Map stays up and reconciles (AP).
> 3. Healthy-case latency vs consistency is an explicit choice (PACELC).
> 4. You can run a city-split scenario and explain the UX on each side.

## Task briefs
<!-- mode: read-and-implement tasks:5.1,5.2,5.3,5.4 -->

### TODO(5.1) — CP match under partition

Only one side of a partition may successfully MatchDriver. Minority fails closed on strong mutations. Never two owners for one trip.

### TODO(5.2) — AP map + reconcile

Soft nearby/ETA reads succeed on both sides during partition. On heal, merge with a stated rule. Ownership must never take the AP path.

### TODO(5.3) — PACELC read paths

When healthy: ReadOwner favors C; ReadNearby favors L. Latency path wins a budget test; consistency path wins a freshness test.

### TODO(5.4) — City-split design harness

Partition → load → heal → checks. Pass: no double match; soft reads available; post-heal convergence; document intentional errors.
