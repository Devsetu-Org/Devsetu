## Partial Failure
<!-- mode: read-only -->

In Fallacies you learned that the network drops and delays. That is not the only way Fleetline breaks. **Partial failure** means some components look alive while others are dead, slow, or lying — and different observers disagree.

> [!scope] This chapter's job
> Name and handle four shapes of partial failure on the trip plane: **silent**, **wrong-answer**, **gray**, and a simple **failure detector**. Still `ridernet` / Fleetline — no cluster RCA tools.

### The story

A driver taps **Complete trip**. The app shows a checkmark. Dispatch never recorded `Completed`. Or dispatch returns an ETA for the wrong driver. Or the rider's AZ can reach dispatch and the driver's AZ cannot — each side has a coherent but incompatible view. Retries alone do not fix "the other side is wrong" or "only half the system can see you."

## Lab 2.1 — Silent Failures
<!-- mode: read-and-implement tasks:2.1 -->

### Problem

An `AdvanceTrip(Completed)` RPC gets no useful signal: the request may have executed, or not. The driver UI assumes success. Fleetline's ledger and rider receipt disagree. Silence is not success and not a clean error.

### Story beat

Driver completes a fare in a parking garage (lossy uplink). `Call` retries exhaust. The client does not know whether dispatch applied the transition. Naively retrying with a new id creates duplicate completes; never retrying leaves the trip stuck `InProgress`.

### What you will implement (planned)

- Treat "no reply" as **unknown**, not success.
- Use an idempotency key (or trip+transition token) so safe retry cannot double-apply `Completed`.
- Tests: under total loss after a possible apply, reconciling with the same key converges; inventing a new key must not create two completes.

> [!idea] At-least-once + idempotency
> Retries give at-least-once delivery. Idempotency makes at-least-once safe for strong trip transitions.

## Lab 2.2 — Wrong-Answer Failures
<!-- mode: read-and-implement tasks:2.2 -->

### Problem

The network delivers a reply that is **wrong**: stale match, swapped trip id, ETA computed from a dead driver's location. Worse than silence — the client believes a coherent lie.

### Story beat

A delayed `MatchDriver` reply arrives after the rider already cancelled and requested again. The app assigns the old driver to the new trip id. Or a cached ETA handler returns another trip's estimate.

### What you will implement (planned)

- Bind replies to request identity (trip id + client token / RPC id); reject mismatched replies.
- Fence stale matches with a trip generation / epoch so an old success cannot overwrite a newer cancel.
- Tests: late replies for trip A never mutate trip B; wrong-answer fixtures are detected, not applied.

## Lab 2.3 — Gray Failures
<!-- mode: read-and-implement tasks:2.3 -->

### Problem

**Gray failure**: the system is degraded in a way that health checks miss. Classic Fleetline case — **asymmetric visibility**. Rider ↔ dispatch works; driver ↔ dispatch does not (or one AZ sees the match and another does not).

### Story beat

Rider sees "Alex is arriving." Alex's app never got `ConfirmPickup`. Support sees two healthy services. The failure is in the *combination* of views, not in a single red light.

### What you will implement (planned)

- Model asymmetric partitions in `netsim` (A→B ok, B→A dropped).
- Require a cross-view check before treating a match as firm (e.g. driver ack required, or dual observation).
- Surface "degraded / awaiting driver ack" instead of a false "Assigned" when only one side confirmed.

> [!warn] Healthy nodes, broken system
> Gray failures punish dashboards that only ask "is process up?" — ask "do both parties share the trip truth?"

## Lab 2.4 — Capstone: The Failure Detector
<!-- mode: read-and-implement tasks:2.4 -->

### Problem

Fleetline needs to decide "is this driver still there?" under delay and loss without declaring every slow phone dead. A perfect detector is impossible on an asynchronous network; a **useful** one is not.

### Story beat

Dispatch must reassign if a driver vanishes mid-`EnRoute`, but cellular spikes look like death. Too aggressive → flapping reassigns (safety risk). Too timid → riders wait on a ghost.

### What you will implement (planned)

- A timeout-based failure detector with heartbeat / lease on the driver session.
- Tune so: (a) crashed drivers are eventually suspected, (b) delayed-but-alive drivers are not constantly flapping under the lab's delay profile.
- Document the tradeoff: faster detection vs false suspects — this foreshadows safety vs liveness (chapter 6) and imperfect detectors in consensus.

> [!check] Before you leave Partial Failure
> 1. Silence ⇒ unknown; strong transitions are idempotent.
> 2. Wrong answers are rejected by identity / epoch checks.
> 3. Gray / asymmetric views need cross-acks, not single-sided "success."
> 4. You have a simple detector and know it can be wrong either way.

## Task briefs
<!-- mode: read-and-implement tasks:2.1,2.2,2.3,2.4 -->

### TODO(2.1) — Silent complete with idempotency

Treat no-reply as unknown. Idempotent AdvanceTrip(Completed) so safe retry cannot double-apply. Converge when replaying the same key; a new key must not create two completes.

### TODO(2.2) — Reject wrong-answer replies

Bind replies to trip id + RPC token / epoch. Fence stale MatchDriver so a late success cannot overwrite a newer cancel. Wrong-answer fixtures must be detected, not applied.

### TODO(2.3) — Cross-ack under gray failure

Model asymmetric partitions. Require driver ack (or dual observation) before firm Assigned. Surface degraded / awaiting ack instead of false success when only one side confirmed.

### TODO(2.4) — Driver failure detector

Timeout/lease heartbeat for driver presence. Crashed drivers eventually suspected; delayed-but-alive drivers should not flap under the lab delay profile. Document false-suspect vs slow-detect tradeoff.
