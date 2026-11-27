## Lab 1.1 — The Unreliable, Slow Network
<!-- mode: read-and-implement tasks:1.1 -->

Fleetline's rider and driver apps call dispatch: request a trip, match a driver, confirm
pickup, advance status. On one machine a single RPC looks fine. Across a flaky city
network, "I sent MatchDriver" no longer means "they got it" or "I will hear back soon."

There are no sockets here. Both sides talk through `internal/netsim`, which can **drop**
messages and **delay** delivery. That is enough to break a naive client — and enough to
prove a fix.

### Two fallacies

1. **The network is reliable.** Messages disappear. A client that tries once fails often under loss.
2. **Latency is zero.** Five serial trip hops, each delayed ~50 ms, cost hundreds of milliseconds even when nothing is dropped.

> [!idea] Timeout vs retry
> A **timeout** stops you waiting forever (already inside netsim's delay). A **retry** gives a lost request another chance. This lab adds retries.

### What is given

<!-- lang: go -->
- `internal/netsim` — seeded `Network` with `SetLoss`, `SetDelay`, and `Call` (false = dropped)
- `internal/dispatch` — `Dispatch.TripHop` handler
- `internal/client` — `CallOnce` (leave alone), `Call` (`TODO(1.1)`), `OpenTrip` (five hops)
<!-- /lang -->

### TODO(1.1) — Client.Call

Implement `Call` in `internal/client/client.go`:

1. Attempt the RPC up to `c.maxAttempts` times (tests use 5).
2. Each attempt: `c.net.Call(method, args, reply)`.
3. On `true`, return nil.
4. On `false`, continue.
5. If every attempt fails, return an error that mentions retries / attempts exhausted.

No exponential backoff. No idempotency keys. Fixed retry is enough.

### Acceptance

- Reliable network: hop succeeds
- ~20% loss, budget 5: at most 5/60 hops fail
- 100% loss: clear error (mentions retry / attempt / exhaust)
- `OpenTrip` with ~50 ms delay: wall time ≥ 150 ms
