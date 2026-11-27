# Foundations world — Fleetline / ridernet

Fictional rideshare inspired by Uber/Lyft objectives. One product spine for all six
Foundations chapters. Not a payments or order-processor lab.

| | |
| --- | --- |
| **Company** | Fleetline |
| **Product / lab substrate** | `ridernet` (replaces `netlab`) |
| **Core object** | `Trip` — who is matched, what state it is in |
| **Actors** | Rider app, driver app, dispatch service, (later) region replicas |
| **Network** | In-process `netsim` — loss, delay, bandwidth, partitions. No sockets. |

## What Fleetline is trying to do

1. Match a rider to exactly one driver.
2. Advance the trip through a clear lifecycle.
3. Keep soft signals (ETA, map pins) useful even when the network is ugly.
4. Never double-assign a trip; eventually make progress when the network allows.

## Trip lifecycle (shared vocabulary)

```text
Requested → Matching → Assigned → EnRoute → Arrived → InProgress → Completed
                ↘ Cancelled
```

Strong state (assignment, lifecycle) and soft state (location, ETA) are deliberately
different consistency classes — chapters 4–5 lean on that split.

## Core RPCs (names evolve per chapter)

| RPC | Role |
| --- | --- |
| `Dispatch.RequestTrip` | Rider asks for a ride |
| `Dispatch.MatchDriver` | Assign a driver to a trip |
| `Dispatch.ConfirmPickup` | Driver accepts / confirms |
| `Dispatch.UpdateLocation` | Soft: pin / ETA input |
| `Dispatch.AdvanceTrip` | Lifecycle transition (Arrived, Start, Complete, …) |
| `Dispatch.CancelTrip` | Cancel with a reason |

Serial “feel the latency” path in Fallacies (five hops):

`RequestTrip → MatchDriver → ConfirmPickup → AdvanceTrip(EnRoute) → AdvanceTrip(Arrived)`

## Strong vs soft (keep this split)

| Kind | Examples | Default teaching model |
| --- | --- | --- |
| **Strong** | trip owner, lifecycle status, cancel | Linearizable / CP under partition |
| **Soft** | driver lat/lng, ETA, “cars nearby” | Eventual / AP + reconcile |

## Chapter → story map

| Ch | Id | Fleetline story |
| --- | --- | --- |
| 1 | `fallacies` | Apps talk to dispatch over a bad network |
| 2 | `partial-failure` | One side thinks the trip moved; the other does not |
| 3 | `time-ordering` | Phone clocks lie; order the trip event log |
| 4 | `consistency` | What a read of trip vs ETA may assume |
| 5 | `cap` | City split: stop double-match vs keep showing cars |
| 6 | `safety-liveness` | Never two drivers; eventually someone gets a ride |

## Out of scope for Foundations

Real maps, payments, surge pricing, Kafka/K8s ops. Those stay Platforms or later DS tracks.
