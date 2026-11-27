## Lab 1.2 — The Constrained Network
<!-- mode: read-and-implement tasks:1.2 -->

Loss is not the only failure mode. A link can be **narrow**: limited bandwidth, like a
crowded cell tower. Driver phones stream fat location blobs so the rider map can show
the car. Those soft updates queue in front of the RPCs that actually move the trip.

Riders stare at "Finding your driver…" even though nothing was dropped. Soft traffic
starved the strong path. Fleetline assumed infinite capacity. It does not.

This lab is standalone. You do not implement retries here — only location coalescing.

### TODO(1.2) — Coalesce

Implement `Coalesce` in `internal/location/coalesce.go`:

1. Keep **at most one** update per `DriverID` — the one with the highest `Seq`.
2. Preserve first-seen driver order among distinct drivers.
3. Under spam with duplicate drivers, the returned slice must be **shorter** than the input.

### Acceptance

- Empty / nil → empty
- Duplicate drivers → newest `Seq` wins
- First-seen order among drivers preserved
- 50 updates for one driver → one update with the max seq
