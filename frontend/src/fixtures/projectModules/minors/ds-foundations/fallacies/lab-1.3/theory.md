## Lab 1.3 — The Changing, Untrusted Network
<!-- mode: read-and-implement tasks:1.3 -->

The path between phone and dispatch is not a fixed, trusted LAN. A driver can bounce
Wi‑Fi → cellular mid-trip. A buggy or malicious client can **replay** an old
`ConfirmPickup`. Soft location updates can arrive late and look like they belong to a
session that already ended.

Fleetline assumed the network was secure and the topology never changed. Neither is true.
If every byte on the wire is treated as gospel, a stale confirm can resurrect a cancelled
trip.

This lab is standalone. You implement a freshness guard — not Lab 1.1 retries.

### TODO(1.3) — Guard.Accept

Implement `Accept` in `internal/session/accept.go`:

1. First accept for a trip succeeds and records `(sessionEpoch, seq)`.
2. Later accepts need a **strictly newer** pair: higher epoch, or same epoch with higher seq.
3. Identical or behind pairs return **false**.

### Acceptance

- First mutation for a trip → true
- Replay of the same pair → false
- Behind seq / old epoch → false
- Newer seq or newer epoch → true
- Trips are independent
