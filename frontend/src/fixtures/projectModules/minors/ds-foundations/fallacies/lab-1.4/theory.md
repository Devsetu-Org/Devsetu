## Lab 1.4 — Capstone: The Heterogeneous Cluster
<!-- mode: read-and-implement tasks:1.4 -->

Not every caller shares one RTT. A rider on weak cellular, a driver on city Wi‑Fi, and a
server-side sidecar next to dispatch all look different on the wire.

One global attempt budget that works on Wi‑Fi false-fails cellular. One that works on
cellular makes the server path feel hung. Fleetline assumed one size of network. That is
the last fallacy in this chapter.

This lab is standalone. You size budgets — you do not re-implement retries or coalescing.

### TODO(1.4) — AttemptBudget

Implement `AttemptBudget` in `internal/budget/budget.go`:

1. `rider` / `driver` / `server` each return a value ≥ 1 and ≤ `DefaultAttempts`.
2. The three known classes must **not** all return the same number.
3. Prefer `rider ≥ server` (cellular needs more patience than a sidecar).
4. Unknown class → `DefaultAttempts`.

### Acceptance

- Known classes in `[1, DefaultAttempts]`
- Not all three equal
- Rider at least as patient as server
- Unknown / empty → `DefaultAttempts`
