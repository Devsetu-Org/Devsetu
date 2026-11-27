## Safety vs Liveness
<!-- mode: read-only -->

Fleetline's hardest promises come in two flavors. **Safety:** nothing bad ever happens (two drivers for one trip). **Liveness:** something good eventually happens (a willing rider gets matched when the network allows). This chapter names both, shows why both at once is hard (FLP intuition), and asks you to classify Fleetline properties.

> [!scope] This chapter's job
> Separate invariants from progress. Feel the tension under asynchrony. Leave Foundations ready for Simulation and protocol tracks.

### The story

Product writes tickets like "never double-dispatch" and "always match within 30s." Those are not the same kind of requirement. The first is safety; the second is liveness (and often false as stated). Engineering has to know which is which before picking Raft, leases, or best-effort timers.

## Lab 6.1 — Safety Properties
<!-- mode: read-and-implement tasks:6.1 -->

### Problem

Encode and check Fleetline **safety** invariants on trip histories. A safety violation is a finite bad prefix — once it happens, the system has already failed.

### Story beat

Invariant candidates:

- At most one driver owner per trip at any logical time.
- No lifecycle skip (e.g. `Completed` without `Assigned`).
- No assign after `Cancelled` without a new trip id.

### What you will implement (planned)

- A checker that fails as soon as a history violates a safety invariant.
- Fixtures: one clean history; one double-assign; one illegal transition — only the clean one passes.
- Wording practice: rewrite vague product language into checkable safety claims.

> [!idea] Safety is about the past
> If a bad thing already appeared in the trace, you cannot "eventually" un-break safety. You can only avoid it next time.

## Lab 6.2 — Liveness Properties
<!-- mode: read-and-implement tasks:6.2 -->

### Problem

Encode **liveness** claims: under stated fairness assumptions, a requested trip eventually leaves `Matching`. Liveness is about the future; finite traces alone cannot prove it — you need assumptions or infinite / extended runs in the lab harness.

### Story beat

"Match within 30 seconds" is a real-time SLO, not pure liveness. Pure liveness: "if there exists an available driver and the network delivers messages, the trip is eventually assigned." Timers make the SLO checkable in tests with a deadline.

### What you will implement (planned)

- A progress test: with a live driver and reliable-enough network schedule, `Requested` trips become `Assigned` within a bound.
- A counterexample schedule where messages are forever delayed and progress fails — showing liveness needs assumptions.
- Distinguish SLO (wall-clock) from eventual progress (logical).

## Lab 6.3 — FLP Intuition
<!-- mode: read-and-implement tasks:6.3 -->

### Problem

In a fully asynchronous network where even one process may crash, **deterministic consensus is impossible** (FLP). Fleetline cannot promise "we always decide the unique owner" and "we always eventually decide" under that model without relaxing something (randomness, partial synchrony, failure detectors, …).

### Story beat

Two dispatch replicas must agree which driver owns trip T after a crash and arbitrary delays. Students explore a tiny agreement toy: every deterministic strategy you try can be delayed into non-decision or disagreement when the scheduler is adversarial.

### What you will implement (planned)

- A minimal two/three-node "who owns T" agreement toy under an adversarial async scheduler.
- Show a run where a deterministic protocol never decides, or a run where relaxing a safety/liveness/assumption restores progress.
- Reflect: this is why later tracks add elections, quorums, timeouts, and simulation — not vibes.

> [!warn] FLP is not "consensus is useless"
> It is "you must weaken the model or the guarantees." Raft assumes partial synchrony for liveness; safety holds even when elections thrash.

## Lab 6.4 — Capstone: Classify
<!-- mode: read-and-implement tasks:6.4 -->

### Problem

Given a list of Fleetline product statements, classify each as safety, liveness, SLO, or nonsense — and point to which earlier lab backs the precise version.

### Story beat

Examples to classify (extend in the lab brief):

- "Never two drivers on one trip."
- "Riders always get a car in under a minute."
- "The map is never wrong."
- "Cancelled trips stay cancelled."
- "We eventually show the driver's true location."
- "Match is available in every partition."

### What you will implement (planned)

- A classification worksheet enforced by tests or a graded rubric file.
- For each "nonsense" or over-strong claim, propose a corrected property that Foundations can actually defend.
- Exit ticket: one paragraph tying Fleetline's safety (single owner) and liveness (eventual match under assumptions) to why Simulation and Consensus come next.

> [!check] Before you leave Foundations
> 1. You can write and check safety invariants on trips.
> 2. You know liveness needs assumptions; SLOs are real-time cousins.
> 3. You have FLP intuition: async + crash ⇒ you cannot have it all deterministically.
> 4. You can classify product language without mixing invariant and progress.

## Task briefs
<!-- mode: read-and-implement tasks:6.1,6.2,6.3,6.4 -->

### TODO(6.1) — Check safety invariants

Checker fails on double-assign, illegal lifecycle skip, or assign-after-cancel without new id. Clean history passes.

### TODO(6.2) — Liveness / progress under assumptions

With a live driver and fair delivery, Requested becomes Assigned within a bound. Show a forever-delayed schedule where progress fails — liveness needs assumptions.

### TODO(6.3) — FLP intuition toy

Tiny who-owns-T agreement under adversarial async. Exhibit non-decision for a deterministic strategy, or restore progress by relaxing an assumption.

### TODO(6.4) — Classify Fleetline claims

Classify product statements as safety, liveness, SLO, or nonsense. Correct over-strong claims into Foundations-defensible properties.
